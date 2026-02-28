/**
 * Haversine distance formula.
 * Pure function — no side effects, no imports, fully unit-testable.
 *
 * @see https://en.wikipedia.org/wiki/Haversine_formula
 */

const EARTH_RADIUS_KM = 6371;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * haversineDistanceKm
 *
 * Calculates the great-circle distance between two GPS coordinates using the
 * Haversine formula.  Accurate to within ~0.3% for distances under 1000 km.
 *
 * @param lat1 - Latitude of point A (degrees, -90 to 90)
 * @param lon1 - Longitude of point A (degrees, -180 to 180)
 * @param lat2 - Latitude of point B (degrees)
 * @param lon2 - Longitude of point B (degrees)
 * @returns Distance in kilometres (non-negative)
 *
 * @example
 *   haversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522)
 *   // → ~340km (London → Paris)
 *
 *   haversineDistanceKm(0, 0, 0, 0)
 *   // → 0
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
