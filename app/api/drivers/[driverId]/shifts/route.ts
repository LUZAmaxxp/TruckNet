import { type NextRequest } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { driverShifts, users } from "@/db/schema";
import { CreateShiftSchema } from "@/schemas/driver-esg-report.schema";
import { isUUID } from "@/lib/validate-uuid";

export async function GET(
  req: NextRequest,
  { params }: { params: { driverId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId)) return errorResponse("Invalid driverId", 400);

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const conditions = [eq(driverShifts.driverId, params.driverId)];
  if (from) conditions.push(gte(driverShifts.shiftDate, from));
  if (to)   conditions.push(lte(driverShifts.shiftDate, to));

  const shifts = await db
    .select()
    .from(driverShifts)
    .where(and(...conditions))
    .orderBy(desc(driverShifts.startedAt));

  return successResponse({ shifts }, 200);
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
  const parsed = CreateShiftSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const d = parsed.data;

  const [shift] = await db
    .insert(driverShifts)
    .values({
      driverId:     params.driverId,
      tripId:       d.trip_id,
      shiftDate:    d.shift_date,
      startedAt:    new Date(d.started_at),
      breakMinutes: d.break_minutes,
      driverNotes:  d.driver_notes,
      status:       "active",
      createdAt:    new Date(),
      updatedAt:    new Date(),
      createdBy:    session.user.id,
    })
    .returning();

  return successResponse({ shift }, 201);
}
