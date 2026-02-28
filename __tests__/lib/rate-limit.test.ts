import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  let limiter: RateLimiter;
  const KEY = "user-abc";
  const START = 1_000_000; // deterministic starting time (ms)

  beforeEach(() => {
    limiter = new RateLimiter(3, 10_000); // max 3 requests per 10 seconds
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("allows first request and returns remaining = max-1", () => {
    const result = limiter.check(KEY, START);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("allows up to max requests within the window", () => {
    limiter.check(KEY, START);
    limiter.check(KEY, START + 1000);
    const third = limiter.check(KEY, START + 2000);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks the (max+1)th request", () => {
    limiter.check(KEY, START);
    limiter.check(KEY, START + 1000);
    limiter.check(KEY, START + 2000);
    const fourth = limiter.check(KEY, START + 3000);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
  });

  // ── Window reset ──────────────────────────────────────────────────────────

  it("resets after window expires and allows requests again", () => {
    // exhaust all 3 slots
    limiter.check(KEY, START);
    limiter.check(KEY, START + 1000);
    limiter.check(KEY, START + 2000);
    // blocked
    expect(limiter.check(KEY, START + 3000).allowed).toBe(false);
    // after window boundary (10 001 ms): new window, allowed again
    const afterWindow = limiter.check(KEY, START + 10_001);
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(2);
  });

  it("window opens exactly at boundary (windowMs elapsed)", () => {
    limiter.check(KEY, START);
    limiter.check(KEY, START + 1000);
    limiter.check(KEY, START + 2000);
    // exactly at window boundary (equal to windowMs): resets
    const atBoundary = limiter.check(KEY, START + 10_000);
    expect(atBoundary.allowed).toBe(true);
  });

  // ── retryAfterSeconds ─────────────────────────────────────────────────────

  it("retryAfterSeconds is the ceil of remaining window time in seconds", () => {
    limiter.check(KEY, START);
    limiter.check(KEY, START + 1000);
    limiter.check(KEY, START + 2000);
    // blocked at START + 3000; window ends at START + 10000
    const result = limiter.check(KEY, START + 3000);
    // retryAfter = ceil((10000 - 3000) / 1000) = ceil(7) = 7
    expect(result.retryAfterSeconds).toBe(7);
  });

  // ── Isolation between keys ────────────────────────────────────────────────

  it("tracks different keys independently", () => {
    limiter.check("user-A", START);
    limiter.check("user-A", START);
    limiter.check("user-A", START);
    expect(limiter.check("user-A", START).allowed).toBe(false);
    // user-B is a fresh key — should be allowed
    expect(limiter.check("user-B", START).allowed).toBe(true);
  });

  // ── reset() ──────────────────────────────────────────────────────────────

  it("reset() clears a key and allows fresh requests", () => {
    limiter.check(KEY, START);
    limiter.check(KEY, START);
    limiter.check(KEY, START);
    expect(limiter.check(KEY, START).allowed).toBe(false);
    limiter.reset(KEY);
    expect(limiter.check(KEY, START).allowed).toBe(true);
  });

  // ── size ─────────────────────────────────────────────────────────────────

  it("size reflects number of tracked keys", () => {
    expect(limiter.size).toBe(0);
    limiter.check("k1", START);
    limiter.check("k2", START);
    expect(limiter.size).toBe(2);
    limiter.reset("k1");
    expect(limiter.size).toBe(1);
  });

  // ── Edge: max = 1 ────────────────────────────────────────────────────────

  it("max=1: first request allowed, second blocked immediately", () => {
    const single = new RateLimiter(1, 5000);
    expect(single.check(KEY, START).allowed).toBe(true);
    expect(single.check(KEY, START + 100).allowed).toBe(false);
  });

  // ── Pre-built singletons ─────────────────────────────────────────────────

  it("exports stressSignalLimiter (3 per 10 min)", async () => {
    const { stressSignalLimiter } = await import("@/lib/rate-limit");
    const r = stressSignalLimiter.check("test-stress-" + Date.now());
    expect(r.allowed).toBe(true);
  });

  it("exports voiceMessageLimiter (10 per 1 min)", async () => {
    const { voiceMessageLimiter } = await import("@/lib/rate-limit");
    const r = voiceMessageLimiter.check("test-voice-" + Date.now());
    expect(r.allowed).toBe(true);
  });
});
