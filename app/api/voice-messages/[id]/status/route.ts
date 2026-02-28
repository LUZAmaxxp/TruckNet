import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { voiceMessages } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/voice-messages/[id]/status
 *
 * Marks a received voice message as 'listened'.
 * Enforces receiver ownership — only the intended receiver may call this endpoint.
 *
 * Returns 404 if the message does not exist.
 * Returns 403 if the authenticated user is not the receiver.
 * Returns 200 with the updated row on success.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  const { id } = params;

  const [message] = await db
    .select()
    .from(voiceMessages)
    .where(eq(voiceMessages.id, id));

  if (!message) {
    return errorResponse("Voice message not found", 404);
  }

  if (message.receiverId !== session.user.id) {
    return errorResponse(
      "Forbidden — only the message receiver may mark it as listened",
      403
    );
  }

  if (message.status === "listened") {
    // Idempotent — already listened, return current state without a DB write
    return successResponse(message);
  }

  const [updated] = await db
    .update(voiceMessages)
    .set({ status: "listened" })
    .where(eq(voiceMessages.id, id))
    .returning();

  return successResponse(updated);
}
