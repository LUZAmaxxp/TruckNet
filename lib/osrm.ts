/**
 * OSRM Public Demo Server client.
 * All routing calls MUST be made server-side (via API routes) — never from the browser.
 *
 * Coordinate convention:
 *   OSRM uses  [longitude, latitude]  order.
 *   Leaflet uses [latitude, longitude] order.
 *   This module returns OSRM's [lng, lat] pairs as-is;
 *   callers must reverse to [lat, lng] before passing to Leaflet.
 */

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

export interface OsrmRouteResult {
  /** GeoJSON LineString coordinates — each element is [longitude, latitude] */
  coordinates: [number, number][];
  /** Total route distance in metres */
  distanceMeters: number;
  /** Total estimated travel duration in seconds */
  durationSeconds: number;
}

/**
 * Fetch a driving route from OSRM between two coordinate pairs.
 *
 * @param originLng     Origin longitude
 * @param originLat     Origin latitude
 * @param destLng       Destination longitude
 * @param destLat       Destination latitude
 */
/**
 * @internal — call `fetchRouteWithCache` from `lib/route-cache.ts` instead of this function directly.
 * Direct calls bypass the Redis cache and will always hit OSRM.
 */
export async function fetchOsrmRoute(
  originLng: number,
  originLat: number,
  destLng: number,
  destLat: number
): Promise<OsrmRouteResult> {
  const url =
    `${OSRM_BASE}/${originLng},${originLat};${destLng},${destLat}` +
    `?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url, {
    headers: { "User-Agent": "TruckNet/1.0" },
    next: { revalidate: 0 }, // always fresh — routes depend on real-time position
  });

  if (!res.ok) {
    throw new Error(`OSRM request failed: ${res.status} ${res.statusText}`);
  }

  interface OsrmJson {
    code: string;
    routes?: {
      distance: number;
      duration: number;
      geometry: { type: "LineString"; coordinates: [number, number][] };
    }[];
  }

  const data = (await res.json()) as OsrmJson;

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(`OSRM returned no route. Code: ${data.code}`);
  }

  const route = data.routes[0]!;
  return {
    coordinates: route.geometry.coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** "1.2 km" or "950 m" */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/** "2 h 15 min", "45 min", "3 min" */
export function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 1) return "< 1 min";
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/** Returns an ISO string representing now + durationSeconds */
export function computeEta(durationSeconds: number): string {
  const eta = new Date(Date.now() + durationSeconds * 1000);
  return eta.toISOString();
}

/** "ETA 14:35" (local time, 24-hour) */
export function formatEta(etaIso: string): string {
  const d = new Date(etaIso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `ETA ${h}:${m}`;
}
