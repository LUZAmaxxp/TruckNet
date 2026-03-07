import { type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { driverEsgReports, users } from "@/db/schema";
import { GenerateDriverEsgReportSchema } from "@/schemas/driver-esg-report.schema";
import { isUUID } from "@/lib/validate-uuid";
import { buildEsgDataPackage } from "@/lib/driver-esg-aggregator";

export async function GET(req: NextRequest) {
  await requireAdminSession();

  const { searchParams } = req.nextUrl;
  const driverId = searchParams.get("driverId");

  let rows;
  if (driverId) {
    if (!isUUID(driverId)) return errorResponse("Invalid driverId", 400);
    rows = await db
      .select()
      .from(driverEsgReports)
      .where(eq(driverEsgReports.driverId, driverId))
      .orderBy(desc(driverEsgReports.createdAt));
  } else {
    rows = await db
      .select()
      .from(driverEsgReports)
      .orderBy(desc(driverEsgReports.createdAt))
      .limit(100);
  }

  return successResponse({ reports: rows }, 200);
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();

  const body = await req.json().catch(() => null);
  const parsed = GenerateDriverEsgReportSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const d = parsed.data;

  const [driver] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, d.driver_id))
    .limit(1);
  if (!driver) return errorResponse("Driver not found", 404);

  // Create a report record in 'generating' state
  const [report] = await db
    .insert(driverEsgReports)
    .values({
      driverId:    d.driver_id,
      periodType:  d.period_type,
      periodStart: d.period_start,
      periodEnd:   d.period_end,
      status:      "generating",
      generatedBy: session.user.id,
      createdAt:   new Date(),
      updatedAt:   new Date(),
    })
    .returning();

  // Process synchronously — aggregate KPIs and mark ready
  try {
    const data = await buildEsgDataPackage(d.driver_id, d.period_start, d.period_end, d.language ?? "fr");

    await db
      .update(driverEsgReports)
      .set({
        totalTrips:                  data.totalTrips,
        emptyRunCount:               data.emptyRunCount,
        emptyRunPct:                 data.emptyRunPct,
        totalDistanceKm:             data.totalDistanceKm,
        totalDrivingHours:           data.totalDrivingHours,
        totalShiftHours:             data.totalShiftHours,
        totalOvertimeHours:          data.totalOvertimeHours,
        totalFuelLiters:             data.totalFuelLiters,
        totalGhgKgco2eq:             data.ghgScope1Kgco2eq,
        ghgIntensityPerKm:           data.ghgIntensityPerKm,
        ghgIntensityPerTonneKm:      data.ghgIntensityPerTonneKm,
        incidentCount:               data.incidentCount,
        workStoppageCount:           data.workStoppageCount,
        cargoBreachCount:            data.cargoBreachCount,
        avgCargoTempC:               data.avgCargoTempC,
        maintenanceCount:            data.maintenanceCount,
        trainingHours:               data.trainingHoursTotal,
        certificationsCount:         data.certificationsActive,
        expiringCertificationsCount: data.certificationsExpiring90d,
        tripIds:             data.trips.map((t) => t.id),
        shiftIds:            data.shifts.map((s) => s.id),
        incidentIds:         data.incidents.map((i) => i.id),
        maintenanceIds:      data.maintenanceRecords.map((m) => m.id),
        trainingIds:         data.trainingRecords.map((t) => t.id),
        sensorReadingCount:  data.sensorReadingCount,
        status:              "ready",
        generatedAt:         new Date(),
        updatedAt:           new Date(),
      })
      .where(eq(driverEsgReports.id, report.id));

    const [ready] = await db.select().from(driverEsgReports).where(eq(driverEsgReports.id, report.id)).limit(1);
    return successResponse({ report: ready }, 201);
  } catch (err) {
    await db
      .update(driverEsgReports)
      .set({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err), updatedAt: new Date() })
      .where(eq(driverEsgReports.id, report.id));
    return errorResponse("Report generation failed", 500);
  }
}
