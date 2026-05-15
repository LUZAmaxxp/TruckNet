import { type NextRequest, NextResponse } from "next/server";
import { eq, isNull, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { iotDevices } from "@/db/schema";

/**
 * GET /api/profile/device
 * Returns the IoT device currently linked to the authenticated user, or null.
 */
export async function GET(_req: NextRequest) {
  const session = await requireAuth();

  const [device] = await db
    .select({
      deviceId:    iotDevices.deviceId,
      truckLabel:  iotDevices.truckLabel,
      status:      iotDevices.status,
      lastSeenAt:  iotDevices.lastSeenAt,
    })
    .from(iotDevices)
    .where(eq(iotDevices.driverId, session.user.id))
    .limit(1);

  return NextResponse.json({ device: device ?? null });
}

/**
 * PUT /api/profile/device
 * Body: { deviceId: string }
 *
 * Links the given device to the authenticated user.
 * Rules:
 *  - Device must exist.
 *  - Device must be unclaimed (driverId IS NULL) OR already owned by the caller.
 *  - Any previous device the caller owned is automatically unlinked first.
 */
export async function PUT(req: NextRequest) {
  const session = await requireAuth();

  const body = await req.json() as { deviceId?: unknown };
  const deviceId = body?.deviceId;

  if (typeof deviceId !== "string" || deviceId.trim() === "") {
    return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
  }

  // Fetch target device
  const [target] = await db
    .select({ id: iotDevices.id, driverId: iotDevices.driverId })
    .from(iotDevices)
    .where(eq(iotDevices.deviceId, deviceId))
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  // Allow only if device is unclaimed or already belongs to this user
  if (target.driverId !== null && target.driverId !== session.user.id) {
    return NextResponse.json({ error: "Device is already claimed by another driver" }, { status: 409 });
  }

  // Unlink any previous device this user owned (one driver → one device)
  await db
    .update(iotDevices)
    .set({ driverId: null })
    .where(eq(iotDevices.driverId, session.user.id));

  // Link the selected device
  const [updated] = await db
    .update(iotDevices)
    .set({ driverId: session.user.id })
    .where(eq(iotDevices.deviceId, deviceId))
    .returning({
      deviceId:   iotDevices.deviceId,
      truckLabel: iotDevices.truckLabel,
      status:     iotDevices.status,
    });

  return NextResponse.json({ device: updated });
}

/**
 * DELETE /api/profile/device
 * Unlinks whichever device is currently linked to the authenticated user.
 */
export async function DELETE(_req: NextRequest) {
  const session = await requireAuth();

  await db
    .update(iotDevices)
    .set({ driverId: null })
    .where(eq(iotDevices.driverId, session.user.id));

  return NextResponse.json({ ok: true });
}
