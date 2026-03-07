import { type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { driverTrainingRecords } from "@/db/schema";
import { UpdateTrainingSchema } from "@/schemas/driver-esg-report.schema";
import { isUUID } from "@/lib/validate-uuid";

export async function GET(
  _req: NextRequest,
  { params }: { params: { driverId: string; trainingId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId) || !isUUID(params.trainingId)) return errorResponse("Invalid ID", 400);

  const [record] = await db
    .select()
    .from(driverTrainingRecords)
    .where(and(eq(driverTrainingRecords.id, params.trainingId), eq(driverTrainingRecords.driverId, params.driverId)))
    .limit(1);

  if (!record) return errorResponse("Record not found", 404);
  return successResponse({ record }, 200);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { driverId: string; trainingId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId) || !isUUID(params.trainingId)) return errorResponse("Invalid ID", 400);

  const [existing] = await db
    .select({ id: driverTrainingRecords.id })
    .from(driverTrainingRecords)
    .where(and(eq(driverTrainingRecords.id, params.trainingId), eq(driverTrainingRecords.driverId, params.driverId)))
    .limit(1);
  if (!existing) return errorResponse("Record not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = UpdateTrainingSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const [updated] = await db
    .update(driverTrainingRecords)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(driverTrainingRecords.id, params.trainingId))
    .returning();

  return successResponse({ record: updated }, 200);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { driverId: string; trainingId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId) || !isUUID(params.trainingId)) return errorResponse("Invalid ID", 400);

  const [deleted] = await db
    .delete(driverTrainingRecords)
    .where(and(eq(driverTrainingRecords.id, params.trainingId), eq(driverTrainingRecords.driverId, params.driverId)))
    .returning({ id: driverTrainingRecords.id });

  if (!deleted) return errorResponse("Record not found", 404);
  return successResponse({ deleted: true }, 200);
}
