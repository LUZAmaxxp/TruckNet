import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { drivingEvents, transportTrips } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isUUID } from "@/lib/validate-uuid";

/**
 * GET /api/drivers/[driverId]/trips/[tripId]/behaviour/events
 * Query params: ?type, ?severity, ?source
 * Role: admin | driver (own trip only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { driverId: string; tripId: string } }
) {
  const session = await requireAuth();
  const { driverId, tripId } = params;

  if (!isUUID(driverId) || !isUUID(tripId))
    return errorResponse("Invalid ID", 400);

  if (session.user.role !== "admin" && session.user.id !== driverId)
    return errorResponse("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  const filterType     = searchParams.get("type");
  const filterSeverity = searchParams.get("severity");
  const filterSource   = searchParams.get("source");

  // Verify trip belongs to driver
  const [trip] = await db
    .select({ id: transportTrips.id })
    .from(transportTrips)
    .where(and(eq(transportTrips.id, tripId), eq(transportTrips.driverId, driverId)))
    .limit(1);

  if (!trip) return errorResponse("Trip not found", 404);

  const allEvents = await db
    .select()
    .from(drivingEvents)
    .where(eq(drivingEvents.tripId, tripId));

  const filtered = allEvents.filter((e) => {
    if (filterType     && e.eventType !== filterType)     return false;
    if (filterSeverity && e.severity  !== filterSeverity) return false;
    if (filterSource   && e.source    !== filterSource)   return false;
    return true;
  });

  // Count by type for summary
  const countsByType: Record<string, number> = {};
  for (const e of allEvents) {
    countsByType[e.eventType] = (countsByType[e.eventType] ?? 0) + 1;
  }

  return successResponse({ events: filtered, counts_by_type: countsByType }, 200);
}
