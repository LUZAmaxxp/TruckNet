/**
 * scripts/kafka-setup.ts
 *
 * Standalone topic provisioning script — run once when setting up a new
 * environment (or on every deploy; it's idempotent).
 *
 * Usage: npm run kafka:setup
 */
import { kafkaInit } from "@/lib/kafka-init";
import { getAdmin } from "@/lib/kafka";

async function main() {
  console.log("Provisioning Kafka topics…");
  await kafkaInit();
  const admin = await getAdmin();
  const topics = await admin.listTopics();
  console.log("Topics after setup:", topics.filter((t) => t.startsWith("trucknet.")));
  await admin.disconnect();
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("kafka-setup failed:", err);
  process.exit(1);
});
