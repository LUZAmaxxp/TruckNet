import { type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { driverShifts } from "@/db/schema";
import { CompleteShiftSchema } from "@/schemas/driver-esg-report.schema";
import { isUUID } from "@/lib/validate-uuid";

export async function POST(
  req: NextRequest,
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
  if (shift.status !== "active") return errorResponse("Shift is not active", 409);

  const body = await req.json().catch(() => null);
  const parsed = CompleteShiftSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const d = parsed.data;
  const endedAt = d.ended_at ? new Date(d.ended_at) : new Date();

  // Compute drivingMinutes = total elapsed minutes - break time
  const totalMinutes = (endedAt.getTime() - shift.startedAt.getTime()) / 60_000;
  const breakMinutes = d.break_minutes ?? shift.breakMinutes;
  const drivingMinutes = Math.max(0, Math.round(totalMinutes - breakMinutes));

  const [updated] = await db
    .update(driverShifts)
    .set({
      endedAt,
      breakMinutes,
      drivingMinutes,
      overtimeMinutes: d.overtime_minutes,
      nightShift:      d.night_shift,
      driverNotes:     d.driver_notes ?? shift.driverNotes,
      status:          "completed",
      updatedAt:       new Date(),
    })
    .where(eq(driverShifts.id, params.shiftId))
    .returning();

  return successResponse({ shift: updated }, 200);
}
