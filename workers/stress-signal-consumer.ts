/**
 * workers/stress-signal-consumer.ts
 *
 * Long-running Kafka consumer that fans out SOS/stress signal alerts
 * to all nearby drivers via Ably.
 *
 * Start: npm run worker:stress
 * Dev:   npm run worker:dev:stress   (hot-reload via tsx watch)
 *
 * Flow:
 *  1. kafkaInit() — create topics if missing (idempotent)
 *  2. Subscribe to trucknet.stress-signals
 *  3. For each message:
 *     a. Parse + validate payload
 *     b. Query all driver locations, haversine-filter to ≤ 50 km
 *     c. ablyPublish to per-user channel (user:<driverId>)
 *     d. ablyPublish to broadcast channel (stress:alerts)
 *     e. On failure: route to DLQ after MAX_RETRIES exhausted
 *  4. Commit offset only after successful delivery
 */

import { getKafka } from "@/lib/kafka";
import { kafkaInit } from "@/lib/kafka-init";
import { STRESS_SIGNALS_TOPIC, STRESS_SIGNALS_DLQ } from "@/lib/kafka-topics";
import { ablyPublish } from "@/lib/ably-server";
import { db } from "@/db";
import { driverLocations, users } from "@/db/schema";
import { eq, gt } from "drizzle-orm";
import { haversineDistanceKm } from "@/lib/haversine";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Payload schema — validates messages pulled from Kafka
// ---------------------------------------------------------------------------

const StressSignalPayloadSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  senderName: z.string().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  createdAt: z.string(), // ISO string
});

type StressSignalPayload = z.infer<typeof StressSignalPayloadSchema>;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CONSUMER_GROUP_ID = "stress-worker";
const NEARBY_RADIUS_KM = 50;
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Delivery: fan out to all nearby online drivers via Ably
// ---------------------------------------------------------------------------

async function deliverToNearbyDrivers(signal: StressSignalPayload): Promise<void> {
  // Fetch only non-stale driver locations (updated within the last 5 minutes)
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
  const allLocations = await db
    .select({
      userId: driverLocations.userId,
      latitude: driverLocations.latitude,
      longitude: driverLocations.longitude,
      name: users.name,
    })
    .from(driverLocations)
    .innerJoin(users, eq(driverLocations.userId, users.id))
    .where(gt(driverLocations.updatedAt, staleThreshold));

  // Filter to drivers within 50 km, excluding the sender themselves
  const nearby = allLocations.filter(
    (loc) =>
      loc.userId !== signal.userId &&
      haversineDistanceKm(signal.latitude, signal.longitude, loc.latitude, loc.longitude) <=
        NEARBY_RADIUS_KM
  );

  // Build the notification payload (matches ServerToClientEvents.stress_signal_alert)
  const alertPayload = {
    id: signal.id,
    userId: signal.userId,
    senderName: signal.senderName,
    latitude: signal.latitude,
    longitude: signal.longitude,
    createdAt: signal.createdAt,
  };

  // Always broadcast to the shared stress:alerts channel so every online driver
  // receives an in-app toast + browser notification regardless of distance.
  const broadcastPublish = ablyPublish("stress:alerts", "stress_signal_alert", alertPayload);

  if (nearby.length === 0) {
    await broadcastPublish;
    console.log(`[stress-worker] signal ${signal.id} — broadcast sent, no nearby drivers for per-user notify`);
    return;
  }

  // Fan-out: also send to each nearby driver's private channel in parallel
  const perUserPublishes = nearby.map((driver) =>
    ablyPublish(`user:${driver.userId}`, "stress_signal_alert", alertPayload)
  );

  await Promise.all([broadcastPublish, ...perUserPublishes]);

  console.log(
    `[stress-worker] signal ${signal.id} delivered to ${nearby.length} nearby driver(s)`
  );
}

// ---------------------------------------------------------------------------
// Main consumer loop
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[stress-worker] starting up…");

  // Ensure topics exist before subscribing
  await kafkaInit();

  const kafka = getKafka();
  const consumer = kafka.consumer({ groupId: CONSUMER_GROUP_ID });

  // Graceful shutdown on SIGTERM / SIGINT (Docker stop, Ctrl+C)
  const shutdown = async (signal: string) => {
    console.log(`\n[stress-worker] received ${signal}, disconnecting…`);
    await consumer.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await consumer.connect();
  await consumer.subscribe({
    topic: STRESS_SIGNALS_TOPIC,
    fromBeginning: false, // only process new signals; replay manually from Kafka UI if needed
  });

  const dlqProducer = kafka.producer();
  await dlqProducer.connect();

  await consumer.run({
    // autoCommit: true means offset is committed after eachMessage resolves.
    // If eachMessage throws, KafkaJS retries the batch — which achieves at-least-once delivery.
    autoCommit: true,

    eachMessage: async ({ topic, partition, message }) => {
      const raw = message.value?.toString();
      if (!raw) return;

      let payload: StressSignalPayload;

      try {
        const parsed: unknown = JSON.parse(raw);
        payload = StressSignalPayloadSchema.parse(parsed);
      } catch (parseErr) {
        console.error(
          `[stress-worker] invalid message on ${topic}[${partition}] — routing to DLQ`,
          parseErr
        );
        await dlqProducer.send({
          topic: STRESS_SIGNALS_DLQ,
          messages: [
            {
              key: message.key,
              value: JSON.stringify({
                originalMessage: raw,
                error: String(parseErr),
                failedAt: new Date().toISOString(),
                reason: "parse_error",
              }),
            },
          ],
        });
        // Don't throw — a parse error is unrecoverable; move past the message
        return;
      }

      try {
        await deliverToNearbyDrivers(payload);
      } catch (deliveryErr) {
        console.error(
          `[stress-worker] delivery failed for signal ${payload.id} — routing to DLQ`,
          deliveryErr
        );
        await dlqProducer.send({
          topic: STRESS_SIGNALS_DLQ,
          messages: [
            {
              key: message.key,
              value: JSON.stringify({
                originalMessage: raw,
                error: String(deliveryErr),
                failedAt: new Date().toISOString(),
                reason: "delivery_error",
              }),
            },
          ],
        });
        // Re-throw so KafkaJS retries delivery (up to its internal retry limit)
        throw deliveryErr;
      }
    },
  });
}

main().catch((err) => {
  console.error("[stress-worker] fatal error:", err);
  process.exit(1);
});
