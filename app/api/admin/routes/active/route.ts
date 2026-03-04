import { requireAdminSession } from "@/lib/auth-helpers";
import { successResponse } from "@/lib/api";
import { db } from "@/db";
import { driverRoutes, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/admin/routes/active
 * Returns a lightweight list of all drivers with an active route (no geometry).
 * Used to populate the "On Route" stat card and to know which driver pins
 * should show a "View Route" button in FleetMap.
 */
export async function GET() {
  await requireAdminSession();

  const rows = await db
    .select({
      routeId: driverRoutes.id,
      driverId: driverRoutes.driverId,
      driverName: users.name,
      driverAvatar: users.profileImageUrl,
      destinationLabel: driverRoutes.destinationLabel,
      distanceMeters: driverRoutes.distanceMeters,
      durationSeconds: driverRoutes.durationSeconds,
      createdAt: driverRoutes.createdAt,
    })
    .from(driverRoutes)
    .innerJoin(users, eq(driverRoutes.driverId, users.id))
    .where(eq(driverRoutes.status, "active"))
    .orderBy(driverRoutes.createdAt);

  return successResponse(
    {
      count: rows.length,
      routes: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    200
  );
}
