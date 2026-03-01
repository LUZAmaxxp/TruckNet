import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { friendRequests, users } from "@/db/schema";
import { errorResponse } from "@/lib/api";
import { ablyPublish } from "@/lib/ably-server";

/**
 * PATCH /api/friends/[id]/accept
 *
 * Accept a pending friend request where the current user is the receiver.
 * Emits `friend_request_accepted` to the original sender via socket.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  const userId = session.user.id;

  const [request] = await db
    .select()
    .from(friendRequests)
    .where(eq(friendRequests.id, params.id))
    .limit(1);

  if (!request) {
    return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
  }

  if (request.receiverId !== userId) {
    return errorResponse("You are not the receiver of this request", 403);
  }

  if (request.status !== "pending") {
    return errorResponse(`Request is already ${request.status}`, 409);
  }

  const [updated] = await db
    .update(friendRequests)
    .set({ status: "accepted" })
    .where(and(eq(friendRequests.id, params.id), eq(friendRequests.receiverId, userId)))
    .returning();

  // Notify original sender via Ably
  try {
    const [accepter] = await db
      .select({ name: users.name, tag: users.tag })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (accepter) {
      await ablyPublish(`user:${request.senderId}`, "friend_request_accepted", {
        requestId: params.id,
        friendId: userId,
        friendName: accepter.name,
        friendTag: accepter.tag,
      });
    }
  } catch {
    // Best-effort Ably notification
  }

  return NextResponse.json(updated);
}
