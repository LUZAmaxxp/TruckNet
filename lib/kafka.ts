import { Kafka, type Producer, type Admin, logLevel } from "kafkajs";
import { env } from "@/lib/env";

// Silence KafkaJS v2 partitioner migration warning
process.env.KAFKAJS_NO_PARTITIONER_WARNING = "1";

/**
 * lib/kafka.ts
 *
 * Singleton Kafka client, producer, and admin instances.
 *
 * Usage in API routes (server-side only):
 *   const producer = await getProducer();
 *   await producer.send({ topic: STRESS_SIGNALS_TOPIC, messages: [{ key, value }] });
 *
 * Do NOT import this in client components.
 */

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let _kafka: Kafka | null = null;

export function getKafka(): Kafka {
  if (!_kafka) {
    const brokers = env.KAFKA_BROKERS.split(",");

    _kafka = new Kafka({
      clientId: "trucknet",
      brokers,
      // In local dev Kafka may not be running — fail fast (1 retry) so errors
      // don't spam the log. Docker / production gets the full 8-retry backoff.
      retry: {
        initialRetryTime: 300,
        retries: process.env.NODE_ENV === "production" ? 8 : 1,
      },
      logLevel: process.env.NODE_ENV === "production" ? logLevel.ERROR : logLevel.WARN,
    });
  }
  return _kafka;
}

// ---------------------------------------------------------------------------
// Producer — lazy connect, cached for the process lifetime
// ---------------------------------------------------------------------------

let _producer: Producer | null = null;
let _producerConnecting: Promise<Producer> | null = null;

export async function getProducer(): Promise<Producer> {
  if (_producer) return _producer;

  // Guard against multiple concurrent callers racing to connect
  if (_producerConnecting) return _producerConnecting;

  _producerConnecting = (async () => {
    const producer = getKafka().producer({
      // Allow producing up to 5 messages in a single request batch
      maxInFlightRequests: 5,
      // Idempotent ensures exactly-once delivery per session (no duplicates on retry)
      idempotent: true,
    });
    await producer.connect();
    _producer = producer;
    _producerConnecting = null;
    console.log("[kafka] producer connected");
    return producer;
  })();

  return _producerConnecting;
}

// ---------------------------------------------------------------------------
// Admin — used by kafka-init.ts for topic provisioning
// ---------------------------------------------------------------------------

let _admin: Admin | null = null;

export async function getAdmin(): Promise<Admin> {
  if (_admin) return _admin;
  const admin = getKafka().admin();
  await admin.connect();
  _admin = admin;
  return admin;
}
