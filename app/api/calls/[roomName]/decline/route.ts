import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api";
import { ablyPublish } from "@/lib/ably-server";
import { getRoomService } from "@/lib/livekit-server";
import { db } from "@/db";
import { callHistory } from "@/db/schema";

/**
 * PATCH /api/calls/[roomName]/decline
 *
 * Callee declines an incoming call.
 *
 * Actions:
 *   1. Verifies session user is the callee
 *   2. Updates call_history: status='declined'
 *   3. Deletes the LiveKit room
 *   4. Notifies the caller via Ably: 'call_declined'
 *
 * Response 200: { ok: true }
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  const session = await requireAuth();
  const calleeId = session.user.id;
  const { roomName } = await params;

  // ── 1. Fetch the call record ───────────────────────────────────────────
  const [call] = await db
    .select()
    .from(callHistory)
    .where(
      and(
        eq(callHistory.roomName, roomName),
        eq(callHistory.status, "ongoing")
      )
    )
    .limit(1);

  if (!call) {
    return errorResponse("Call not found or already ended", 404);
  }

  if (call.calleeId !== calleeId) {
    return errorResponse("Only the callee can decline this call", 403);
  }

  // ── 2. Update status ───────────────────────────────────────────────────
  // startedAt is always null for declined calls (never answered) — safe fallback 0.
  await db
    .update(callHistory)
    .set({ status: "declined", endedAt: new Date(), durationSeconds: 0 })
    .where(eq(callHistory.roomName, roomName));

  // ── 3. Delete LiveKit room ─────────────────────────────────────────────
  try {
    await getRoomService().deleteRoom(roomName);
  } catch {
    // Room may have expired already — not fatal
  }

  // ── 4. Notify caller ──────────────────────────────────────────────────
  if (call.callerId) {
    await ablyPublish(`user:${call.callerId}`, "call_declined", { roomName });
  }

  return successResponse({ ok: true });
}
