import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { validateOrThrow } from "@/lib/validate";
import { successResponse } from "@/lib/api";
import { StressSignalSchema } from "@/schemas/stress.schema";
import { db } from "@/db";
import { stressSignals, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProducer } from "@/lib/kafka";
import { STRESS_SIGNALS_TOPIC } from "@/lib/kafka-topics";
import { env } from "@/lib/env";

/**
 * POST /api/stress-signals
 *
 * Creates a new stress signal for the authenticated driver.
 * Status is set to 'active' on creation.
 * Rate limited to 3 per 10 minutes (enforced in middleware.ts).
 *
 * Body: { latitude: number, longitude: number }
 * Response 201: StressSignal row
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const body: unknown = await req.json();
  const { latitude, longitude } = await validateOrThrow(StressSignalSchema, body);

  const [signal] = await db
    .insert(stressSignals)
    .values({
      userId: session.user.id,
      latitude,
      longitude,
      status: "active",
    })
    .returning();

  // Fetch sender name for the Kafka payload (consumer uses it to enrich Ably alerts)
  const [sender] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Produce to Kafka — fire-and-forget after the DB write so the API response
  // is never delayed by Kafka. The consumer handles fan-out to nearby drivers.
  // Skip when KAFKA_ENABLED=false (local dev without a running broker).
  if (env.KAFKA_ENABLED === "true") {
    getProducer()
      .then((producer) =>
        producer.send({
          topic: STRESS_SIGNALS_TOPIC,
          messages: [
            {
              // Keying by signal ID routes the same signal to the same partition
              // (idempotency guarantee for retries).
              key: signal.id,
              value: JSON.stringify({
                id: signal.id,
                userId: signal.userId,
                senderName: sender?.name ?? null,
                latitude: signal.latitude,
                longitude: signal.longitude,
                createdAt: signal.createdAt,
              }),
            },
          ],
        })
      )
      .catch((err) =>
        console.error("[stress-signals] kafka produce failed:", err)
      );
  }

  return successResponse(signal, 201);
}
