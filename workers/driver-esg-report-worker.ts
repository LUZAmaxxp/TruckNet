/**
 * workers/driver-esg-report-worker.ts
 *
 * BullMQ Worker for the "driver-esg-reports" queue.
 * Triggered by POST /api/drivers/esg-reports or by the ESG scheduler.
 *
 * Job payload: { reportId, driverId, periodStart, periodEnd, language, triggeredBySchedule?, hrEmail? }
 *
 * Steps:
 *  1. buildEsgDataPackage — aggregate all KPIs
 *  2. Store KPI snapshot in driver_esg_reports
 *  3. Update status → 'ready'
 *  4. If triggered by schedule → send email with download link to hrEmail
 *  5. On error → status='failed', retry once after 2 minutes
 *
 * Start: npm run worker:esg (in package.worker.json)
 */

import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { driverEsgReports } from "@/db/schema";
import { buildEsgDataPackage } from "@/lib/driver-esg-aggregator";
import { sendEsgReportEmail } from "@/lib/esg-email";

export interface EsgReportJobData {
  reportId:              string;
  driverId:              string;
  periodStart:           string;
  periodEnd:             string;
  language:              string;
  triggeredBySchedule?:  boolean;
  hrEmail?:              string;
  appBaseUrl?:           string;
}

const QUEUE_NAME = "driver-esg-reports";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" } as any;

const worker = new Worker<EsgReportJobData>(
  QUEUE_NAME,
  async (job) => {
    const { reportId, driverId, periodStart, periodEnd, language, triggeredBySchedule, hrEmail, appBaseUrl } = job.data;

    console.log(`[esg-worker] Processing report ${reportId} for driver ${driverId} (${periodStart}→${periodEnd})`);

    // ── 1. Aggregate KPIs ────────────────────────────────────────────────────
    const data = await buildEsgDataPackage(driverId, periodStart, periodEnd, language);

    // ── 2. Persist KPI snapshot ──────────────────────────────────────────────
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
        tripIds:        data.trips.map((t) => t.id),
        shiftIds:       data.shifts.map((s) => s.id),
        incidentIds:    data.incidents.map((i) => i.id),
        maintenanceIds: data.maintenanceRecords.map((m) => m.id),
        trainingIds:    data.trainingRecords.map((t) => t.id),
        sensorReadingCount: data.sensorReadingCount,
        status:      "ready",
        generatedAt: new Date(),
        updatedAt:   new Date(),
      })
      .where(eq(driverEsgReports.id, reportId));

    console.log(`[esg-worker] Report ${reportId} status=ready`);

    // ── 4. Email HR if triggered by scheduler ────────────────────────────────
    if (triggeredBySchedule && hrEmail && appBaseUrl) {
      const downloadUrl = `${appBaseUrl}/admin/drivers/esg-reports/${reportId}`;
      await sendEsgReportEmail({
        to:         hrEmail,
        driverName: data.driverName,
        periodStart,
        periodEnd,
        reportId,
        downloadUrl,
      });
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on("failed", async (job, err) => {
  if (!job) return;
  console.error(`[esg-worker] Job ${job.id} failed:`, err.message);
  try {
    await db
      .update(driverEsgReports)
      .set({ status: "failed", errorMessage: err.message, updatedAt: new Date() })
      .where(eq(driverEsgReports.id, job.data.reportId));
  } catch (dbErr) {
    console.error("[esg-worker] Failed to update report status to failed:", dbErr);
  }
});

worker.on("completed", (job) => {
  console.log(`[esg-worker] Job ${job.id} completed`);
});

console.log("[esg-worker] Worker started — listening on queue:", QUEUE_NAME);
