import { type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { vehicleMaintenanceLogs } from "@/db/schema";
import { UpdateMaintenanceSchema } from "@/schemas/driver-esg-report.schema";
import { isUUID } from "@/lib/validate-uuid";

export async function GET(
  _req: NextRequest,
  { params }: { params: { driverId: string; maintenanceId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId) || !isUUID(params.maintenanceId)) return errorResponse("Invalid ID", 400);

  const [record] = await db
    .select()
    .from(vehicleMaintenanceLogs)
    .where(and(eq(vehicleMaintenanceLogs.id, params.maintenanceId), eq(vehicleMaintenanceLogs.driverId, params.driverId)))
    .limit(1);

  if (!record) return errorResponse("Record not found", 404);
  return successResponse({ record }, 200);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { driverId: string; maintenanceId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId) || !isUUID(params.maintenanceId)) return errorResponse("Invalid ID", 400);

  const [existing] = await db
    .select({ id: vehicleMaintenanceLogs.id })
    .from(vehicleMaintenanceLogs)
    .where(and(eq(vehicleMaintenanceLogs.id, params.maintenanceId), eq(vehicleMaintenanceLogs.driverId, params.driverId)))
    .limit(1);
  if (!existing) return errorResponse("Record not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = UpdateMaintenanceSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const [updated] = await db
    .update(vehicleMaintenanceLogs)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(vehicleMaintenanceLogs.id, params.maintenanceId))
    .returning();

  return successResponse({ record: updated }, 200);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { driverId: string; maintenanceId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId) || !isUUID(params.maintenanceId)) return errorResponse("Invalid ID", 400);

  const [deleted] = await db
    .delete(vehicleMaintenanceLogs)
    .where(and(eq(vehicleMaintenanceLogs.id, params.maintenanceId), eq(vehicleMaintenanceLogs.driverId, params.driverId)))
    .returning({ id: vehicleMaintenanceLogs.id });

  if (!deleted) return errorResponse("Record not found", 404);
  return successResponse({ deleted: true }, 200);
}
