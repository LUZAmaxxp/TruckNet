import { type NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { driverTrainingRecords, users } from "@/db/schema";
import { CreateTrainingSchema } from "@/schemas/driver-esg-report.schema";
import { isUUID } from "@/lib/validate-uuid";

export async function GET(
  _req: NextRequest,
  { params }: { params: { driverId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId)) return errorResponse("Invalid driverId", 400);

  const records = await db
    .select()
    .from(driverTrainingRecords)
    .where(eq(driverTrainingRecords.driverId, params.driverId))
    .orderBy(desc(driverTrainingRecords.completedAt));

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
  const parsed = CreateTrainingSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const d = parsed.data;
  const [record] = await db
    .insert(driverTrainingRecords)
    .values({
      driverId:            params.driverId,
      trainingType:        d.training_type,
      title:               d.title,
      provider:            d.provider,
      completedAt:         d.completed_at,
      durationHours:       d.duration_hours,
      costEur:             d.cost_eur,
      passed:              d.passed,
      certificationNumber: d.certification_number,
      expiryDate:          d.expiry_date,
      notes:               d.notes,
      createdAt:           new Date(),
      updatedAt:           new Date(),
      createdBy:           session.user.id,
    })
    .returning();

  return successResponse({ record }, 201);
}
