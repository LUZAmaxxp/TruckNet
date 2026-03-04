import { type NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { callHistory, users } from "@/db/schema";


/**
 * GET /api/admin/calls
 *
 * Returns call history for all users with caller and callee names/avatars.
 *
 * Query params:
 *   page   — 1-based (default: 1)
 *   limit  — (default: 25, max: 100)
 *   type   — "voice" | "video" | "all"
 *   status — "ongoing" | "completed" | "missed" | "declined" | "all"
 *
 * Response 200: { calls: CallHistoryAdminEntry[], total: number }
 */
export async function GET(req: NextRequest) {
  await requireAdminSession();

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "25")));
  const typeParam = searchParams.get("type");
  const statusParam = searchParams.get("status");
  const offset = (page - 1) * limit;

  const conditions = [];
  if (typeParam && typeParam !== "all") {
    conditions.push(eq(callHistory.callType, typeParam as "voice" | "video"));
  }
  if (statusParam && statusParam !== "all") {
    conditions.push(
      eq(
        callHistory.status,
        statusParam as "ongoing" | "completed" | "missed" | "declined"
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Parallel: paginated call rows + total count
  const [callRows, [{ count: total }]] = await Promise.all([
    db
      .select({
        id: callHistory.id,
        roomName: callHistory.roomName,
        callerId: callHistory.callerId,
        calleeId: callHistory.calleeId,
        callType: callHistory.callType,
        status: callHistory.status,
        startedAt: callHistory.startedAt,
        endedAt: callHistory.endedAt,
        durationSeconds: callHistory.durationSeconds,
        createdAt: callHistory.createdAt,
      })
      .from(callHistory)
      .where(whereClause)
      .orderBy(desc(callHistory.createdAt))
      .limit(limit)
      .offset(offset),

    db.select({ count: count() }).from(callHistory).where(whereClause),
  ]);

  // Batch-fetch all unique participant user records in one query
  const userIds = Array.from(
    new Set(
      callRows.flatMap((c) =>
        [c.callerId, c.calleeId].filter((id): id is string => id !== null)
      )
    )
  );

  const userMap = new Map<string, { name: string; profileImageUrl: string | null }>();
  if (userIds.length > 0) {
    const userRows = await db
      .select({ id: users.id, name: users.name, profileImageUrl: users.profileImageUrl })
      .from(users)
      .where(inArray(users.id, userIds));

    for (const u of userRows) {
      userMap.set(u.id, { name: u.name, profileImageUrl: u.profileImageUrl });
    }
  }

  const calls = callRows.map((c) => ({
    id: c.id,
    roomName: c.roomName,
    callerId: c.callerId,
    callerName: c.callerId ? (userMap.get(c.callerId)?.name ?? null) : null,
    callerAvatar: c.callerId ? (userMap.get(c.callerId)?.profileImageUrl ?? null) : null,
    calleeId: c.calleeId,
    calleeName: c.calleeId ? (userMap.get(c.calleeId)?.name ?? null) : null,
    calleeAvatar: c.calleeId ? (userMap.get(c.calleeId)?.profileImageUrl ?? null) : null,
    callType: c.callType,
    status: c.status,
    startedAt: c.startedAt?.toISOString() ?? null,
    endedAt: c.endedAt?.toISOString() ?? null,
    durationSeconds: c.durationSeconds,
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ calls, total });
}

