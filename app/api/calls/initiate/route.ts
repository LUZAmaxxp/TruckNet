import type { NextRequest } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-helpers";
import { validateOrThrow } from "@/lib/validate";
import { successResponse, errorResponse } from "@/lib/api";
import { ablyPublish } from "@/lib/ably-server";
import { generateLiveKitToken, getRoomService } from "@/lib/livekit-server";
import { env } from "@/lib/env";
import { db } from "@/db";
import { callHistory, friendRequests, users } from "@/db/schema";

const InitiateCallSchema = z.object({
  calleeId: z.string().uuid({ message: "calleeId must be a valid UUID" }),
  type: z.enum(["voice", "video"]),
});

/**
 * POST /api/calls/initiate
 *
 * Caller initiates a 1-on-1 call with a friend.
 * Rate limited: 5 per minute per user (enforced in middleware.ts).
 *
 * Checks:
 *   1. calleeId is a valid friend of the caller
 *   2. Callee is not already in an ongoing call
 *
 * Actions:
 *   1. Creates a LiveKit room (emptyTimeout: 30s)
 *   2. Inserts call_history row (status: 'ongoing')
 *   3. Notifies callee via Ably: 'call_incoming'
 *   4. Returns { roomName, token } to the caller
 *
 * Response 201: { roomName: string, token: string }
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  const callerId = session.user.id;

  const body: unknown = await req.json();
  const { calleeId, type } = await validateOrThrow(InitiateCallSchema, body);

  if (calleeId === callerId) {
    return errorResponse("Cannot call yourself", 400);
  }

  // ── 1. Verify friendship (skipped for admin users) ────────────────────
  if (session.user.role !== "admin") {
    const friendship = await db
      .select({ id: friendRequests.id })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.status, "accepted"),
          or(
            and(eq(friendRequests.senderId, callerId), eq(friendRequests.receiverId, calleeId)),
            and(eq(friendRequests.senderId, calleeId), eq(friendRequests.receiverId, callerId))
          )
        )
      )
      .limit(1);

    if (friendship.length === 0) {
      return errorResponse("You can only call friends", 403);
    }
  }

  // ── 2. Auto-expire stale "ongoing" calls ──────────────────────────────
  // If the CALLER is initiating a new call they clearly aren't on one —
  // unconditionally expire any ongoing record they appear in.
  // For the CALLEE, verify with LiveKit that the room still has participants.
  // If the room is empty or gone, the call is stale regardless of DB status.
  await db
    .update(callHistory)
    .set({ status: "completed", endedAt: new Date() })
    .where(
      and(
        eq(callHistory.status, "ongoing"),
        or(
          eq(callHistory.callerId, callerId),
          eq(callHistory.calleeId, callerId)
        )
      )
    );

  // Check callee's active calls and verify each room still has participants
  const calleeCalls = await db
    .select({ id: callHistory.id, roomName: callHistory.roomName })
    .from(callHistory)
    .where(
      and(
        eq(callHistory.status, "ongoing"),
        or(eq(callHistory.callerId, calleeId), eq(callHistory.calleeId, calleeId))
      )
    );

  if (calleeCalls.length > 0) {
    const roomService = getRoomService();
    await Promise.all(
      calleeCalls.map(async (call) => {
        try {
          const participants = await roomService.listParticipants(call.roomName);
          if (participants.length === 0) {
            // Room is empty — call ended without hitting the API, clean it up
            await db
              .update(callHistory)
              .set({ status: "completed", endedAt: new Date() })
              .where(eq(callHistory.id, call.id));
          }
        } catch {
          // Room not found in LiveKit — definitely stale
          await db
            .update(callHistory)
            .set({ status: "completed", endedAt: new Date() })
            .where(eq(callHistory.id, call.id));
        }
      })
    );
  }

  // ── 3. Check callee is not already in an active call ───────────────────
  const existingCall = await db
    .select({ id: callHistory.id })
    .from(callHistory)
    .where(
      and(
        eq(callHistory.status, "ongoing"),
        or(eq(callHistory.calleeId, calleeId), eq(callHistory.callerId, calleeId))
      )
    )
    .limit(1);

  if (existingCall.length > 0) {
    return errorResponse("The person you are trying to call is busy", 409);
  }

  // ── 4. Fetch caller info for the Ably notification ────────────────────
  const [callerUser] = await db
    .select({ name: users.name, profileImageUrl: users.profileImageUrl })
    .from(users)
    .where(eq(users.id, callerId))
    .limit(1);

  // ── 5. Create LiveKit room ─────────────────────────────────────────────
  const roomName = `call-${crypto.randomUUID()}`;
  const roomService = getRoomService();
  await roomService.createRoom({
    name: roomName,
    emptyTimeout: 30,
    maxParticipants: 2,
  });

  // ── 6. Generate caller token ───────────────────────────────────────────
  const callerToken = await generateLiveKitToken(
    roomName,
    callerId,
    callerUser?.name ?? "Driver"
  );

  // ── 5b. Pre-generate callee token so the callee doesn't need a second
  //        round-trip to /api/calls/token when they accept the call ────────
  const [calleeUser] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, calleeId))
    .limit(1);

  const calleeToken = await generateLiveKitToken(
    roomName,
    calleeId,
    calleeUser?.name ?? "Driver"
  );

  // ── 7. Persist call_history ────────────────────────────────────────────
  await db.insert(callHistory).values({
    roomName,
    callerId,
    calleeId,
    callType: type,
    status: "ongoing",
  });

  // ── 8. Notify callee via Ably ──────────────────────────────────────────
  await ablyPublish(`user:${calleeId}`, "call_incoming", {
    roomName,
    type,
    callerName: callerUser?.name ?? "A driver",
    callerAvatar: callerUser?.profileImageUrl ?? null,
    callerUserId: callerId,
    liveKitUrl: env.LIVEKIT_URL,
    calleeToken,
  });

  return successResponse({ roomName, token: callerToken, liveKitUrl: env.LIVEKIT_URL }, 201);
}
