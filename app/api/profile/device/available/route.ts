import { type NextRequest, NextResponse } from "next/server";
import { eq, isNull, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { iotDevices } from "@/db/schema";

/**
 * GET /api/profile/device/available
 * Returns devices available for linking: unclaimed ones + the one already owned by the caller.
 */
export async function GET(_req: NextRequest) {
  const session = await requireAuth();

  const devices = await db
    .select({
      deviceId:   iotDevices.deviceId,
      truckLabel: iotDevices.truckLabel,
      status:     iotDevices.status,
      driverId:   iotDevices.driverId,
    })
    .from(iotDevices)
    .where(
      or(
        isNull(iotDevices.driverId),
        eq(iotDevices.driverId, session.user.id),
      )
    )
    .orderBy(iotDevices.truckLabel);

  return NextResponse.json({ devices });
}
