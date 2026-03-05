import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { sensorAlerts } from "@/db/schema";
import { ablyPublish } from "@/lib/ably-server";

/**
 * PATCH /api/admin/sensors/alerts/[alertId]/acknowledge
 *
 * Admin acknowledges a sensor alert. Sets status to 'acknowledged',
 * records ackedAt + ackedBy, and notifies other admin clients via Ably.
 *
 * Response 200: { success: true }
 * Response 404: { error: "Alert not found" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { alertId: string } }
) {
  const session = await requireAdminSession();
  const { alertId } = params;

  const [existing] = await db
    .select({ id: sensorAlerts.id, deviceId: sensorAlerts.deviceId })
    .from(sensorAlerts)
    .where(eq(sensorAlerts.id, alertId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  await db
    .update(sensorAlerts)
    .set({
      status:  "acknowledged",
      ackedAt: new Date(),
      ackedBy: session.user.id,
    })
    .where(eq(sensorAlerts.id, alertId));

  // Notify all connected admin clients so they can remove the card
  await ablyPublish("admin:sensors", "sensor_alert_acked", {
    alertId,
    deviceId: existing.deviceId,
    ackedBy:  session.user.id,
  });

  return NextResponse.json({ success: true });
}
