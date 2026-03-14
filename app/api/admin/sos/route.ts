import { type NextRequest, NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { stressSignals, users } from "@/db/schema";

/**
 * GET /api/admin/sos
 *
 * Returns all SOS alerts with sender info. Supports filtering by status.
 *
 * Query params:
 *   status — "active" | "resolved" | "all" (default: "all")
 *   page   — 1-based (default: 1)
 *   limit  — results per page (default: 20, max: 100)
 *
 * Response 200: { alerts: SosAdminEntry[], total: number, activeCount: number }
 */
export async function GET(req: NextRequest) {
  await requireAdminSession();

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
  const offset = (page - 1) * limit;

  const statusCondition =
    status === "active"
      ? eq(stressSignals.status, "active")
      : status === "resolved"
      ? eq(stressSignals.status, "resolved")
      : undefined;

  const whereClause = statusCondition ?? undefined;

  const [rows, [{ count: total }], [{ count: activeCount }]] = await Promise.all([
    db
      .select({
        id: stressSignals.id,
        userId: stressSignals.userId,
        senderName: users.name,
        senderTag: users.tag,
        senderAvatar: users.profileImageUrl,
        latitude: stressSignals.latitude,
        longitude: stressSignals.longitude,
        status: stressSignals.status,
        createdAt: stressSignals.createdAt,
      })
      .from(stressSignals)
      .innerJoin(users, eq(users.id, stressSignals.userId))
      .where(whereClause)
      .orderBy(desc(stressSignals.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ count: count() })
      .from(stressSignals)
      .where(whereClause),

    db
      .select({ count: count() })
      .from(stressSignals)
      .where(eq(stressSignals.status, "active")),
  ]);

  return NextResponse.json({ alerts: rows, total, activeCount });
}
