/**
 * lib/admin-sos-stream.ts
 *
 * Singleton Kafka consumer that fans out incoming stress signals to every
 * connected admin SSE client.  One consumer group ("admin-sos-sse") is
 * created per Next.js process lifetime — regardless of how many admin tabs
 * are open — and its messages are broadcast in-process via a plain Set of
 * callbacks.
 *
 * Usage (server-side SSE route only):
 *   const unsub = await subscribeAdminSosStream(callback);
 *   // later: unsub()
 */

import { getKafka } from "@/lib/kafka";
import { kafkaInit } from "@/lib/kafka-init";
import { STRESS_SIGNALS_TOPIC } from "@/lib/kafka-topics";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Payload schema — matches what POST /api/stress-signals produces to Kafka
// ---------------------------------------------------------------------------

const StressSignalPayloadSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  senderName: z.string().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  createdAt: z.string(),
});

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Matches the SosAdminEntry shape used by the admin dashboard. */
export type AdminSosEntry = {
  id: string;
  userId: string;
  senderName: string;
  senderTag: string;
  senderAvatar: string | null;
  latitude: number;
  longitude: number;
  status: "active";
  createdAt: string;
};

type AlertCallback = (alert: AdminSosEntry) => void;

// ---------------------------------------------------------------------------
// In-process fan-out state
// ---------------------------------------------------------------------------

const callbacks = new Set<AlertCallback>();

/** Lazy-init promise — ensures only one consumer starts no matter how many
 *  concurrent SSE connections arrive simultaneously. */
let startPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register `cb` to be called for every new SOS alert arriving from Kafka.
 * Lazily starts the consumer on the first call.
 * Returns an unsubscribe function — call it when the SSE client disconnects.
 */
export async function subscribeAdminSosStream(cb: AlertCallback): Promise<() => void> {
  // Lazy-start the consumer; if it previously errored, retry on the next subscriber.
  startPromise ??= startConsumer().catch((err) => {
    startPromise = null;
    console.error("[admin-sos-stream] Kafka consumer failed to start:", err);
  });

  await startPromise;

  callbacks.add(cb);
  return () => {
    callbacks.delete(cb);
  };
}

// ---------------------------------------------------------------------------
// Kafka consumer — runs for the lifetime of the Next.js process
// ---------------------------------------------------------------------------

async function startConsumer(): Promise<void> {
  // Ensure topics exist (idempotent)
  await kafkaInit();

  const kafka = getKafka();
  const consumer = kafka.consumer({ groupId: "admin-sos-sse" });

  await consumer.connect();
  await consumer.subscribe({ topic: STRESS_SIGNALS_TOPIC, fromBeginning: false });

  // Disconnect cleanly when the process exits
  const shutdown = async () => {
    await consumer.disconnect();
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());

  await consumer.run({
    autoCommit: true,

    eachMessage: async ({ message }) => {
      const raw = message.value?.toString();
      if (!raw) return;

      let parsed: ReturnType<typeof StressSignalPayloadSchema.safeParse>;
      try {
        parsed = StressSignalPayloadSchema.safeParse(JSON.parse(raw));
      } catch {
        return; // malformed JSON — skip silently
      }
      if (!parsed.success) return;

      const signal = parsed.data;

      // Enrich with the sender's tag + avatar (single-row lookup)
      const [sender] = await db
        .select({ tag: users.tag, profileImageUrl: users.profileImageUrl })
        .from(users)
        .where(eq(users.id, signal.userId))
        .limit(1);

      const entry: AdminSosEntry = {
        id: signal.id,
        userId: signal.userId,
        senderName: signal.senderName ?? "Unknown",
        senderTag: sender?.tag ?? "",
        senderAvatar: sender?.profileImageUrl ?? null,
        latitude: signal.latitude,
        longitude: signal.longitude,
        status: "active",
        createdAt: signal.createdAt,
      };

      // Fan out to every connected admin SSE client
      callbacks.forEach((cb) => cb(entry));
    },
  });
}
