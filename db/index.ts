import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * PostgreSQL connection pool.
 * max: 20 connections — supports 10k concurrent users at application layer.
 * Import `db` anywhere Drizzle queries are needed.
 */
const client = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export type DB = typeof db;
