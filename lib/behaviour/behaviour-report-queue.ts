/**
 * lib/behaviour/behaviour-report-queue.ts
 *
 * BullMQ queue for generating behaviour reports.
 * Import this in any Next.js API route to enqueue jobs.
 */

import { Queue } from "bullmq";

export interface BehaviourReportJobData {
  tripId:   string;
  driverId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connection = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
} as any;

export const behaviourReportQueue = new Queue<BehaviourReportJobData>(
  "behaviour-reports",
  { connection }
);
