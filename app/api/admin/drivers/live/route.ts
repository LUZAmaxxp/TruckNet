import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { driverLocations, users } from "@/db/schema";

/**
 * GET /api/admin/drivers/live
 *
 * Lightweight snapshot of all currently online drivers with GPS coordinates.
 * "Online" = driver_locations.updated_at within the last 5 minutes.
 *
 * Polled by FleetMap every 20 seconds.
 *
 * Response 200: { drivers: LiveDriverEntry[] }
 */
export async function GET() {
  await requireAdminSession();

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const drivers = await db
    .select({
      id: users.id,
      name: users.name,
      profileImageUrl: users.profileImageUrl,
      latitude: driverLocations.latitude,
      longitude: driverLocations.longitude,
      updatedAt: driverLocations.updatedAt,
    })
    .from(driverLocations)
    .innerJoin(users, eq(users.id, driverLocations.userId))
    .where(
      and(
        eq(users.role, "driver"),
        gt(driverLocations.updatedAt, fiveMinutesAgo)
      )
    )
    .orderBy(driverLocations.updatedAt);

  return NextResponse.json({ drivers });
}
