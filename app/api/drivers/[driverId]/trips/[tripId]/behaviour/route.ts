import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import {
  behaviourReports,
  drivingEvents,
  transportTrips,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isUUID } from "@/lib/validate-uuid";
import { z } from "zod";

const ReviewSchema = z.object({
  admin_reviewed: z.literal(true),
  admin_note:     z.string().max(1000).optional(),
});

/**
 * GET /api/drivers/[driverId]/trips/[tripId]/behaviour
 * Returns the behaviour report + all events for a trip.
 * Role: admin | driver (own trip only)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { driverId: string; tripId: string } }
) {
  const session = await requireAuth();
  const { driverId, tripId } = params;

  if (!isUUID(driverId) || !isUUID(tripId))
    return errorResponse("Invalid ID", 400);

  if (session.user.role !== "admin" && session.user.id !== driverId)
    return errorResponse("Forbidden", 403);

  const [report] = await db
    .select()
    .from(behaviourReports)
    .where(eq(behaviourReports.tripId, tripId))
    .limit(1);

  const [trip] = await db
    .select()
    .from(transportTrips)
    .where(and(eq(transportTrips.id, tripId), eq(transportTrips.driverId, driverId)))
    .limit(1);

  if (!trip) return errorResponse("Trip not found", 404);

  const events = report
    ? await db
        .select()
        .from(drivingEvents)
        .where(eq(drivingEvents.tripId, tripId))
    : [];

  return successResponse({ report: report ?? null, events, trip }, 200);
}

/**
 * PATCH /api/drivers/[driverId]/trips/[tripId]/behaviour
 * Admin marks report as reviewed.
 * Role: admin only
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { driverId: string; tripId: string } }
) {
  const session = await requireAuth();
  if (session.user.role !== "admin") return errorResponse("Forbidden", 403);

  const { tripId } = params;
  if (!isUUID(params.driverId) || !isUUID(tripId))
    return errorResponse("Invalid ID", 400);

  const body   = await req.json().catch(() => null);
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success)
    return errorResponse("Validation failed", 400, parsed.error.issues);

  const [report] = await db
    .update(behaviourReports)
    .set({
      adminReviewed:    true,
      adminReviewedBy:  session.user.id,
      adminReviewedAt:  new Date(),
      adminNote:        parsed.data.admin_note ?? null,
      updatedAt:        new Date(),
    })
    .where(eq(behaviourReports.tripId, tripId))
    .returning();

  if (!report) return errorResponse("Report not found", 404);

  return successResponse({ report }, 200);
}
