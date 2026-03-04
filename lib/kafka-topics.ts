/**
 * lib/kafka-topics.ts
 *
 * Single source of truth for all Kafka topic names.
 * Import from here in both producers (API routes) and consumers (workers).
 */

/** Main topic: every SOS stress signal produced by a driver. */
export const STRESS_SIGNALS_TOPIC = "trucknet.stress-signals";

/**
 * Dead-letter queue: messages that failed delivery after MAX_RETRIES
 * are routed here so they can be inspected and replayed manually.
 */
export const STRESS_SIGNALS_DLQ = "trucknet.stress-signals.dlq";
