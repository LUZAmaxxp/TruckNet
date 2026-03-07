import { type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { esgReportSchedules } from "@/db/schema";
import { UpdateEsgReportScheduleSchema } from "@/schemas/driver-esg-report.schema";
import { isUUID } from "@/lib/validate-uuid";

export async function GET(
  _req: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.scheduleId)) return errorResponse("Invalid scheduleId", 400);

  const [schedule] = await db
    .select()
    .from(esgReportSchedules)
    .where(eq(esgReportSchedules.id, params.scheduleId))
    .limit(1);

  if (!schedule) return errorResponse("Schedule not found", 404);
  return successResponse({ schedule }, 200);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.scheduleId)) return errorResponse("Invalid scheduleId", 400);

  const [existing] = await db
    .select({ id: esgReportSchedules.id })
    .from(esgReportSchedules)
    .where(eq(esgReportSchedules.id, params.scheduleId))
    .limit(1);
  if (!existing) return errorResponse("Schedule not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = UpdateEsgReportScheduleSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const [updated] = await db
    .update(esgReportSchedules)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(esgReportSchedules.id, params.scheduleId))
    .returning();

  return successResponse({ schedule: updated }, 200);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.scheduleId)) return errorResponse("Invalid scheduleId", 400);

  const [deleted] = await db
    .delete(esgReportSchedules)
    .where(eq(esgReportSchedules.id, params.scheduleId))
    .returning({ id: esgReportSchedules.id });

  if (!deleted) return errorResponse("Schedule not found", 404);
  return successResponse({ deleted: true }, 200);
}
