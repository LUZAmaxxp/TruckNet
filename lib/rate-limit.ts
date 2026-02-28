/**
 * /lib/rate-limit.ts — Sliding window in-memory rate limiter
 *
 * Implementation: fixed-window with automatic reset at window boundary.
 * Keys are arbitrary strings — use userId for authenticated routes and IP
 * for unauthenticated routes (e.g., /api/auth/register).
 *
 * Production swap: replace RateLimiterStore with a Redis-backed adapter
 * (e.g., Upstash Ratelimit) at this boundary without changing any callsites.
 *
 * Thread-safety: JavaScript is single-threaded; no locking needed for Map ops.
 */

interface WindowEntry {
  count: number;
  windowStart: number; // Unix ms timestamp when the current window opened
}

/**
 * RateLimiter — stateful store for a single limit rule.
 * Create one instance per route/event rule you want to track.
 */
export class RateLimiter {
  private readonly store = new Map<string, WindowEntry>();
  private readonly max: number;
  private readonly windowMs: number;

  /**
   * @param max       Maximum requests allowed within the window
   * @param windowMs  Window size in milliseconds
   */
  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }

  /**
   * check — returns whether the key is within the rate limit.
   *
   * @param key         Unique identifier (userId or IP string)
   * @param nowMs       Current timestamp in ms (injectable for unit testing)
   * @returns           { allowed, retryAfterSeconds, remaining }
   */
  check(
    key: string,
    nowMs: number = Date.now()
  ): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
    const entry = this.store.get(key);

    // No entry or window has expired — start a fresh window
    if (!entry || nowMs - entry.windowStart >= this.windowMs) {
      this.store.set(key, { count: 1, windowStart: nowMs });
      return { allowed: true, retryAfterSeconds: 0, remaining: this.max - 1 };
    }

    // Within the current window — check against limit
    if (entry.count < this.max) {
      entry.count += 1;
      return {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: this.max - entry.count,
      };
    }

    // Limit exceeded — calculate how long until the window resets
    const windowEndsAt = entry.windowStart + this.windowMs;
    const retryAfterMs = windowEndsAt - nowMs;
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    return { allowed: false, retryAfterSeconds, remaining: 0 };
  }

  /**
   * reset — forcibly clear a key. Useful in tests or admin tooling.
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * size — number of tracked keys. Useful for diagnostics.
   */
  get size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// Pre-built limiter singletons used across HTTP middleware and route handlers.
// Keys for authenticated routes: userId  (session.user.id)
// Keys for unauthenticated routes: IP address
// ---------------------------------------------------------------------------

/** POST /api/stress-signals — 3 requests per 10 minutes per user */
export const stressSignalLimiter = new RateLimiter(3, 10 * 60 * 1000);

/** POST /api/voice-messages — 10 requests per 1 minute per user */
export const voiceMessageLimiter = new RateLimiter(10, 60 * 1000);

/** POST /api/auth/register — 5 requests per hour per IP */
export const registerLimiter = new RateLimiter(5, 60 * 60 * 1000);
