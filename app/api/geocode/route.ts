import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { RateLimiter } from "@/lib/rate-limit";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";

// 10 geocode requests per minute per user
const geocodeLimiter = new RateLimiter(10, 60_000);

// Simple in-process cache: query string → { data, expiresAt }
const geocodeCache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * GET /api/geocode?q=<search+query>
 *
 * Proxies Nominatim so we can:
 *  1. Attach the required User-Agent header (browser cannot set it reliably)
 *  2. Avoid CORS issues
 *  3. Add server-side rate limiting + caching
 *
 * Returns an array of geocode results.
 */
export async function GET(req: NextRequest) {
  await requireAuth();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return errorResponse("Query must be at least 2 characters", 400);
  }

  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed, retryAfterSeconds } = geocodeLimiter.check(ip);
  if (!allowed) {
    return errorResponse(
      `Rate limit exceeded. Retry after ${retryAfterSeconds}s`,
      429
    );
  }

  // Cache check
  const cacheKey = q.toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return successResponse({ results: cached.data }, 200);
  }

  const url =
    `${NOMINATIM_BASE}?format=jsonv2&q=${encodeURIComponent(q)}&limit=5&addressdetails=0`;

  const nominatimRes = await fetch(url, {
    headers: {
      "User-Agent": "TruckNet/1.0 (truck-fleet management; contact@trucknet.example)",
      "Accept-Language": "en",
    },
    next: { revalidate: 0 },
  });

  if (!nominatimRes.ok) {
    return errorResponse("Geocoding service unavailable", 502);
  }

  interface NominatimItem {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    type: string;
    boundingbox: [string, string, string, string];
  }

  const raw = (await nominatimRes.json()) as NominatimItem[];

  const results = raw.map((item) => ({
    place_id: item.place_id,
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    type: item.type,
    boundingBox: item.boundingbox.map(parseFloat) as [number, number, number, number],
  }));

  // Cache result
  geocodeCache.set(cacheKey, { data: results, expiresAt: Date.now() + CACHE_TTL_MS });

  return successResponse({ results }, 200);
}
