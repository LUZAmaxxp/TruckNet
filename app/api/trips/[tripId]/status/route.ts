import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { transportTrips } from "@/db/schema";
import { isUUID } from "@/lib/validate-uuid";
import { z } from "zod";
import { behaviourReportQueue } from "@/lib/behaviour/behaviour-report-queue";

const StatusSchema = z.object({
  status:           z.enum(["completed", "cancelled"]),
  distance_km:      z.number().positive().optional(),
  duration_minutes: z.number().positive().optional(),
  fuel_liters:      z.number().nonnegative().optional(),
});

// ---------------------------------------------------------------------------
// PATCH /api/trips/[tripId]/status
// Lets the calling driver mark their own active trip as completed or cancelled.
// Only the trip's owner can change it.
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  const session = await requireAuth();
  const driverId = session.user.id;

  if (!isUUID(params.tripId)) return errorResponse("Invalid trip ID", 400);

  const body = await req.json().catch(() => null);
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const d = parsed.data;

  // Verify the trip belongs to this driver and is currently active
  const [existing] = await db
    .select({ id: transportTrips.id, status: transportTrips.status })
    .from(transportTrips)
    .where(and(eq(transportTrips.id, params.tripId), eq(transportTrips.driverId, driverId)))
    .limit(1);

  if (!existing) return errorResponse("Trip not found", 404);
  if (existing.status !== "active") {
    return errorResponse(`Trip is already ${existing.status}`, 409);
  }

  const updates: Record<string, unknown> = { status: d.status };

  if (d.status === "completed") {
    updates.completedAt = new Date();
    if (d.distance_km      !== undefined) updates.distanceKm      = d.distance_km;
    if (d.duration_minutes !== undefined) updates.durationMinutes = d.duration_minutes;
    if (d.fuel_liters      !== undefined) updates.fuelLiters      = d.fuel_liters;
  }

  const [trip] = await db
    .update(transportTrips)
    .set(updates as any)
    .where(and(eq(transportTrips.id, params.tripId), eq(transportTrips.driverId, driverId)))
    .returning();

  // Enqueue behaviour report generation when trip is completed
  if (d.status === "completed" && trip) {
    await behaviourReportQueue.add(
      "generate-behaviour-report",
      { tripId: trip.id, driverId: trip.driverId },
      { delay: 100 } // minimal delay; worker itself waits 30s for late events
    );
  }

  return successResponse({ trip }, 200);
}
