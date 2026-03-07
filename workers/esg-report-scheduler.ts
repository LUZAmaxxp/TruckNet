/**
 * workers/esg-report-scheduler.ts
 *
 * BullMQ cron job that runs daily at 06:00.
 * Checks esg_report_schedules for entries where nextRunAt <= today AND active=true.
 * For each matching schedule, queues one report job per active driver.
 * Updates schedule.nextRunAt and lastRunAt after each run.
 *
 * Period calculation:
 *  - monthly:   previous calendar month
 *  - quarterly: previous calendar quarter (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec)
 *
 * Start: npm run worker:esg-scheduler (in package.worker.json)
 */

import { Queue, Worker } from "bullmq";
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  subQuarters,
  startOfQuarter,
  endOfQuarter,
  endOfMonth as eom,
  endOfQuarter as eoq,
  addMonths,
  addQuarters,
} from "date-fns";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { esgReportSchedules, driverEsgReports, users } from "@/db/schema";
import type { EsgReportJobData } from "./driver-esg-report-worker";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" } as any;

const reportQueue = new Queue("driver-esg-reports", { connection });
const schedulerQueue = new Queue("esg-scheduler", { connection });

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

function computePeriod(periodType: "monthly" | "quarterly", now: Date): { start: string; end: string; nextRunAt: string } {
  if (periodType === "monthly") {
    const prevMonth = subMonths(now, 1);
    return {
      start:      format(startOfMonth(prevMonth), "yyyy-MM-dd"),
      end:        format(endOfMonth(prevMonth),   "yyyy-MM-dd"),
      nextRunAt:  format(endOfMonth(addMonths(now, 0)), "yyyy-MM-dd"),
    };
  }
  // quarterly
  const prevQ = subQuarters(now, 1);
  return {
    start:     format(startOfQuarter(prevQ), "yyyy-MM-dd"),
    end:       format(endOfQuarter(prevQ),   "yyyy-MM-dd"),
    nextRunAt: format(endOfQuarter(addQuarters(now, 0)), "yyyy-MM-dd"),
  };
}

// ---------------------------------------------------------------------------
// Main scheduler handler
// ---------------------------------------------------------------------------

async function runScheduler(): Promise<void> {
  const today = format(new Date(), "yyyy-MM-dd");
  console.log(`[esg-scheduler] Running check for ${today}`);

  const schedules = await db
    .select()
    .from(esgReportSchedules)
    .where(and(eq(esgReportSchedules.active, true), lte(esgReportSchedules.nextRunAt, today)));

  if (schedules.length === 0) {
    console.log("[esg-scheduler] No schedules due today");
    return;
  }

  const allDrivers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "driver"));

  const appBaseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  for (const schedule of schedules) {
    const period = computePeriod(
      schedule.periodType as "monthly" | "quarterly",
      new Date(),
    );

    let reportCount = 0;

    for (const driver of allDrivers) {
      // Create report record
      const [report] = await db
        .insert(driverEsgReports)
        .values({
          driverId:    driver.id,
          periodType:  schedule.periodType,
          periodStart: period.start,
          periodEnd:   period.end,
          status:      "generating",
          createdAt:   new Date(),
          updatedAt:   new Date(),
        })
        .returning({ id: driverEsgReports.id });

      // Enqueue worker job
      await reportQueue.add(
        "generate-report",
        {
          reportId:             report.id,
          driverId:             driver.id,
          periodStart:          period.start,
          periodEnd:            period.end,
          language:             schedule.language,
          triggeredBySchedule:  true,
          hrEmail:              schedule.hrEmail,
          appBaseUrl,
        },
        {
          attempts: 2,
          backoff: { type: "fixed", delay: 120_000 },
        }
      );

      reportCount++;
    }

    // Update schedule
    await db
      .update(esgReportSchedules)
      .set({
        lastRunAt:          today,
        lastRunReportCount: reportCount,
        nextRunAt:          period.nextRunAt,
        updatedAt:          new Date(),
      })
      .where(eq(esgReportSchedules.id, schedule.id));

    console.log(`[esg-scheduler] Schedule ${schedule.id}: queued ${reportCount} reports for ${period.start}→${period.end}`);
  }
}

// ---------------------------------------------------------------------------
// BullMQ cron worker that triggers runScheduler daily at 06:00
// ---------------------------------------------------------------------------

const schedulerWorker = new Worker(
  "esg-scheduler",
  async () => { await runScheduler(); },
  { connection }
);

schedulerWorker.on("completed", () => console.log("[esg-scheduler] Daily check completed"));
schedulerWorker.on("failed",    (_job, err) => console.error("[esg-scheduler] Daily check failed:", err.message));

// Register the daily cron job (idempotent — BullMQ deduplicates by jobId)
schedulerQueue.add(
  "daily-check",
  {},
  {
    repeat: { pattern: "0 6 * * *" },
    jobId:  "esg-scheduler-daily",
  }
).then(() => console.log("[esg-scheduler] Cron registered: daily at 06:00"))
  .catch(console.error);

console.log("[esg-scheduler] Scheduler started");
