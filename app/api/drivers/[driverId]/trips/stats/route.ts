import type { NextRequest } from "next/server";
import { and, count, eq, gte, isNotNull, lte } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { transportTrips } from "@/db/schema";
import { isUUID } from "@/lib/validate-uuid";

// GHG factors (ADEME Base Carbone 2024) — mirrors lib/driver-esg-aggregator.ts
const GHG_FACTORS: Record<string, number> = {
  diesel: 2.65, petrol: 2.37, lpg: 1.63,
  cng: 2.30, electric: 0, hydrogen: 0, other: 2.65,
};

/**
 * GET /api/drivers/[driverId]/trips/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Lightweight trip summary for a date range — used by the admin to preview
 * available data before generating an ESG report.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { driverId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId)) return errorResponse("Invalid driverId", 400);

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");
  if (!from || !to) return errorResponse("from and to query params are required", 400);

  const startTs = new Date(from);
  const endTs   = new Date(to + "T23:59:59.999Z");
  if (isNaN(startTs.getTime()) || isNaN(endTs.getTime()))
    return errorResponse("Invalid date format (expected YYYY-MM-DD)", 400);

  const trips = await db
    .select({
      fuelLiters: transportTrips.fuelLiters,
      fuelType:   transportTrips.fuelType,
      distanceKm: transportTrips.distanceKm,
      isEmptyRun: transportTrips.isEmptyRun,
      startedAt:  transportTrips.startedAt,
    })
    .from(transportTrips)
    .where(
      and(
        eq(transportTrips.driverId, params.driverId),
        eq(transportTrips.status, "completed"),
        isNotNull(transportTrips.startedAt),
        gte(transportTrips.startedAt, startTs),
        lte(transportTrips.startedAt, endTs),
      )
    );

  const tripCount           = trips.length;
  const totalDistanceKm     = Math.round(trips.reduce((s, t) => s + (t.distanceKm ?? 0), 0) * 10) / 10;
  const totalFuelLiters     = Math.round(trips.reduce((s, t) => s + (t.fuelLiters ?? 0), 0) * 10) / 10;
  const estimatedGhgKgCo2eq = Math.round(
    trips.reduce((s, t) => s + (t.fuelLiters ?? 0) * (GHG_FACTORS[t.fuelType ?? "diesel"] ?? 2.65), 0) * 10
  ) / 10;
  const emptyRunCount = trips.filter((t) => t.isEmptyRun).length;

  // Earliest trip date in period — useful to suggest period_start
  const earliestTrip = trips.reduce<Date | null>((min, t) => {
    if (!t.startedAt) return min;
    return min === null || t.startedAt < min ? t.startedAt : min;
  }, null);

  const [{ count: activeCount }] = await db
    .select({ count: count() })
    .from(transportTrips)
    .where(
      and(
        eq(transportTrips.driverId, params.driverId),
        eq(transportTrips.status, "active"),
      )
    );

  return successResponse(
    {
      tripCount,
      totalDistanceKm,
      totalFuelLiters,
      estimatedGhgKgCo2eq,
      emptyRunCount,
      activeTripsCount: Number(activeCount),
      earliestTripDate: earliestTrip?.toISOString().slice(0, 10) ?? null,
    },
    200
  );
}
