/**
 * lib/route-cache.ts — Redis cache layer for OSRM route results.
 *
 * Cache key strategy:
 *   Coordinates are snapped to a ~111m grid (3 decimal places) before being
 *   used as cache keys. Two drivers within ~200m of each other heading to the
 *   same destination area will share a single cache entry, dramatically
 *   increasing hit rate without meaningful loss of route accuracy at truck scale.
 *
 * Key format:  osrm:route:{originLat3}:{originLng3}:{destLat3}:{destLng3}
 * TTL:         3600 seconds (1 hour)
 *
 * What IS cached:   { coordinates, distanceMeters, durationSeconds }
 * What is NOT cached: ETA — always computed fresh as Date.now() + durationSeconds
 *
 * Graceful degradation:
 *   Redis errors result in a cache miss. OSRM is called normally.
 *   fetchRouteWithCache NEVER throws due to Redis failures.
 */

import { fetchOsrmRoute, type OsrmRouteResult } from "@/lib/osrm";
import { safeGet, safeSet } from "@/lib/redis";

export type CachedRouteResult = OsrmRouteResult;

/** Cache TTL in seconds (1 hour). */
const ROUTE_CACHE_TTL = 3600;

/**
 * buildRouteCacheKey — snaps coordinates to 3dp grid and builds the Redis key.
 */
export function buildRouteCacheKey(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): string {
  const snap = (n: number) => Math.round(n * 1000) / 1000;
  return `osrm:route:${snap(originLat)}:${snap(originLng)}:${snap(destLat)}:${snap(destLng)}`;
}

/**
 * getCachedRoute — returns a cached OSRM result or null on miss / error.
 */
export async function getCachedRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<CachedRouteResult | null> {
  const key = buildRouteCacheKey(originLat, originLng, destLat, destLng);
  const raw = await safeGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedRouteResult;
  } catch {
    return null;
  }
}

/**
 * setCachedRoute — stores an OSRM result in Redis with a 1-hour TTL.
 */
export async function setCachedRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  result: CachedRouteResult
): Promise<void> {
  const key = buildRouteCacheKey(originLat, originLng, destLat, destLng);
  await safeSet(key, JSON.stringify(result), ROUTE_CACHE_TTL);
}

/**
 * fetchRouteWithCache — the ONLY function API routes should call for routing.
 *
 * Flow:
 *  1. Try Redis cache → cache HIT: return immediately (~1ms)
 *  2. Cache MISS: call OSRM (~300-800ms)
 *  3. Store successful OSRM result in Redis
 *  4. Return result
 *  5. OSRM errors are re-thrown. Redis errors are swallowed (never block routing).
 */
export async function fetchRouteWithCache(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<CachedRouteResult> {
  const key = buildRouteCacheKey(originLat, originLng, destLat, destLng);

  // 1. Cache lookup
  const cached = await getCachedRoute(originLat, originLng, destLat, destLng);
  if (cached) {
    console.log("[RouteCache] HIT", key);
    return cached;
  }

  // 2. Cache miss → call OSRM
  const osrmStart = Date.now();
  const result = await fetchOsrmRoute(
    originLng, // OSRM takes lng first
    originLat,
    destLng,
    destLat
  );
  const osrmMs = Date.now() - osrmStart;
  console.log("[RouteCache] MISS", key, "osrm_ms:", osrmMs);

  // 3. Store in cache (fire-and-forget — never blocks the response)
  void setCachedRoute(originLat, originLng, destLat, destLng, result);

  return result;
}
