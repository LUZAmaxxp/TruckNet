import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { validateOrThrow } from "@/lib/validate";
import { successResponse } from "@/lib/api";
import { VoiceMessageSchema } from "@/schemas/voice.schema";
import { db } from "@/db";
import { voiceMessages, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * POST /api/voice-messages
 *
 * Persists a new voice message from the authenticated sender.
 * Status is set to 'delivered' on creation.
 *
 * Body: { receiverId: UUID, audioUrl: URL, durationSeconds: number (≤60) }
 * Response 201: VoiceMessage row
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const body: unknown = await req.json();
  const { receiverId, audioUrl, durationSeconds } = await validateOrThrow(
    VoiceMessageSchema,
    body
  );

  const [message] = await db
    .insert(voiceMessages)
    .values({
      senderId: session.user.id,
      receiverId,
      audioUrl,
      durationSeconds,
      status: "delivered",
    })
    .returning();

  return successResponse(message, 201);
}

/**
 * GET /api/voice-messages
 *
 * Returns the inbox for the authenticated user — all voice messages where
 * receiver_id = session.user.id, ordered newest first.
 *
 * Response 200: { messages: Array<{ id, senderId, senderName, audioUrl, durationSeconds, status, createdAt }> }
 */
export async function GET(_req: NextRequest) {
  const session = await requireAuth();

  const inbox = await db
    .select({
      id: voiceMessages.id,
      senderId: voiceMessages.senderId,
      senderName: users.name,
      audioUrl: voiceMessages.audioUrl,
      durationSeconds: voiceMessages.durationSeconds,
      status: voiceMessages.status,
      createdAt: voiceMessages.createdAt,
    })
    .from(voiceMessages)
    .innerJoin(users, eq(voiceMessages.senderId, users.id))
    .where(eq(voiceMessages.receiverId, session.user.id))
    .orderBy(desc(voiceMessages.createdAt));

  return successResponse({ messages: inbox });
}
