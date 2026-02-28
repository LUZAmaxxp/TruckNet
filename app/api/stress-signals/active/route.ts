import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { successResponse } from "@/lib/api";
import { db } from "@/db";
import { stressSignals, users } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { haversineDistanceKm } from "@/lib/haversine";
import { expireStaleStressSignals } from "@/lib/stress-signal-expiry";

/** Maximum distance in kilometres to return signals from. */
const NEARBY_RADIUS_KM = 50;

/** Signals older than this are excluded (belt-and-suspenders alongside DB expiry). */
const WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * GET /api/stress-signals/active
 *
 * Returns all currently 'active' stress signals:
 *   - Within 50 km of the requesting user's last known location
 *   - Created within the last 30 minutes
 *
 * Runs expiry cleanup before querying so stale signals are resolved first.
 * Requires the calling user to have submitted their location via POST /api/drivers/location.
 *
 * Response 200: { signals: Array<{ id, userId, senderName, latitude, longitude, createdAt, distanceKm }> }
 */
export async function GET(_req: NextRequest) {
  const session = await requireAuth();

  // Expire stale signals before reading (on-read pattern)
  await expireStaleStressSignals();

  const windowStart = new Date(Date.now() - WINDOW_MS);

  // Fetch all active signals in the time window, joined with user names
  const activeSignals = await db
    .select({
      id: stressSignals.id,
      userId: stressSignals.userId,
      senderName: users.name,
      latitude: stressSignals.latitude,
      longitude: stressSignals.longitude,
      createdAt: stressSignals.createdAt,
    })
    .from(stressSignals)
    .innerJoin(users, eq(stressSignals.userId, users.id))
    .where(
      and(
        eq(stressSignals.status, "active"),
        gte(stressSignals.createdAt, windowStart)
      )
    );

  // Get caller's own last known location from driver_locations
  const { driverLocations } = await import("@/db/schema");
  const [callerLocation] = await db
    .select({ latitude: driverLocations.latitude, longitude: driverLocations.longitude })
    .from(driverLocations)
    .where(eq(driverLocations.userId, session.user.id));

  if (!callerLocation) {
    // No location on record — return all active signals without radius filter
    return successResponse({ signals: activeSignals.map((s) => ({ ...s, distanceKm: null })) });
  }

  const nearby = activeSignals
    .map((s) => ({
      ...s,
      distanceKm: haversineDistanceKm(
        callerLocation.latitude,
        callerLocation.longitude,
        s.latitude,
        s.longitude
      ),
    }))
    .filter((s) => s.distanceKm <= NEARBY_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return successResponse({ signals: nearby });
}
