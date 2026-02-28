import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// drizzle-kit runs outside Next.js context, so we load .env.local manually.
dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  // For `drizzle-kit generate`, a real URL is not needed.
  // For `drizzle-kit push/migrate`, set DATABASE_URL in .env.local first.
  process.env.DATABASE_URL = "postgresql://placeholder:placeholder@localhost:5432/placeholder";
}

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: false,
} satisfies Config;
