import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { validateOrThrow } from "@/lib/validate";
import { errorResponse, successResponse } from "@/lib/api";
import { RouteSetSchema } from "@/schemas/route.schema";
import { formatDistance, formatDuration, computeEta, formatEta } from "@/lib/osrm";
import { fetchRouteWithCache } from "@/lib/route-cache";
import { ablyPublish } from "@/lib/ably-server";
import { db } from "@/db";
import { driverRoutes, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// GET /api/drivers/route
// Returns the calling driver's active route (if any).
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await requireAuth();
  const driverId = session.user.id;

  const [route] = await db
    .select()
    .from(driverRoutes)
    .where(and(eq(driverRoutes.driverId, driverId), eq(driverRoutes.status, "active")))
    .limit(1);

  if (!route) {
    return successResponse({ route: null }, 200);
  }

  const elapsed = (Date.now() - new Date(route.createdAt).getTime()) / 1000;
  const remaining = Math.max(0, route.durationSeconds - elapsed);
  const etaIso = computeEta(remaining);

  return successResponse(
    {
      route: {
        ...route,
        createdAt: route.createdAt.toISOString(),
        completedAt: route.completedAt?.toISOString() ?? null,
        distanceLabel: formatDistance(route.distanceMeters),
        durationLabel: formatDuration(route.durationSeconds),
        etaIso,
        etaLabel: formatEta(etaIso),
      },
    },
    200
  );
}

// ---------------------------------------------------------------------------
// POST /api/drivers/route
// Computes an OSRM route and saves it (or previews without saving).
// ?preview=true — returns route data without writing to DB or publishing Ably.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  const driverId = session.user.id;

  const { searchParams } = new URL(req.url);
  const preview = searchParams.get("preview") === "true";

  const body: unknown = await req.json();
  const input = await validateOrThrow(RouteSetSchema, body);

  // Fetch route via cache → OSRM (server-side only)
  let osrmResult;
  try {
    osrmResult = await fetchRouteWithCache(
      input.originLat,
      input.originLng,
      input.destinationLat,
      input.destinationLng
    );
  } catch (err) {
    console.error("[route] OSRM error:", err);
    return errorResponse("Could not compute route. Please try again.", 502);
  }

  const distanceLabel = formatDistance(osrmResult.distanceMeters);
  const durationLabel = formatDuration(osrmResult.durationSeconds);
  const etaIso = computeEta(osrmResult.durationSeconds);
  const etaLabel = formatEta(etaIso);

  // Preview mode — return without persisting
  if (preview) {
    return successResponse(
      {
        preview: true,
        originLat: input.originLat,
        originLng: input.originLng,
        destinationLat: input.destinationLat,
        destinationLng: input.destinationLng,
        destinationLabel: input.destinationLabel,
        routeGeometry: osrmResult.coordinates,
        distanceMeters: osrmResult.distanceMeters,
        durationSeconds: osrmResult.durationSeconds,
        distanceLabel,
        durationLabel,
        etaIso,
        etaLabel,
      },
      200
    );
  }

  // Cancel any existing active route for this driver
  await db
    .update(driverRoutes)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(and(eq(driverRoutes.driverId, driverId), eq(driverRoutes.status, "active")));

  // Insert new route
  const [newRoute] = await db
    .insert(driverRoutes)
    .values({
      driverId,
      originLat: input.originLat,
      originLng: input.originLng,
      destinationLat: input.destinationLat,
      destinationLng: input.destinationLng,
      destinationLabel: input.destinationLabel,
      routeGeometry: osrmResult.coordinates,
      distanceMeters: osrmResult.distanceMeters,
      durationSeconds: osrmResult.durationSeconds,
      status: "active",
    })
    .returning();

  if (!newRoute) {
    return errorResponse("Failed to save route", 500);
  }

  // Fetch driver profile for Ably event
  const [profile] = await db
    .select({ name: users.name, profileImageUrl: users.profileImageUrl })
    .from(users)
    .where(eq(users.id, driverId))
    .limit(1);

  // Publish to fleet:locations so admin map updates in real-time
  try {
    await ablyPublish("fleet:locations", "driver_route_set", {
      driverId,
      routeId: newRoute.id,
      name: profile?.name ?? null,
      profileImageUrl: profile?.profileImageUrl ?? null,
      destinationLabel: input.destinationLabel,
      destinationLat: input.destinationLat,
      destinationLng: input.destinationLng,
      distanceMeters: osrmResult.distanceMeters,
      durationSeconds: osrmResult.durationSeconds,
      distanceLabel,
      durationLabel,
      etaIso,
    });
  } catch (err) {
    console.error("[route] Ably publish driver_route_set failed:", err);
  }

  return successResponse(
    {
      route: {
        ...newRoute,
        createdAt: newRoute.createdAt.toISOString(),
        completedAt: null,
        distanceLabel,
        durationLabel,
        etaIso,
        etaLabel,
      },
    },
    201
  );
}

// ---------------------------------------------------------------------------
// DELETE /api/drivers/route
// Cancels the calling driver's active route.
// ?reason=cancelled (default) | arrived
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const session = await requireAuth();
  const driverId = session.user.id;

  const { searchParams } = new URL(req.url);
  const reason = (searchParams.get("reason") ?? "cancelled") as "cancelled" | "arrived";

  const updated = await db
    .update(driverRoutes)
    .set({
      status: reason === "arrived" ? "completed" : "cancelled",
      completedAt: new Date(),
    })
    .where(and(eq(driverRoutes.driverId, driverId), eq(driverRoutes.status, "active")))
    .returning({ id: driverRoutes.id });

  if (updated.length === 0) {
    return errorResponse("No active route found", 404);
  }

  try {
    await ablyPublish("fleet:locations", "driver_route_cleared", {
      driverId,
      reason,
    });
  } catch (err) {
    console.error("[route] Ably publish driver_route_cleared failed:", err);
  }

  return successResponse({ cleared: true, reason }, 200);
}
