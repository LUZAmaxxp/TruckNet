import { type NextRequest, NextResponse } from "next/server";
import { desc, eq, and, gte, lte } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { sensorReadings } from "@/db/schema";

/**
 * GET /api/admin/sensors/[deviceId]/readings
 *
 * Paginated time-series readings for sparkline charts.
 *
 * Query params:
 *   from  — ISO date string (default: now - 1h)
 *   to    — ISO date string (default: now)
 *   limit — max rows (default: 300, max: 300)
 *
 * Response 200: { readings: SensorReading[] }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  await requireAdminSession();

  const { deviceId } = params;
  const { searchParams } = req.nextUrl;

  const rawFrom  = searchParams.get("from");
  const rawTo    = searchParams.get("to");
  const rawLimit = searchParams.get("limit");

  const from  = rawFrom  ? new Date(rawFrom)  : new Date(Date.now() - 60 * 60 * 1_000);
  const to    = rawTo    ? new Date(rawTo)    : new Date();
  const limit = Math.min(300, Math.max(1, Number(rawLimit ?? "300")));

  const readings = await db
    .select()
    .from(sensorReadings)
    .where(
      and(
        eq(sensorReadings.deviceId, deviceId),
        gte(sensorReadings.recordedAt, from),
        lte(sensorReadings.recordedAt, to)
      )
    )
    .orderBy(desc(sensorReadings.recordedAt))
    .limit(limit);

  return NextResponse.json({ readings });
}
