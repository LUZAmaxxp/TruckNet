/**
 * lib/redis.ts — Singleton ioredis client with graceful degradation.
 *
 * Redis is a PERFORMANCE OPTIMIZATION, not a hard dependency.
 * Every exported function is wrapped in try/catch.
 * If Redis is unavailable, all operations degrade to cache misses — the API
 * continues working correctly through normal OSRM calls, just without caching.
 *
 * Usage:
 *   import { safeGet, safeSet, safeDel } from '@/lib/redis';
 *   // Never call getRedis() directly in API routes.
 */

import Redis from "ioredis";

let client: Redis | null = null;

/**
 * getRedis — returns the singleton ioredis client, creating it on first call.
 * Safe to call multiple times; always returns the same instance.
 */
export function getRedis(): Redis {
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    // No REDIS_URL — create a disconnected stub that will always error
    // so safeGet / safeSet gracefully return null / no-op.
    client = new Redis({
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
    });
    return client;
  }

  client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    connectTimeout: 3000,
  });

  client.on("error", (err: Error) => {
    console.warn("[Redis] Connection error:", err.message);
  });

  client.on("connect", () => {
    console.log("[Redis] Connected");
  });

  // Trigger connection in background — do NOT await here
  client.connect().catch(() => {
    // silenced — error is handled by the 'error' event above
  });

  return client;
}

/**
 * isRedisAvailable — returns true only if the client has an active connection.
 */
export function isRedisAvailable(): boolean {
  return client?.status === "ready";
}

/**
 * safeGet — returns cached string value or null (on miss or any Redis error).
 */
export async function safeGet(key: string): Promise<string | null> {
  try {
    return await getRedis().get(key);
  } catch {
    return null;
  }
}

/**
 * safeSet — stores a string value with TTL. Silently ignores all errors.
 */
export async function safeSet(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  try {
    await getRedis().setex(key, ttlSeconds, value);
  } catch {
    // silenced — cache write failures are non-fatal
  }
}

/**
 * safeDel — deletes a key. Silently ignores all errors.
 */
export async function safeDel(key: string): Promise<void> {
  try {
    await getRedis().del(key);
  } catch {
    // silenced
  }
}
