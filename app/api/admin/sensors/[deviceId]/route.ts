import { type NextRequest, NextResponse } from "next/server";
import { desc, eq, and, gte } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { iotDevices, sensorReadings, sensorAlerts } from "@/db/schema";

type RangeKey = "1h" | "6h" | "24h" | "7d";

const RANGE_MS: Record<RangeKey, number> = {
  "1h":  1 * 60 * 60 * 1_000,
  "6h":  6 * 60 * 60 * 1_000,
  "24h": 24 * 60 * 60 * 1_000,
  "7d":  7 * 24 * 60 * 60 * 1_000,
};

/**
 * GET /api/admin/sensors/[deviceId]
 *
 * Returns full device detail including latest reading, historical readings
 * for the selected range, and active alerts.
 *
 * Query params:
 *   range — "1h" | "6h" | "24h" | "7d"  (default: "1h")
 *
 * Response 200: { device, latestReading, readings, activeAlerts }
 * Response 404: { error: "Device not found" }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  await requireAdminSession();

  const { deviceId } = params;
  const rawRange = req.nextUrl.searchParams.get("range") ?? "1h";
  const rangeKey: RangeKey = (rawRange in RANGE_MS) ? rawRange as RangeKey : "1h";
  const from = new Date(Date.now() - RANGE_MS[rangeKey]);

  // Verify device exists
  const [device] = await db
    .select()
    .from(iotDevices)
    .where(eq(iotDevices.deviceId, deviceId))
    .limit(1);

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const [latestReading, readings, activeAlerts] = await Promise.all([
    db
      .select()
      .from(sensorReadings)
      .where(eq(sensorReadings.deviceId, deviceId))
      .orderBy(desc(sensorReadings.recordedAt))
      .limit(1)
      .then((r) => r[0] ?? null),

    db
      .select()
      .from(sensorReadings)
      .where(
        and(
          eq(sensorReadings.deviceId, deviceId),
          gte(sensorReadings.recordedAt, from)
        )
      )
      .orderBy(desc(sensorReadings.recordedAt))
      .limit(300),

    db
      .select()
      .from(sensorAlerts)
      .where(
        and(
          eq(sensorAlerts.deviceId, deviceId),
          eq(sensorAlerts.status, "active")
        )
      )
      .orderBy(desc(sensorAlerts.triggeredAt)),
  ]);

  return NextResponse.json({ device, latestReading, readings, activeAlerts });
}
