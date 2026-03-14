import { type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { transportTrips } from "@/db/schema";
import { isUUID } from "@/lib/validate-uuid";
import { z } from "zod";

const PatchTripSchema = z.object({
  vehicle_plate:      z.string().min(1).max(20).optional(),
  origin_label:       z.string().max(200).optional(),
  destination_label:  z.string().max(200).optional(),
  distance_km:        z.number().positive().optional(),
  duration_minutes:   z.number().positive().optional(),
  fuel_liters:        z.number().nonnegative().optional(),
  fuel_type:          z.enum(["diesel", "petrol", "lpg", "cng", "electric", "hydrogen", "other"]).optional(),
  cargo_weight_kg:    z.number().nonnegative().optional(),
  load_factor_pct:    z.number().min(0).max(100).optional(),
  is_empty_run:       z.boolean().optional(),
  started_at:         z.string().datetime().optional(),
  completed_at:       z.string().datetime().optional(),
  status:             z.enum(["active", "completed", "cancelled"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { driverId: string; tripId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId) || !isUUID(params.tripId)) return errorResponse("Invalid ID", 400);

  const [record] = await db
    .select()
    .from(transportTrips)
    .where(and(eq(transportTrips.id, params.tripId), eq(transportTrips.driverId, params.driverId)))
    .limit(1);

  if (!record) return errorResponse("Trip not found", 404);
  return successResponse({ record }, 200);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { driverId: string; tripId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId) || !isUUID(params.tripId)) return errorResponse("Invalid ID", 400);

  const body = await req.json().catch(() => null);
  const parsed = PatchTripSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const d = parsed.data;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (d.vehicle_plate     !== undefined) updates.vehiclePlate     = d.vehicle_plate;
  if (d.origin_label      !== undefined) updates.originLabel      = d.origin_label;
  if (d.destination_label !== undefined) updates.destinationLabel = d.destination_label;
  if (d.distance_km       !== undefined) updates.distanceKm       = d.distance_km;
  if (d.duration_minutes  !== undefined) updates.durationMinutes  = d.duration_minutes;
  if (d.fuel_liters       !== undefined) updates.fuelLiters       = d.fuel_liters;
  if (d.fuel_type         !== undefined) updates.fuelType         = d.fuel_type;
  if (d.cargo_weight_kg   !== undefined) updates.cargoWeightKg    = d.cargo_weight_kg;
  if (d.load_factor_pct   !== undefined) updates.loadFactorPct    = d.load_factor_pct;
  if (d.is_empty_run      !== undefined) updates.isEmptyRun       = d.is_empty_run;
  if (d.started_at        !== undefined) updates.startedAt        = new Date(d.started_at);
  if (d.completed_at      !== undefined) updates.completedAt      = new Date(d.completed_at);
  if (d.status            !== undefined) updates.status           = d.status;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [record] = await db
    .update(transportTrips)
    .set(updates as any)
    .where(and(eq(transportTrips.id, params.tripId), eq(transportTrips.driverId, params.driverId)))
    .returning();

  if (!record) return errorResponse("Trip not found", 404);
  return successResponse({ record }, 200);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { driverId: string; tripId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId) || !isUUID(params.tripId)) return errorResponse("Invalid ID", 400);

  const [deleted] = await db
    .delete(transportTrips)
    .where(and(eq(transportTrips.id, params.tripId), eq(transportTrips.driverId, params.driverId)))
    .returning({ id: transportTrips.id });

  if (!deleted) return errorResponse("Trip not found", 404);
  return successResponse({ id: deleted.id }, 200);
}
