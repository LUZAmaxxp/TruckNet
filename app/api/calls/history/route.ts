import type { NextRequest } from "next/server";
import { desc, eq, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { successResponse } from "@/lib/api";
import { db } from "@/db";
import { callHistory, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";

/**
 * GET /api/calls/history
 *
 * Returns paginated call history for the current user (caller or callee).
 * Each entry includes the other participant's name + avatar.
 *
 * Query params:
 *   ?page=1   (1-based, default: 1)
 *   ?limit=20 (default: 20, max: 50)
 *
 * Response 200: { calls: CallHistoryEntry[], total: number }
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth();
  const userId = session.user.id;

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "20")));
  const offset = (page - 1) * limit;

  // Aliases for the two participant joins
  const callerUser = alias(users, "caller_user");
  const calleeUser = alias(users, "callee_user");

  const rows = await db
    .select({
      id: callHistory.id,
      roomName: callHistory.roomName,
      callType: callHistory.callType,
      status: callHistory.status,
      startedAt: callHistory.startedAt,
      endedAt: callHistory.endedAt,
      durationSeconds: callHistory.durationSeconds,
      createdAt: callHistory.createdAt,
      callerId: callHistory.callerId,
      calleeId: callHistory.calleeId,
      callerName: callerUser.name,
      callerAvatar: callerUser.profileImageUrl,
      calleeName: calleeUser.name,
      calleeAvatar: calleeUser.profileImageUrl,
    })
    .from(callHistory)
    .leftJoin(callerUser, eq(callHistory.callerId, callerUser.id))
    .leftJoin(calleeUser, eq(callHistory.calleeId, calleeUser.id))
    .where(
      or(
        eq(callHistory.callerId, userId),
        eq(callHistory.calleeId, userId)
      )
    )
    .orderBy(desc(callHistory.createdAt))
    .limit(limit)
    .offset(offset);

  // Total count (approximate — full count scan for simplicity)
  const countRows = await db
    .select({ id: callHistory.id })
    .from(callHistory)
    .where(
      or(
        eq(callHistory.callerId, userId),
        eq(callHistory.calleeId, userId)
      )
    );

  return successResponse({ calls: rows, total: countRows.length });
}
