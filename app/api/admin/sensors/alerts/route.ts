import { type NextRequest, NextResponse } from "next/server";
import { desc, eq, and, count } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { sensorAlerts, iotDevices } from "@/db/schema";

/**
 * GET /api/admin/sensors/alerts
 *
 * Fleet-wide sensor alerts with filtering and pagination.
 *
 * Query params:
 *   status   — "active" | "acknowledged" (default: all)
 *   deviceId — filter to a specific device
 *   page     — 1-based (default: 1)
 *   limit    — per page (default: 25, max: 100)
 *
 * Response 200: { alerts: SensorAlertRow[], total: number, page: number }
 */
export async function GET(req: NextRequest) {
  await requireAdminSession();

  const { searchParams } = req.nextUrl;
  const statusParam   = searchParams.get("status");
  const deviceIdParam = searchParams.get("deviceId");
  const page          = Math.max(1, Number(searchParams.get("page")  ?? "1"));
  const limit         = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "25")));
  const offset        = (page - 1) * limit;

  // Build conditions
  const conditions = [];
  if (statusParam === "active" || statusParam === "acknowledged") {
    conditions.push(eq(sensorAlerts.status, statusParam));
  }
  if (deviceIdParam) {
    conditions.push(eq(sensorAlerts.deviceId, deviceIdParam));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [alerts, [totalRow]] = await Promise.all([
    db
      .select({
        id:          sensorAlerts.id,
        deviceId:    sensorAlerts.deviceId,
        driverId:    sensorAlerts.driverId,
        alertType:   sensorAlerts.alertType,
        value:       sensorAlerts.value,
        threshold:   sensorAlerts.threshold,
        status:      sensorAlerts.status,
        triggeredAt: sensorAlerts.triggeredAt,
        ackedAt:     sensorAlerts.ackedAt,
        ackedBy:     sensorAlerts.ackedBy,
        truckLabel:  iotDevices.truckLabel,
      })
      .from(sensorAlerts)
      .leftJoin(iotDevices, eq(iotDevices.deviceId, sensorAlerts.deviceId))
      .where(where)
      .orderBy(desc(sensorAlerts.triggeredAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ count: count() })
      .from(sensorAlerts)
      .where(where),
  ]);

  return NextResponse.json({ alerts, total: totalRow?.count ?? 0, page });
}
