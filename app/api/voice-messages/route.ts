import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api";
import { env } from "@/lib/env";
import { db } from "@/db";
import { voiceMessages, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { TagInputSchema } from "@/schemas/tag.schema";
import { assertIsUUID } from "@/lib/validate-uuid";
import { NextResponse } from "next/server";
import { ablyPublish } from "@/lib/ably-server";

/**
 * External HTTP input schema — accepts EITHER a resolved UUID (receiverId)
 * OR a tag string that the API resolves internally.
 * This separation ensures UUID columns never receive raw tag input.
 */
const VoiceMessageHTTPInputSchema = z
  .object({
    tag: TagInputSchema.optional(),
    receiverId: z.string().uuid({ message: "receiverId must be a valid UUID" }).optional(),
    audioUrl: z.string().url({ message: "audioUrl must be a valid URL" }),
    durationSeconds: z
      .number({ required_error: "durationSeconds is required" })
      .max(60, { message: "Voice message duration cannot exceed 60 seconds" }),
  })
  .refine((d) => d.tag ?? d.receiverId, {
    message: "Either tag or receiverId is required",
  });

/** Validates that an audioUrl points to our own uploads endpoint (prevents SSRF/exfiltration). */
function isOwnAudioUrl(url: string): boolean {
  const base = env.NEXTAUTH_URL.replace(/\/$/, "");
  return url.startsWith(`${base}/api/uploads/`);
}

/**
 * POST /api/voice-messages
 *
 * Persists a new voice message from the authenticated sender.
 * Accepts { tag, audioUrl, durationSeconds } or { receiverId (UUID), audioUrl, durationSeconds }.
 * If tag is supplied the API resolves it to a UUID before any DB operation.
 *
 * Response 201: VoiceMessage row
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const rawBody: unknown = await req.json();
  const parsed = VoiceMessageHTTPInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse(
      parsed.error.errors[0]?.message ?? "Invalid request body",
      400
    );
  }

  const { tag, audioUrl, durationSeconds } = parsed.data;

  // Reject audioUrls that don't point to our own upload endpoint
  if (!isOwnAudioUrl(audioUrl)) {
    return errorResponse("audioUrl must point to the application's own upload endpoint", 400);
  }

  let receiverUUID: string;

  if (tag) {
    // Resolve tag → UUID — never pass tag string into UUID DB column
    const [found] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.tag, tag))
      .limit(1);

    if (!found) {
      return NextResponse.json({ error: "User not found with that tag" }, { status: 404 });
    }

    // Defensive UUID guard (Agent D)
    assertIsUUID(found.id, "receiver.id");
    receiverUUID = found.id;
  } else {
    // receiverId already validated as UUID by Zod above
    assertIsUUID(parsed.data.receiverId, "receiverId");
    receiverUUID = parsed.data.receiverId as string;
  }

  const [message] = await db
    .insert(voiceMessages)
    .values({
      senderId: session.user.id,
      receiverId: receiverUUID,
      audioUrl,
      durationSeconds,
      status: "delivered",
    })
    .returning();

  // Notify receiver in real-time via their private Ably channel
  try {
    await ablyPublish(`user:${receiverUUID}`, "voice_message_received", {
      id:              message.id,
      senderId:        message.senderId,
      senderName:      session.user.name,
      audioUrl:        message.audioUrl,
      durationSeconds: message.durationSeconds,
      createdAt:       message.createdAt,
    });
  } catch (err) {
    console.error("[voice-messages] Ably publish failed:", err);
  }

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
