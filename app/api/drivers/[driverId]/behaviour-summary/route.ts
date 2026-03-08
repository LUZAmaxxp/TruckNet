import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { behaviourReports, transportTrips } from "@/db/schema";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { isUUID } from "@/lib/validate-uuid";

/**
 * GET /api/drivers/[driverId]/behaviour-summary
 * Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns aggregated behaviour stats for a driver over a time period.
 * Role: admin | driver (own only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { driverId: string } }
) {
  const session  = await requireAuth();
  const { driverId } = params;

  if (!isUUID(driverId)) return errorResponse("Invalid driver ID", 400);

  if (session.user.role !== "admin" && session.user.id !== driverId)
    return errorResponse("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  // Get all completed trips in range for this driver
  const tripsQuery = db
    .select({ id: transportTrips.id, startedAt: transportTrips.startedAt })
    .from(transportTrips)
    .where(
      and(
        eq(transportTrips.driverId, driverId),
        eq(transportTrips.status,   "completed"),
      )
    );

  const trips = await tripsQuery;

  const tripIds = trips
    .filter((t) => {
      if (!t.startedAt) return false;
      const d = t.startedAt;
      if (from && d < new Date(from)) return false;
      if (to   && d > new Date(to + "T23:59:59Z")) return false;
      return true;
    })
    .map((t) => t.id);

  if (tripIds.length === 0) {
    return successResponse({
      avg_score:            null,
      trend:                [],
      total_events_by_type: {},
      worst_trip:           null,
      best_trip:            null,
      total_reports:        0,
    }, 200);
  }

  // Get all reports for those trips
  const reports = await db
    .select()
    .from(behaviourReports)
    .where(eq(behaviourReports.driverId, driverId));

  const periodReports = reports.filter((r) => tripIds.includes(r.tripId));

  if (periodReports.length === 0) {
    return successResponse({
      avg_score:            null,
      trend:                [],
      total_events_by_type: {},
      worst_trip:           null,
      best_trip:            null,
      total_reports:        0,
    }, 200);
  }

  const avgScore = Math.round(
    periodReports.reduce((sum, r) => sum + r.globalScore, 0) / periodReports.length
  );

  // Trend: chronological scores
  const trend = periodReports
    .sort((a, b) => (a.generatedAt?.getTime() ?? 0) - (b.generatedAt?.getTime() ?? 0))
    .map((r) => r.globalScore);

  // Event totals
  const totals = {
    speed_violation:   periodReports.reduce((s, r) => s + r.speedViolationCount, 0),
    harsh_braking:     periodReports.reduce((s, r) => s + r.harshBrakingCount, 0),
    harsh_acceleration: periodReports.reduce((s, r) => s + r.harshAccelerationCount, 0),
    sudden_swerve:     periodReports.reduce((s, r) => s + r.suddenSwerveCount, 0),
    drowsiness_alert:  periodReports.reduce((s, r) => s + r.drowsinessAlertCount, 0),
    microsleep_alert:  periodReports.reduce((s, r) => s + r.microsleepAlertCount, 0),
    distraction_alert: periodReports.reduce((s, r) => s + r.distractionAlertCount, 0),
    idle_excess:       periodReports.reduce((s, r) => s + r.idleExcessCount, 0),
    sos_triggered:     periodReports.reduce((s, r) => s + r.sosCount, 0),
  };

  const worst = periodReports.reduce((a, b) => a.globalScore < b.globalScore ? a : b);
  const best  = periodReports.reduce((a, b) => a.globalScore > b.globalScore ? a : b);

  return successResponse({
    avg_score:            avgScore,
    trend,
    total_events_by_type: totals,
    worst_trip:           { tripId: worst.tripId, score: worst.globalScore },
    best_trip:            { tripId: best.tripId,  score: best.globalScore  },
    total_reports:        periodReports.length,
  }, 200);
}
