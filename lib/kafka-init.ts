import { getAdmin } from "@/lib/kafka";
import { STRESS_SIGNALS_TOPIC, STRESS_SIGNALS_DLQ } from "@/lib/kafka-topics";

/**
 * lib/kafka-init.ts
 *
 * Idempotent topic provisioning — safe to call on every worker startup.
 * Creates required topics if they don't already exist; no-ops if they do.
 *
 * Called by workers/stress-signal-consumer.ts before subscribing.
 * Can also be run standalone: `npx tsx scripts/kafka-setup.ts`
 */

const TOPIC_CONFIGS = [
  {
    topic: STRESS_SIGNALS_TOPIC,
    numPartitions: 3,       // 3 partitions → up to 3 parallel consumer instances
    replicationFactor: 1,   // single-broker dev setup; set to 3 in multi-broker prod
    configEntries: [
      // 7-day retention — long enough to replay missed alerts after an outage
      { name: "retention.ms", value: String(7 * 24 * 60 * 60 * 1000) },
      { name: "cleanup.policy", value: "delete" },
    ],
  },
  {
    topic: STRESS_SIGNALS_DLQ,
    numPartitions: 1,
    replicationFactor: 1,
    configEntries: [
      // DLQ kept for 30 days for manual investigation
      { name: "retention.ms", value: String(30 * 24 * 60 * 60 * 1000) },
      { name: "cleanup.policy", value: "delete" },
    ],
  },
];

export async function kafkaInit(): Promise<void> {
  const admin = await getAdmin();
  const existingTopics = await admin.listTopics();

  const toCreate = TOPIC_CONFIGS.filter(
    (t) => !existingTopics.includes(t.topic)
  );

  if (toCreate.length === 0) {
    console.log("[kafka-init] all topics already exist — nothing to create");
    return;
  }

  await admin.createTopics({ topics: toCreate, waitForLeaders: true });

  for (const t of toCreate) {
    console.log(
      `[kafka-init] created topic "${t.topic}" (${t.numPartitions} partitions)`
    );
  }
}
