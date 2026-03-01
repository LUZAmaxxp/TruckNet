import { type NextRequest, NextResponse } from "next/server";
import { and, asc, eq, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { textMessages, users } from "@/db/schema";
import { errorResponse } from "@/lib/api";
import { ablyPublish } from "@/lib/ably-server";
import { assertIsUUID } from "@/lib/validate-uuid";
import { z } from "zod";

const SendTextSchema = z.object({
  receiverId: z.string().uuid({ message: "receiverId must be a valid UUID" }),
  content: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
});

/**
 * GET /api/text-messages?friendId=<uuid>
 *
 * Returns the full conversation between the current user and the specified friend,
 * ordered chronologically (oldest first).
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth();
  const userId = session.user.id;

  const friendId = req.nextUrl.searchParams.get("friendId");
  if (!friendId) return errorResponse("friendId query param is required", 400);

  try {
    assertIsUUID(friendId, "friendId");
  } catch {
    return errorResponse("friendId must be a valid UUID", 400);
  }

  const rows = await db
    .select({
      id: textMessages.id,
      senderId: textMessages.senderId,
      senderName: users.name,
      content: textMessages.content,
      status: textMessages.status,
      createdAt: textMessages.createdAt,
    })
    .from(textMessages)
    .innerJoin(users, eq(users.id, textMessages.senderId))
    .where(
      or(
        and(eq(textMessages.senderId, userId), eq(textMessages.receiverId, friendId)),
        and(eq(textMessages.senderId, friendId), eq(textMessages.receiverId, userId))
      )
    )
    .orderBy(asc(textMessages.createdAt));

  return NextResponse.json({ messages: rows });
}

/**
 * POST /api/text-messages
 * Body: { receiverId: string (UUID), content: string }
 *
 * Inserts a text message and pushes a real-time notification to the receiver
 * via Ably channel "user:<receiverId>".
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Request body must be JSON", 400);
  }

  const parsed = SendTextSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0]?.message ?? "Invalid input", 400);
  }

  const { receiverId, content } = parsed.data;

  if (receiverId === userId) {
    return errorResponse("Cannot send a message to yourself", 400);
  }

  // Fetch sender name for the real-time payload
  const [sender] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [message] = await db
    .insert(textMessages)
    .values({ senderId: userId, receiverId, content })
    .returning();

  // Real-time notification — best-effort, do not fail the response
  try {
    await ablyPublish(`user:${receiverId}`, "text_message_received", {
      id: message!.id,
      senderId: userId,
      senderName: sender?.name ?? "Driver",
      content,
      createdAt: message!.createdAt,
    });
  } catch (err) {
    console.error("[text-messages] Ably publish failed:", err);
  }

  return NextResponse.json(message, { status: 201 });
}
