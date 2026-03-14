import { type NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { transportTrips, fuelTypeEnum } from "@/db/schema";
import { z } from "zod";
import { ablyPublish } from "@/lib/ably-server";

const StartTripSchema = z.object({
  vehicle_plate:     z.string().min(1).max(20),
  origin_label:      z.string().max(200).optional(),
  destination_label: z.string().max(200).optional(),
  cargo_weight_kg:   z.number().nonnegative().optional(),
  fuel_type:         z.enum(["diesel", "petrol", "lpg", "cng", "electric", "hydrogen", "other"]).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/trips
// Returns the calling driver's currently active trip (status = "active").
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await requireAuth();
  const driverId = session.user.id;

  const [trip] = await db
    .select()
    .from(transportTrips)
    .where(and(eq(transportTrips.driverId, driverId), eq(transportTrips.status, "active")))
    .orderBy(desc(transportTrips.createdAt))
    .limit(1);

  return successResponse({ trip: trip ?? null }, 200);
}

// ---------------------------------------------------------------------------
// POST /api/trips
// Starts a new trip for the calling driver (status = "active").
// Rejects if an active trip already exists.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  const driverId = session.user.id;

  // Prevent multiple concurrent active trips
  const [existing] = await db
    .select({ id: transportTrips.id })
    .from(transportTrips)
    .where(and(eq(transportTrips.driverId, driverId), eq(transportTrips.status, "active")))
    .limit(1);

  if (existing) {
    return errorResponse("A trip is already active. Complete or cancel it first.", 409);
  }

  const body = await req.json().catch(() => null);
  const parsed = StartTripSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const d = parsed.data;

  const [trip] = await db
    .insert(transportTrips)
    .values({
      driverId,
      vehiclePlate:     d.vehicle_plate,
      originLabel:      d.origin_label,
      destinationLabel: d.destination_label,
      cargoWeightKg:    d.cargo_weight_kg,
      fuelType:         d.fuel_type as typeof fuelTypeEnum.enumValues[number] | undefined,
      startedAt:        new Date(),
      status:           "active",
      createdBy:        driverId,
    })
    .returning();

  // Notify all connected browser tabs / pages of this driver about the new trip
  if (trip) {
    await ablyPublish(`user:${driverId}`, "trip_updated", {
      tripId: trip.id,
      status: "active",
      trip: {
        id:               trip.id,
        vehiclePlate:     trip.vehiclePlate,
        originLabel:      trip.originLabel ?? null,
        destinationLabel: trip.destinationLabel ?? null,
        cargoWeightKg:    trip.cargoWeightKg ?? null,
        startedAt:        trip.startedAt?.toISOString() ?? null,
      },
    });
  }

  return successResponse({ trip }, 201);
}
