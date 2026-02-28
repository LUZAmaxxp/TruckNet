import { EnvSchema, type Env } from "@/schemas/env.schema";

/**
 * Validates environment variables at startup using EnvSchema.
 * Throws a descriptive error if any required variable is missing or malformed.
 * Import this module (not process.env) anywhere env vars are needed.
 */
const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  throw new Error(
    "Invalid environment variables. Check server logs for details."
  );
}

export const env: Env = parsed.data;
