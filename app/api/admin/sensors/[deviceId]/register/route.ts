import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { iotDevices } from "@/db/schema";
import { DeviceRegisterSchema } from "@/schemas/sensor.schema";
import { DEFAULT_ALERT_CONFIG } from "@/schemas/sensor.schema";

/**
 * POST /api/admin/sensors/[deviceId]/register
 *
 * Register a new IoT device before deployment.
 *
 * Body: DeviceRegisterSchema { deviceId, truckLabel, driverId?, alertConfig? }
 *
 * Response 201: { device }
 * Response 400: { error: string }
 * Response 409: { error: "Device already registered" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  await requireAdminSession();

  const body = await req.json() as unknown;

  const parsed = DeviceRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid device registration data" },
      { status: 400 }
    );
  }

  // Check for existing device — 409 if already registered
  const [existing] = await db
    .select({ deviceId: iotDevices.deviceId })
    .from(iotDevices)
    .where(eq(iotDevices.deviceId, parsed.data.deviceId))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Device already registered" }, { status: 409 });
  }

  const [device] = await db
    .insert(iotDevices)
    .values({
      deviceId:    parsed.data.deviceId,
      truckLabel:  parsed.data.truckLabel,
      driverId:    parsed.data.driverId ?? null,
      alertConfig: parsed.data.alertConfig ?? DEFAULT_ALERT_CONFIG,
    })
    .returning();

  return NextResponse.json({ device }, { status: 201 });
}
