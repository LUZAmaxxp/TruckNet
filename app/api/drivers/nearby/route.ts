import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { successResponse } from "@/lib/api";
import { db } from "@/db";
import { driverLocations, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { haversineDistanceKm } from "@/lib/haversine";

/** Maximum distance in kilometres to be considered "nearby". */
const NEARBY_RADIUS_KM = 50;

/** Drivers not updated within this window are considered stale and excluded. */
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/drivers/nearby
 *
 * Returns all active (non-stale) drivers within 50 km of the requesting user.
 * The caller's own location must exist in driver_locations or an empty list
 * is returned (they need to POST /api/drivers/location first).
 *
 * Staleness: driver_locations.updated_at older than 5 minutes is excluded.
 * Radius: Haversine great-circle distance ≤ 50 km.
 *
 * Response 200: { drivers: Array<{ id, name, latitude, longitude, distanceKm }> }
 */
export async function GET(_req: NextRequest) {
  const session = await requireAuth();

  // Fetch all driver locations joined with user names
  const allLocations = await db
    .select({
      id: users.id,
      name: users.name,
      profileImageUrl: users.profileImageUrl,
      latitude: driverLocations.latitude,
      longitude: driverLocations.longitude,
      updatedAt: driverLocations.updatedAt,
    })
    .from(driverLocations)
    .innerJoin(users, eq(driverLocations.userId, users.id));

  // Find caller's own location (must have reported a location previously)
  const callerLocation = allLocations.find((l) => l.id === session.user.id);
  if (!callerLocation) {
    return successResponse({ drivers: [] });
  }

  const now = Date.now();

  const nearby = allLocations
    .filter((l) => l.id !== session.user.id) // exclude self
    .filter((l) => now - new Date(l.updatedAt).getTime() < STALE_THRESHOLD_MS) // fresh only
    .map((l) => ({
      id: l.id,
      name: l.name,
      profileImageUrl: l.profileImageUrl,
      latitude: l.latitude,
      longitude: l.longitude,
      distanceKm: haversineDistanceKm(
        callerLocation.latitude,
        callerLocation.longitude,
        l.latitude,
        l.longitude
      ),
    }))
    .filter((l) => l.distanceKm <= NEARBY_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm); // nearest first

  return successResponse({ drivers: nearby });
}
