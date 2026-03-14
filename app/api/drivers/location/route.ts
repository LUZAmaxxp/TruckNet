import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { validateOrThrow } from "@/lib/validate";
import { successResponse } from "@/lib/api";
import { LocationUpdateSchema } from "@/schemas/location.schema";
import { db } from "@/db";
import { driverLocations, users, driverRoutes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { setDriverLocation, getAllDriverLocations } from "@/sockets/store/location.store";
import { haversineDistanceKm } from "@/lib/haversine";
import { ablyPublish } from "@/lib/ably-server";
import { getSpeedLimit } from "@/lib/behaviour/speed-limit-lookup";
import { safeGet, safeSet } from "@/lib/redis";

/** Maximum distance in kilometres considered "nearby". */
const NEARBY_RADIUS_KM = 50;

/** Location entries older than this are excluded from the nearby list. */
const STALE_THRESHOLD_MS = 5 * 60 * 1_000; // 5 minutes

/**
 * POST /api/drivers/location
 *
 * 1. Upserts the caller's GPS coordinates to the database.
 * 2. Populates the in-memory location store (used for sub-ms nearby queries).
 * 3. Computes a personalised nearby-driver list for the caller.
 * 4. Publishes it to the caller's private Ably channel so their dashboard
 *    updates in real-time without polling.
 *
 * Body: { latitude: number, longitude: number }
 * Response 200: { latitude, longitude }
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  const userId = session.user.id;

  const body: unknown = await req.json();
  const { latitude, longitude } = await validateOrThrow(LocationUpdateSchema, body);


  // ── 1. Upsert to DB ─────────────────────────────────────────────────────
  const updated = await db
    .update(driverLocations)
    .set({ latitude, longitude, updatedAt: new Date() })
    .where(eq(driverLocations.userId, userId))
    .returning({ id: driverLocations.id });

  if (updated.length === 0) {
    await db.insert(driverLocations).values({ userId, latitude, longitude });
  }

  // ── 2. Fetch profile for store entry ────────────────────────────────────
  const [profile] = await db
    .select({ name: users.name, profileImageUrl: users.profileImageUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // ── 3. Update in-memory store ───────────────────────────────────────────
  setDriverLocation(userId, {
    latitude,
    longitude,
    updatedAt: new Date(),
    name: profile?.name ?? null,
    profileImageUrl: profile?.profileImageUrl ?? null,
  });

  // ── 4. Compute personalised nearby list ─────────────────────────────────
  const now = Date.now();
  const allLocations = getAllDriverLocations();

  const nearbyDrivers = allLocations
    .filter((d) => d.userId !== userId)
    .filter((d) => now - d.updatedAt.getTime() < STALE_THRESHOLD_MS)
    .map((d) => ({
      userId:         d.userId,
      name:           d.name,
      profileImageUrl: d.profileImageUrl,
      latitude:       d.latitude,
      longitude:      d.longitude,
      updatedAt:      d.updatedAt,
      distanceKm:     haversineDistanceKm(latitude, longitude, d.latitude, d.longitude),
    }))
    .filter((d) => d.distanceKm <= NEARBY_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);


  // ── 5. Publish to caller's private Ably channel ──────────────────────────
  try {
    await ablyPublish(`user:${userId}`, "nearby_driver_update", nearbyDrivers);
  } catch (err) {
    console.error("[location] Ably publish failed:", err);
  }

  // ── 6. Broadcast to fleet:locations for admin real-time map ─────────────
  try {
    await ablyPublish("fleet:locations", "driver_location_updated", {
      userId,
      name: profile?.name ?? null,
      profileImageUrl: profile?.profileImageUrl ?? null,
      latitude,
      longitude,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[location] Fleet channel Ably publish failed:", err);
  }

  // ── 7. Auto-arrival: mark route complete if within 300 m of destination ──
  try {
    const [activeRoute] = await db
      .select({
        id: driverRoutes.id,
        destinationLat: driverRoutes.destinationLat,
        destinationLng: driverRoutes.destinationLng,
      })
      .from(driverRoutes)
      .where(and(eq(driverRoutes.driverId, userId), eq(driverRoutes.status, "active")))
      .limit(1);

    if (activeRoute) {
      const distKm = haversineDistanceKm(
        latitude,
        longitude,
        activeRoute.destinationLat,
        activeRoute.destinationLng
      );

      if (distKm <= 0.3) {
        await db
          .update(driverRoutes)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(driverRoutes.id, activeRoute.id));

        await ablyPublish("fleet:locations", "driver_route_cleared", {
          driverId: userId,
          reason: "arrived",
        });

        console.log(`[location] Auto-arrival: route ${activeRoute.id} completed for driver ${userId}`);
      }
    }
  } catch (err) {
    // Non-critical — location update still succeeds even if route check fails
    console.error("[location] Auto-arrival check failed:", err);
  }

  // ── 8. Speed limit update (browser GPS fallback) ────────────────────────────
  // Only resolve + publish when the driver moves >50 m from the last gate point.
  // The Redis gate (TTL 60 s) also acts as a debounce so we don’t call Overpass
  // on every 20-second heartbeat when the driver is stationary.
  try {
    const gateKey  = `speed_limit_gate:${userId}`;
    const gateRaw  = await safeGet(gateKey);
    let shouldPublish = true;

    if (gateRaw) {
      const gate = JSON.parse(gateRaw) as { lat: number; lng: number };
      const movedKm = haversineDistanceKm(latitude, longitude, gate.lat, gate.lng);
      if (movedKm < 0.05) shouldPublish = false; // < 50 m → skip
    }

    if (shouldPublish) {
      const speedLimitKmh = await getSpeedLimit(latitude, longitude);
      await safeSet(gateKey, JSON.stringify({ lat: latitude, lng: longitude }), 60);
      await ablyPublish(`user:${userId}`, "speed_limit_update", {
        speedLimitKmh,
        currentSpeedKmh: 0,   // browser coords.speed is unreliable; worker provides real speed
        isOverSpeeding:  false,
        roadName:        null,
        lat:             latitude,
        lng:             longitude,
        timestamp:       new Date().toISOString(),
      });
    }
  } catch (err) {
    // Non-critical
    console.error("[location] Speed limit lookup failed:", err);
  }

  return successResponse({ latitude, longitude }, 200);
}
