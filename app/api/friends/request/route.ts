import { type NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { friendRequests, users } from "@/db/schema";
import { errorResponse } from "@/lib/api";
import { getIO } from "@/sockets";
import { TagInputSchema } from "@/schemas/tag.schema";
import { assertIsUUID } from "@/lib/validate-uuid";

/**
 * POST /api/friends/request
 * Body: { tag: string }  — e.g. { tag: "john#1234" }
 *
 * Resolves the tag to a UUID before any DB operation.
 * Emits `friend_request_received` via socket to the receiver if online.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  const senderId = session.user.id;

  let body: { tag?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Request body must be JSON", 400);
  }

  // Validate tag format
  const tagParse = TagInputSchema.safeParse(body.tag);
  if (!tagParse.success) {
    return errorResponse(
      tagParse.error.errors[0]?.message ?? "Invalid tag format. Expected name#XXXX (e.g. john#1234)",
      400
    );
  }
  const tag = tagParse.data;

  // Resolve tag → UUID (never touches UUID column with a tag string)
  const [receiver] = await db
    .select({ id: users.id, name: users.name, tag: users.tag })
    .from(users)
    .where(eq(users.tag, tag))
    .limit(1);

  if (!receiver) {
    return NextResponse.json({ error: "User not found with that tag" }, { status: 404 });
  }

  // Assert UUID before any UUID column usage — Agent D defensive guard
  assertIsUUID(receiver.id, "receiver.id");
  const receiverUUID = receiver.id;

  if (receiverUUID === senderId) {
    return errorResponse("You cannot send a friend request to yourself", 400);
  }

  // Check no duplicate / already accepted request
  const [existing] = await db
    .select({ id: friendRequests.id, status: friendRequests.status })
    .from(friendRequests)
    .where(
      or(
        and(eq(friendRequests.senderId, senderId), eq(friendRequests.receiverId, receiverUUID)),
        and(eq(friendRequests.senderId, receiverUUID), eq(friendRequests.receiverId, senderId))
      )
    )
    .limit(1);

  if (existing) {
    if (existing.status === "accepted") {
      return errorResponse("You are already friends with this user", 409);
    }
    return errorResponse("A friend request already exists between you and this user", 409);
  }

  const [request] = await db
    .insert(friendRequests)
    .values({ senderId, receiverId: receiverUUID })
    .returning();

  // Notify receiver via socket if online
  try {
    const io = getIO();
    const { getDriverLocation } = await import("@/sockets/store/location.store");
    const [sender] = await db
      .select({ name: users.name, tag: users.tag })
      .from(users)
      .where(eq(users.id, senderId))
      .limit(1);

    const receiverEntry = getDriverLocation(receiverUUID);
    if (receiverEntry?.socketId && sender) {
      io.to(receiverEntry.socketId).emit("friend_request_received", {
        requestId: request!.id,
        fromUserId: senderId,
        fromUserName: sender.name,
        fromUserTag: sender.tag,
      });
    }
  } catch {
    // Socket emission is best-effort — don't fail the HTTP response
  }

  return NextResponse.json(request, { status: 201 });
}

/**
 * GET /api/friends/request
 * Returns incoming pending friend requests for the current user.
 */
export async function GET(_req: NextRequest) {
  const session = await requireAuth();
  const userId = session.user.id;

  const pending = await db
    .select({
      id: friendRequests.id,
      senderId: friendRequests.senderId,
      senderName: users.name,
      senderTag: users.tag,
      createdAt: friendRequests.createdAt,
    })
    .from(friendRequests)
    .innerJoin(users, eq(users.id, friendRequests.senderId))
    .where(
      and(
        eq(friendRequests.receiverId, userId),
        eq(friendRequests.status, "pending")
      )
    );

  return NextResponse.json({ requests: pending });
}
