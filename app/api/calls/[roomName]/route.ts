import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api";
import { ablyPublish } from "@/lib/ably-server";
import { getRoomService } from "@/lib/livekit-server";
import { toDate } from "@/lib/utils";
import { db } from "@/db";
import { callHistory } from "@/db/schema";

/**
 * DELETE /api/calls/[roomName]
 *
 * End an active call. Either participant (caller or callee) can call this.
 *
 * Actions:
 *   1. Deletes the LiveKit room
 *   2. Updates call_history: status='completed', ended_at=now(), duration_seconds computed
 *   3. Notifies the other participant via Ably: 'call_ended'
 *
 * Response 200: { ok: true, durationSeconds: number | null }
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  const session = await requireAuth();
  const userId = session.user.id;
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

  // ── 2. Authorise: only caller or callee can end the call ───────────────
  if (call.callerId !== userId && call.calleeId !== userId) {
    return errorResponse("Forbidden", 403);
  }

  const otherId = call.callerId === userId ? call.calleeId : call.callerId;

  // ── 3. Compute duration ────────────────────────────────────────────────
  const endedAt = new Date();
  // Drizzle returns timestamptz as an ISO string, not a Date object —
  // always coerce before calling Date methods.
  const startedAt = toDate(call.startedAt);
  const durationSeconds = startedAt
    ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
    : 0; // safe fallback when the call was never fully joined

  // ── 4. Delete LiveKit room ─────────────────────────────────────────────
  try {
    await getRoomService().deleteRoom(roomName);
  } catch {
    // Room may have already been deleted (e.g. emptyTimeout) — not fatal
  }

  // ── 5. Update call_history ─────────────────────────────────────────────
  await db
    .update(callHistory)
    .set({ status: "completed", endedAt, durationSeconds })
    .where(eq(callHistory.roomName, roomName));

  // ── 6. Notify the other participant ───────────────────────────────────
  if (otherId) {
    await ablyPublish(`user:${otherId}`, "call_ended", {
      roomName,
      duration: durationSeconds,
    });
  }

  return successResponse({ ok: true, durationSeconds });
}
