/**
 * scripts/seed-admin.ts
 *
 * One-time script to promote an existing user to admin role.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts --email=admin@trucknet.com
 *
 * Or hardcode the email below and run:
 *   npm run seed:admin
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

async function main() {
  const email =
    process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ??
    process.env.ADMIN_EMAIL;

  if (!email) {
    console.error(
      "Error: provide --email=your@email.com or set ADMIN_EMAIL env var"
    );
    process.exit(1);
  }

  const [user] = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.error(`No user found with email: ${email}`);
    console.error("Register as a driver first, then run this script.");
    process.exit(1);
  }

  if (user.role === "admin") {
    console.log(`✓ ${user.name} (${email}) is already an admin.`);
    process.exit(0);
  }

  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, user.id));

  console.log(`✓ Promoted ${user.name} (${email}) to admin role.`);
  console.log(`  User ID: ${user.id}`);
  console.log("  Log in and navigate to /admin");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
