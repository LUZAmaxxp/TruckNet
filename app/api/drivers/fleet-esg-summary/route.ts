import { type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { driverEsgReports, users } from "@/db/schema";

export async function GET(_req: NextRequest) {
  await requireAdminSession();

  // All drivers with role='driver'
  const drivers = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.role, "driver"));

  // Latest ESG report per driver (last 3 months)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const cutoff = threeMonthsAgo.toISOString().split("T")[0];

  const reportRows = await db
    .select()
    .from(driverEsgReports)
    .where(eq(driverEsgReports.status, "ready"))
    .orderBy(desc(driverEsgReports.periodEnd));

  // Group by driver — take latest per driver
  const latestByDriver = new Map<string, typeof reportRows[0]>();
  for (const r of reportRows) {
    if (!latestByDriver.has(r.driverId)) latestByDriver.set(r.driverId, r);
  }

  const summary = drivers.map((d) => {
    const r = latestByDriver.get(d.id);
    return {
      driverId:           d.id,
      driverName:         d.name,
      driverEmail:        d.email,
      latestReportId:     r?.id ?? null,
      periodStart:        r?.periodStart ?? null,
      periodEnd:          r?.periodEnd ?? null,
      totalGhgKgco2eq:    r?.totalGhgKgco2eq ?? null,
      ghgIntensityPerKm:  r?.ghgIntensityPerKm ?? null,
      totalDistanceKm:    r?.totalDistanceKm ?? null,
      emptyRunPct:        r?.emptyRunPct ?? null,
      trainingHours:      r?.trainingHours ?? null,
      incidentCount:      r?.incidentCount ?? null,
      expiringCerts:      r?.expiringCertificationsCount ?? null,
    };
  });

  return successResponse({ summary }, 200);
}
