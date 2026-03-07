import { type NextRequest } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { transportTrips, users } from "@/db/schema";
import { isUUID } from "@/lib/validate-uuid";
import { z } from "zod";

const CreateTripSchema = z.object({
  vehicle_plate:      z.string().min(1).max(20),
  origin_label:       z.string().max(200).optional(),
  destination_label:  z.string().max(200).optional(),
  distance_km:        z.number().positive().optional(),
  duration_minutes:   z.number().positive().optional(),
  fuel_liters:        z.number().nonnegative().optional(),
  fuel_type:          z.enum(["diesel", "petrol", "lpg", "cng", "electric", "hydrogen", "other"]).optional(),
  cargo_weight_kg:    z.number().nonnegative().optional(),
  load_factor_pct:    z.number().min(0).max(100).optional(),
  is_empty_run:       z.boolean().default(false),
  started_at:         z.string().datetime().optional(),
  completed_at:       z.string().datetime().optional(),
  status:             z.enum(["active", "completed", "cancelled"]).default("completed"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { driverId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId)) return errorResponse("Invalid driverId", 400);

  const { searchParams } = req.nextUrl;
  const from   = searchParams.get("from");
  const to     = searchParams.get("to");
  const status = searchParams.get("status");

  const conditions = [eq(transportTrips.driverId, params.driverId)];
  if (from)   conditions.push(gte(transportTrips.startedAt, new Date(from)));
  if (to)     conditions.push(lte(transportTrips.startedAt, new Date(to + "T23:59:59Z")));
  if (status) conditions.push(eq(transportTrips.status, status as any));

  const records = await db
    .select()
    .from(transportTrips)
    .where(and(...conditions))
    .orderBy(desc(transportTrips.startedAt));

  return successResponse({ records }, 200);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { driverId: string } }
) {
  const session = await requireAdminSession();
  if (!isUUID(params.driverId)) return errorResponse("Invalid driverId", 400);

  const [driver] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, params.driverId), eq(users.role, "driver")))
    .limit(1);
  if (!driver) return errorResponse("Driver not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = CreateTripSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const d = parsed.data;
  const [record] = await db
    .insert(transportTrips)
    .values({
      driverId:         params.driverId,
      vehiclePlate:     d.vehicle_plate,
      originLabel:      d.origin_label,
      destinationLabel: d.destination_label,
      distanceKm:       d.distance_km,
      durationMinutes:  d.duration_minutes,
      fuelLiters:       d.fuel_liters,
      fuelType:         d.fuel_type,
      cargoWeightKg:    d.cargo_weight_kg,
      loadFactorPct:    d.load_factor_pct,
      isEmptyRun:       d.is_empty_run,
      startedAt:        d.started_at ? new Date(d.started_at) : undefined,
      completedAt:      d.completed_at ? new Date(d.completed_at) : undefined,
      status:           d.status,
      createdBy:        session.user.id,
    })
    .returning();

  return successResponse({ record }, 201);
}
