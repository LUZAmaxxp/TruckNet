import { type NextRequest } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { vehicleMaintenanceLogs, users } from "@/db/schema";
import { CreateMaintenanceSchema } from "@/schemas/driver-esg-report.schema";
import { isUUID } from "@/lib/validate-uuid";

export async function GET(
  req: NextRequest,
  { params }: { params: { driverId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId)) return errorResponse("Invalid driverId", 400);

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const conditions = [eq(vehicleMaintenanceLogs.driverId, params.driverId)];
  if (type) conditions.push(eq(vehicleMaintenanceLogs.maintenanceType, type as any));
  if (from) conditions.push(gte(vehicleMaintenanceLogs.performedAt, from));
  if (to)   conditions.push(lte(vehicleMaintenanceLogs.performedAt, to));

  const records = await db
    .select()
    .from(vehicleMaintenanceLogs)
    .where(and(...conditions))
    .orderBy(desc(vehicleMaintenanceLogs.performedAt));

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
  const parsed = CreateMaintenanceSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const d = parsed.data;
  const [record] = await db
    .insert(vehicleMaintenanceLogs)
    .values({
      driverId:            params.driverId,
      vehiclePlate:        d.vehicle_plate,
      maintenanceType:     d.maintenance_type,
      performedAt:         d.performed_at,
      odometerKm:          d.odometer_km,
      costEur:             d.cost_eur,
      fuelLiters:          d.fuel_liters,
      fuelType:            d.fuel_type as any,
      providerName:        d.provider_name,
      nextDueAt:           d.next_due_at,
      nextDueKm:           d.next_due_km,
      regulatoryCompliant: d.regulatory_compliant,
      notes:               d.notes,
      createdAt:           new Date(),
      updatedAt:           new Date(),
      createdBy:           session.user.id,
    })
    .returning();

  return successResponse({ record }, 201);
}
