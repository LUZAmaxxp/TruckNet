import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { transportTrips, gpsTracks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isUUID } from "@/lib/validate-uuid";
import { classifyGpsUpdate } from "@/lib/behaviour/gps-classifier";
import { loadScoringConfig } from "@/lib/behaviour/score-calculator";
import { ablyPublish } from "@/lib/ably-server";

const GpsUpdateSchema = z.object({
  lat:         z.number().min(-90).max(90),
  lng:         z.number().min(-180).max(180),
  speed_kmh:   z.number().nonnegative(),
  heading_deg: z.number().optional(),
  accuracy_m:  z.number().nonnegative().optional(),
  timestamp:   z.number().positive(), // epoch ms
});

/**
 * POST /api/drivers/[driverId]/trips/[tripId]/gps
 *
 * GPS position update from cab laptop / GPS module.
 * - Stores position in gps_tracks
 * - Runs GPS behaviour classifier (speed / idle / harsh braking)
 * - Publishes live position to Ably for admin map
 *
 * Auth: calling user must be the trip's owner (driver) or admin.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { driverId: string; tripId: string } }
) {
  const session = await requireAuth();
  const { driverId, tripId } = params;

  if (!isUUID(driverId) || !isUUID(tripId))
    return errorResponse("Invalid ID", 400);

  // Drivers can only post their own GPS; admins can post for any driver
  if (session.user.role !== "admin" && session.user.id !== driverId)
    return errorResponse("Forbidden", 403);

  const body = await req.json().catch(() => null);
  const parsed = GpsUpdateSchema.safeParse(body);
  if (!parsed.success)
    return errorResponse("Validation failed", 400, parsed.error.issues);

  const d = parsed.data;

  // Verify trip belongs to driver and is active
  const [trip] = await db
    .select({ id: transportTrips.id, status: transportTrips.status })
    .from(transportTrips)
    .where(and(eq(transportTrips.id, tripId), eq(transportTrips.driverId, driverId)))
    .limit(1);

  if (!trip) return errorResponse("Trip not found", 404);
  if (trip.status !== "active") return errorResponse("Trip is not active", 409);

  // Store GPS track point
  await db.insert(gpsTracks).values({
    tripId,
    driverId,
    lat:        d.lat,
    lng:        d.lng,
    speedKmh:   d.speed_kmh,
    headingDeg: d.heading_deg ?? null,
    accuracyM:  d.accuracy_m  ?? null,
    recordedAt: new Date(d.timestamp),
  });

  // Classify for behaviour events (fire-and-forget — don't block the response)
  void (async () => {
    try {
      const config = await loadScoringConfig();
      await classifyGpsUpdate(
        { driverId, tripId, lat: d.lat, lng: d.lng, speedKmh: d.speed_kmh, timestamp: d.timestamp },
        config
      );
    } catch (err) {
      console.error("[GPS route] Classifier error:", err);
    }
  })();

  // Publish live GPS to admin dashboard map
  void ablyPublish(`trips:${tripId}`, "gps_update", {
    driverId,
    tripId,
    lat:       d.lat,
    lng:       d.lng,
    speedKmh:  d.speed_kmh,
    heading:   d.heading_deg,
    timestamp: d.timestamp,
  });

  return successResponse({ received: true }, 200);
}
