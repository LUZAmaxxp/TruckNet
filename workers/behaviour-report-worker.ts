/**
 * workers/behaviour-report-worker.ts
 *
 * BullMQ worker for the "behaviour-reports" queue.
 *
 * Job payload: { tripId, driverId }
 *
 * Steps:
 *  1. Mark report as 'generating' in behaviour_reports
 *  2. Wait 30 s to allow in-flight events (cam_agent) to arrive
 *  3. calculateBehaviourScore() → compute all sub-scores
 *  4. INSERT behaviour_reports with status='ready'
 *  5. UPDATE transport_trips.behaviour_report_id
 *  6. Publish Ably event 'behaviour_report_ready' on trips:{tripId}
 *  7. If global_score < 60 → extra critical notification via Ably
 *  8. On error → update report status to 'failed', retry once after 60s
 *
 * Start: npm run worker:behaviour (in package.worker.json)
 */

import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { behaviourReports, transportTrips } from "@/db/schema";
import { calculateBehaviourScore } from "@/lib/behaviour/score-calculator";
import { ablyPublish } from "@/lib/ably-server";
import type { BehaviourReportJobData } from "@/lib/behaviour/behaviour-report-queue";

const QUEUE_NAME = "behaviour-reports";
const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" } as any;

const worker = new Worker<BehaviourReportJobData>(
  QUEUE_NAME,
  async (job) => {
    const { tripId, driverId } = job.data;

    console.log(`[behaviour-worker] Processing report for trip ${tripId}`);

    // Create placeholder row so the UI can show "generating" state
    const [placeholder] = await db
      .insert(behaviourReports)
      .values({
        driverId,
        tripId,
        globalScore:           0,
        speedScore:            0,
        drivingStyleScore:     0,
        fatigueScore:          0,
        idleScore:             0,
        status:                "generating",
      })
      .onConflictDoNothing() // trip_id is UNIQUE — safe re-run
      .returning({ behaviourReportId: behaviourReports.behaviourReportId });

    // Wait 30 s for any late-arriving cam_agent events
    await new Promise((resolve) => setTimeout(resolve, 30_000));

    // Compute scores
    const data = await calculateBehaviourScore(tripId, driverId);

    const reportId = placeholder?.behaviourReportId;

    if (reportId) {
      // Update existing placeholder
      await db
        .update(behaviourReports)
        .set({
          ...data,
          status:      "ready",
          generatedAt: new Date(),
          updatedAt:   new Date(),
        })
        .where(eq(behaviourReports.behaviourReportId, reportId));
    } else {
      // Re-fetch if onConflictDoNothing fired (re-run scenario)
      const [existing] = await db
        .select({ behaviourReportId: behaviourReports.behaviourReportId })
        .from(behaviourReports)
        .where(eq(behaviourReports.tripId, tripId))
        .limit(1);

      if (existing) {
        await db
          .update(behaviourReports)
          .set({
            ...data,
            status:      "ready",
            generatedAt: new Date(),
            updatedAt:   new Date(),
          })
          .where(eq(behaviourReports.behaviourReportId, existing.behaviourReportId));
      }
    }

    // Fetch final report id
    const [report] = await db
      .select({ behaviourReportId: behaviourReports.behaviourReportId, globalScore: behaviourReports.globalScore })
      .from(behaviourReports)
      .where(eq(behaviourReports.tripId, tripId))
      .limit(1);

    if (report) {
      // Link report back to trip
      await db
        .update(transportTrips)
        .set({ behaviourReportId: report.behaviourReportId })
        .where(eq(transportTrips.id, tripId));

      // Notify front-end
      await ablyPublish(`trips:${tripId}`, "behaviour_report_ready", {
        tripId,
        behaviourReportId: report.behaviourReportId,
        globalScore:       report.globalScore,
      });

      // Extra alert for critical scores (< 60)
      if (report.globalScore < 60) {
        await ablyPublish("admin:behaviour", "critical_score_alert", {
          tripId,
          driverId,
          behaviourReportId: report.behaviourReportId,
          globalScore:       report.globalScore,
        });
      }
    }

    console.log(`[behaviour-worker] Completed report for trip ${tripId}, score=${data.globalScore}`);
  },
  { connection, concurrency: 2 }
);

worker.on("failed", async (job, err) => {
  console.error(`[behaviour-worker] Failed job ${job?.id}:`, err);
  if (!job) return;
  const { tripId } = job.data;
  await db
    .update(behaviourReports)
    .set({ status: "failed", updatedAt: new Date() })
    .where(eq(behaviourReports.tripId, tripId));
});

worker.on("error", (err) => console.error("[behaviour-worker] Worker error:", err));
