import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { formatDistance, formatDuration, computeEta, formatEta } from "@/lib/osrm";
import { db } from "@/db";
import { driverRoutes } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/admin/drivers/[driverId]/route
 * Returns the specified driver's active route (admin only).
 */
export async function GET(
  _req: Request,
  { params }: { params: { driverId: string } }
) {
  await requireAdminSession();
  const { driverId } = params;

  const [route] = await db
    .select()
    .from(driverRoutes)
    .where(and(eq(driverRoutes.driverId, driverId), eq(driverRoutes.status, "active")))
    .limit(1);

  if (!route) {
    return errorResponse("No active route found for this driver", 404);
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
