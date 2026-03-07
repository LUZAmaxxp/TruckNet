import { type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { driverShifts } from "@/db/schema";
import { isUUID } from "@/lib/validate-uuid";

export async function GET(
  _req: NextRequest,
  { params }: { params: { driverId: string; shiftId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId) || !isUUID(params.shiftId)) return errorResponse("Invalid ID", 400);

  const [shift] = await db
    .select()
    .from(driverShifts)
    .where(and(eq(driverShifts.id, params.shiftId), eq(driverShifts.driverId, params.driverId)))
    .limit(1);

  if (!shift) return errorResponse("Shift not found", 404);
  return successResponse({ shift }, 200);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { driverId: string; shiftId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId) || !isUUID(params.shiftId)) return errorResponse("Invalid ID", 400);

  const [existing] = await db
    .select()
    .from(driverShifts)
    .where(and(eq(driverShifts.id, params.shiftId), eq(driverShifts.driverId, params.driverId)))
    .limit(1);
  if (!existing) return errorResponse("Shift not found", 404);

  const body = await req.json().catch(() => ({}));
  const [updated] = await db
    .update(driverShifts)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(driverShifts.id, params.shiftId))
    .returning();

  return successResponse({ shift: updated }, 200);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { driverId: string; shiftId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId) || !isUUID(params.shiftId)) return errorResponse("Invalid ID", 400);

  const [deleted] = await db
    .delete(driverShifts)
    .where(and(eq(driverShifts.id, params.shiftId), eq(driverShifts.driverId, params.driverId)))
    .returning({ id: driverShifts.id });

  if (!deleted) return errorResponse("Shift not found", 404);
  return successResponse({ deleted: true }, 200);
}
