import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { sensorAlerts, iotDevices } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET /api/drivers/my-alerts
 *
 * Returns active sensor alerts for the device linked to the authenticated driver.
 * Returns an empty array if the driver has no device linked.
 */
export async function GET() {
  const session = await requireAuth();

  // Find the device linked to this driver
  const [device] = await db
    .select({ deviceId: iotDevices.deviceId, truckLabel: iotDevices.truckLabel })
    .from(iotDevices)
    .where(eq(iotDevices.driverId, session.user.id))
    .limit(1);

  if (!device) {
    return NextResponse.json({ alerts: [] });
  }

  const alerts = await db
    .select()
    .from(sensorAlerts)
    .where(
      and(
        eq(sensorAlerts.deviceId, device.deviceId),
        eq(sensorAlerts.status, "active")
      )
    )
    .orderBy(desc(sensorAlerts.triggeredAt));

  return NextResponse.json({
    alerts: alerts.map((a) => ({
      id:          a.id,
      alertType:   a.alertType,
      value:       a.value,
      threshold:   a.threshold,
      triggeredAt: a.triggeredAt.toISOString(),
      truckLabel:  device.truckLabel ?? device.deviceId,
      deviceId:    device.deviceId,
    })),
  });
}
