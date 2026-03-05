import { NextResponse } from "next/server";
import { count, eq, gt, sql } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { users, driverLocations, stressSignals, callHistory, textMessages, sensorAlerts } from "@/db/schema";

/**
 * GET /api/admin/stats
 *
 * Returns aggregated fleet statistics for the admin StatsBar.
 * All counts run in parallel via Promise.all.
 *
 * Response 200: {
 *   totalDrivers, onlineDrivers, activeSosAlerts,
 *   ongoingCalls, totalCallsToday, totalMessagesToday
 * }
 */
export async function GET() {
  await requireAdminSession();

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    [totalDriversRow],
    [onlineDriversRow],
    [activeSosRow],
    [ongoingCallsRow],
    [callsTodayRow],
    [msgsTodayRow],
    [sensorAlertRow],
  ] = await Promise.all([
    // Total registered drivers (excludes admins)
    db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, "driver")),

    // Drivers with a location update in the last 5 minutes
    db
      .select({ count: count() })
      .from(driverLocations)
      .where(gt(driverLocations.updatedAt, fiveMinutesAgo)),

    // Active SOS alerts
    db
      .select({ count: count() })
      .from(stressSignals)
      .where(eq(stressSignals.status, "active")),

    // Ongoing calls
    db
      .select({ count: count() })
      .from(callHistory)
      .where(eq(callHistory.status, "ongoing")),

    // Calls started today
    db
      .select({ count: count() })
      .from(callHistory)
      .where(gt(callHistory.createdAt, todayStart)),

    // Text messages sent today
    db
      .select({ count: count() })
      .from(textMessages)
      .where(gt(textMessages.createdAt, todayStart)),

    // Active sensor alerts (IoT container monitoring)
    db
      .select({ count: count() })
      .from(sensorAlerts)
      .where(eq(sensorAlerts.status, "active")),
  ]);

  return NextResponse.json({
    totalDrivers:     totalDriversRow.count,
    onlineDrivers:    onlineDriversRow.count,
    activeSosAlerts:  activeSosRow.count,
    ongoingCalls:     ongoingCallsRow.count,
    totalCallsToday:  callsTodayRow.count,
    totalMessagesToday: msgsTodayRow.count,
    sensorAlertCount: sensorAlertRow?.count ?? 0,
  });
}
