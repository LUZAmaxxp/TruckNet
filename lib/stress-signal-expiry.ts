import { db } from "@/db";
import { stressSignals } from "@/db/schema";
import { eq, and, lt } from "drizzle-orm";

/** Number of minutes after which an active stress signal is considered stale. */
const EXPIRY_MINUTES = 30;

/**
 * expireStaleStressSignals
 *
 * Marks all 'active' stress signals older than 30 minutes as 'resolved'.
 *
 * Designed to be called:
 *   - On-read: before the GET /api/stress-signals/active handler returns data
 *   - From a cron job/scheduled task (Wave 7+) for background cleanup
 *
 * @returns The number of rows that were updated to 'resolved'
 *
 * @example
 *   const count = await expireStaleStressSignals();
 *   console.log(`Expired ${count} stale stress signals`);
 */
export async function expireStaleStressSignals(): Promise<number> {
  const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000);

  const updated = await db
    .update(stressSignals)
    .set({ status: "resolved" })
    .where(
      and(
        eq(stressSignals.status, "active"),
        lt(stressSignals.createdAt, cutoff)
      )
    )
    .returning({ id: stressSignals.id });

  return updated.length;
}
