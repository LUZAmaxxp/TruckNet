import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { behaviourReports, users } from "@/db/schema";
import { desc, eq, and, lt, count, gte, sql } from "drizzle-orm";

/**
 * GET /api/admin/behaviour/fleet
 *
 * Fleet-wide behaviour dashboard:
 * - Driver ranking by avg score
 * - Critical events count today
 * - Unreviewed reports count
 * Role: admin only
 */
export async function GET(_req: NextRequest) {
  const session = await requireAuth();
  if (session.user.role !== "admin") return errorResponse("Forbidden", 403);

  // All ready reports
  const allReports = await db
    .select({
      driverId:       behaviourReports.driverId,
      globalScore:    behaviourReports.globalScore,
      criticalEvents: behaviourReports.criticalEvents,
      adminReviewed:  behaviourReports.adminReviewed,
      generatedAt:    behaviourReports.generatedAt,
    })
    .from(behaviourReports)
    .where(eq(behaviourReports.status, "ready"));

  // Per-driver aggregation
  const driverMap = new Map<string, { scores: number[]; totalCritical: number }>();
  for (const r of allReports) {
    const entry = driverMap.get(r.driverId) ?? { scores: [], totalCritical: 0 };
    entry.scores.push(r.globalScore);
    entry.totalCritical += r.criticalEvents;
    driverMap.set(r.driverId, entry);
  }

  // Load driver names
  const driverIds = Array.from(driverMap.keys());
  const driverRows = driverIds.length > 0
    ? await db
        .select({ id: users.id, name: users.name, tag: users.tag, profileImageUrl: users.profileImageUrl })
        .from(users)
        .where(eq(users.role, "driver"))
    : [];
  const driverLookup = new Map(driverRows.map((d) => [d.id, d]));

  const driverRanking = driverIds
    .map((driverId) => {
      const { scores, totalCritical } = driverMap.get(driverId)!;
      const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const driver   = driverLookup.get(driverId);
      return {
        driverId,
        name:            driver?.name ?? "Unknown",
        tag:             driver?.tag  ?? "",
        profileImageUrl: driver?.profileImageUrl ?? null,
        avg_score:       avgScore,
        trip_count:      scores.length,
        total_critical:  totalCritical,
        // Simple trend: last score vs avg
        trend: scores.length > 1
          ? scores[scores.length - 1] - scores[scores.length - 2]
          : 0,
      };
    })
    .sort((a, b) => a.avg_score - b.avg_score); // worst first

  const fleetAvgScore = driverRanking.length > 0
    ? Math.round(driverRanking.reduce((s, d) => s + d.avg_score, 0) / driverRanking.length)
    : null;

  // Critical events today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const criticalToday = allReports.filter(
    (r) => r.generatedAt && r.generatedAt >= todayStart && r.criticalEvents > 0
  ).reduce((s, r) => s + r.criticalEvents, 0);

  const unreviewedReports = allReports.filter(
    (r) => !r.adminReviewed && r.globalScore < 60
  ).length;

  return successResponse({
    drivers:                driverRanking,
    fleet_avg_score:        fleetAvgScore,
    critical_events_today:  criticalToday,
    unreviewed_reports:     unreviewedReports,
  }, 200);
}
