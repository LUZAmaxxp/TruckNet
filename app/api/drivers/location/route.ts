import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { validateOrThrow } from "@/lib/validate";
import { successResponse } from "@/lib/api";
import { LocationUpdateSchema } from "@/schemas/location.schema";
import { db } from "@/db";
import { driverLocations, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { setDriverLocation, getAllDriverLocations } from "@/sockets/store/location.store";
import { haversineDistanceKm } from "@/lib/haversine";
import { ablyPublish } from "@/lib/ably-server";

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

  console.log(`[location] POST userId=${userId} lat=${latitude} lon=${longitude}`);

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
    .filter((d) => {
      const keep = d.distanceKm <= NEARBY_RADIUS_KM;
      console.log(
        `[location] → candidate ${d.userId} dist=${d.distanceKm.toFixed(2)}km ${
          keep ? "INCLUDED" : "FILTERED"
        }`
      );
      return keep;
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  console.log(
    `[location] publishing nearby_driver_update to user:${userId} — ${
      nearbyDrivers.length
    } driver(s) (store total=${allLocations.length})`
  );

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

  return successResponse({ latitude, longitude }, 200);
}
