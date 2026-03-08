import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { transportTrips } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/drivers/[driverId]/active-trip
 *
 * Returns the driver's currently active trip, or null.
 * Used by cam_agent --auto mode to know which tripId to tag events with.
 *
 * Auth: session cookie (admin/driver) OR Bearer token matching CAM_AGENT_API_KEY env var.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { driverId: string } }
) {
  // Allow cam_agent to authenticate with a static API key
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKey = process.env.CAM_AGENT_API_KEY;
  if (apiKey && authHeader === `Bearer ${apiKey}`) {
    // API key auth — trusted, no role check needed
  } else {
    const session = await requireAuth();
    if (
      session.user.role !== "admin" &&
      session.user.id !== params.driverId
    ) {
      return errorResponse("Forbidden", 403);
    }
  }

  const { driverId } = params;
  if (!UUID_RE.test(driverId)) {
    return errorResponse("Invalid driverId — must be a UUID. Check cam_agent config.yaml driver_id.", 400);
  }

  const [trip] = await db
    .select()
    .from(transportTrips)
    .where(
      and(
        eq(transportTrips.driverId, params.driverId),
        eq(transportTrips.status,   "active")
      )
    )
    .limit(1);

  return successResponse({ trip: trip ?? null }, 200);
}
