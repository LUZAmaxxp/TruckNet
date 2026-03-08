/**
 * lib/behaviour/speed-limit-lookup.ts
 *
 * Look up road speed limit at GPS coordinates using the OpenStreetMap
 * Overpass API. Results are cached in Redis (3-decimal-place precision
 * ≈ 111 m grid, 30-day TTL) to avoid hammering the public API.
 *
 * Returns null if no limit found or on timeout — callers must treat
 * null as "do not flag" to avoid false positives.
 */

import { safeGet, safeSet } from "@/lib/redis";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const TIMEOUT_MS   = 3_000;
const CACHE_TTL    = 60 * 60 * 24 * 30; // 30 days

/** French defaults when maxspeed tag is absent, keyed by highway type */
const FR_DEFAULTS: Record<string, number> = {
  motorway:      130,
  trunk:         110,
  primary:       80,
  secondary:     80,
  tertiary:      80,
  unclassified:  80,
  residential:   30,
  living_street: 20,
  service:       20,
};

/** Parse a raw maxspeed tag string into km/h */
function parseMaxspeed(raw: string): number | null {
  const trimmed = raw.trim();

  // Named advisory values (FR)
  const namedMap: Record<string, number> = {
    "FR:urban":      50,
    "FR:rural":      80,
    "FR:motorway":   130,
    "FR:living_street": 20,
    "walk":          8,
    "none":          150, // unlimited — treat as very high limit (not flagged unless truly excessive)
  };
  if (namedMap[trimmed] !== undefined) return namedMap[trimmed];

  // e.g. "50 mph"
  const mph = trimmed.match(/^(\d+)\s*mph$/i);
  if (mph) return Math.round(parseInt(mph[1], 10) * 1.60934);

  // e.g. "80" or "80 km/h"
  const kmh = trimmed.match(/^(\d+)/);
  if (kmh) return parseInt(kmh[1], 10);

  return null;
}

function roundTo3dp(n: number): string {
  return n.toFixed(3);
}

export async function getSpeedLimit(lat: number, lng: number): Promise<number | null> {
  const cacheKey = `speed_limit:${roundTo3dp(lat)}:${roundTo3dp(lng)}`;

  const cached = await safeGet(cacheKey);
  if (cached !== null) {
    const v = parseInt(cached, 10);
    return isNaN(v) ? null : v;
  }

  const query = `
[out:json][timeout:3];
way(around:50,${lat},${lng})[maxspeed];
out tags;
`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(OVERPASS_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    `data=${encodeURIComponent(query)}`,
      signal:  controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[SpeedLimit] Overpass returned ${res.status}`);
      return null;
    }

    type OverpassElement = { type: string; tags: Record<string, string> };
    const json = (await res.json()) as { elements: OverpassElement[] };

    for (const el of json.elements ?? []) {
      if (el.tags?.maxspeed) {
        const limit = parseMaxspeed(el.tags.maxspeed);
        if (limit !== null && limit > 0) {
          await safeSet(cacheKey, String(limit), CACHE_TTL);
          return limit;
        }
      }

      // Fallback: use highway type default if no maxspeed tag
      if (el.tags?.highway) {
        const fallback = FR_DEFAULTS[el.tags.highway];
        if (fallback) {
          await safeSet(cacheKey, String(fallback), CACHE_TTL);
          return fallback;
        }
      }
    }

    // Nothing found — cache null as empty string to avoid repeat calls
    await safeSet(cacheKey, "", CACHE_TTL);
    return null;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[SpeedLimit] Overpass timeout — skipping speed check");
    } else {
      console.warn("[SpeedLimit] Overpass error:", err);
    }
    return null;
  }
}
