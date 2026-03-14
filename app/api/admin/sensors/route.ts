import { NextResponse } from "next/server";
import { desc, eq, count, and } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { iotDevices, sensorReadings, sensorAlerts } from "@/db/schema";

/**
 * GET /api/admin/sensors
 *
 * Returns all registered IoT devices with their latest sensor reading
 * and active alert count.
 *
 * Response 200: { devices: AdminSensorDeviceView[] }
 */
export async function GET() {
  await requireAdminSession();

  // Fetch all devices
  const devices = await db
    .select({
      deviceId:        iotDevices.deviceId,
      truckLabel:      iotDevices.truckLabel,
      status:          iotDevices.status,
      lastSeenAt:      iotDevices.lastSeenAt,
      firmwareVersion: iotDevices.firmwareVersion,
      driverId:        iotDevices.driverId,
    })
    .from(iotDevices)
    .orderBy(iotDevices.truckLabel);

  if (devices.length === 0) {
    return NextResponse.json({ devices: [] });
  }

  // For each device, fetch its latest reading and active alert count in parallel
  const enriched = await Promise.all(
    devices.map(async (device) => {
      const [latestReading] = await db
        .select({
          temperatureC:       sensorReadings.temperatureC,
          humidityPct:        sensorReadings.humidityPct,
          vibrationMagnitude: sensorReadings.vibrationMagnitude,
          recordedAt:         sensorReadings.recordedAt,
        })
        .from(sensorReadings)
        .where(eq(sensorReadings.deviceId, device.deviceId))
        .orderBy(desc(sensorReadings.recordedAt))
        .limit(1);

      const [alertRow] = await db
        .select({ count: count() })
        .from(sensorAlerts)
        .where(
          and(
            eq(sensorAlerts.deviceId, device.deviceId),
            eq(sensorAlerts.status, "active")
          )
        );

      return {
        ...device,
        latestReading: latestReading ?? null,
        activeAlertCount: alertRow?.count ?? 0,
      };
    })
  );

  return NextResponse.json({ devices: enriched });
}
