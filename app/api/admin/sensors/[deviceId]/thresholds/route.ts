import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { iotDevices } from "@/db/schema";
import { SensorThresholdSchema } from "@/schemas/sensor.schema";

/**
 * PATCH /api/admin/sensors/[deviceId]/thresholds
 *
 * Update alert thresholds for a specific device.
 *
 * Body: SensorThresholdSchema { temp_min_c, temp_max_c, humidity_max_pct, vibration_max_g }
 *
 * Response 200: { success: true, alertConfig }
 * Response 400: { error: string }
 * Response 404: { error: "Device not found" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  await requireAdminSession();

  const { deviceId } = params;
  const body = await req.json() as unknown;

  const parsed = SensorThresholdSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid threshold config" },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select({ deviceId: iotDevices.deviceId })
    .from(iotDevices)
    .where(eq(iotDevices.deviceId, deviceId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(iotDevices)
    .set({ alertConfig: parsed.data })
    .where(eq(iotDevices.deviceId, deviceId))
    .returning();

  return NextResponse.json({ success: true, alertConfig: updated.alertConfig });
}
