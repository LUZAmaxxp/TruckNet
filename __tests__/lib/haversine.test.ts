import { describe, it, expect } from "vitest";
import { haversineDistanceKm } from "@/lib/haversine";

describe("haversineDistanceKm", () => {
  // ── Known coordinate pairs ────────────────────────────────────────────────

  it("returns 0 for identical coordinates", () => {
    expect(haversineDistanceKm(51.5074, -0.1278, 51.5074, -0.1278)).toBe(0);
  });

  it("returns 0 for (0, 0) to (0, 0)", () => {
    expect(haversineDistanceKm(0, 0, 0, 0)).toBe(0);
  });

  it("calculates London → Paris ≈ 340 km", () => {
    // London: 51.5074, -0.1278 | Paris: 48.8566, 2.3522
    const dist = haversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(dist).toBeGreaterThan(330);
    expect(dist).toBeLessThan(350);
  });

  it("calculates Algiers → Tunis ≈ 630 km", () => {
    // Algiers: 36.7372, 3.0865 | Tunis: 36.8188, 10.1655
    const dist = haversineDistanceKm(36.7372, 3.0865, 36.8188, 10.1655);
    expect(dist).toBeGreaterThan(600);
    expect(dist).toBeLessThan(660);
  });

  it("calculates New York → Los Angeles ≈ 3940 km", () => {
    // NY: 40.7128, -74.006 | LA: 34.0522, -118.2437
    const dist = haversineDistanceKm(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(3900);
    expect(dist).toBeLessThan(4000);
  });

  // ── Symmetry property ─────────────────────────────────────────────────────

  it("is symmetric: distance(A→B) === distance(B→A)", () => {
    const ab = haversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
    const ba = haversineDistanceKm(48.8566, 2.3522, 51.5074, -0.1278);
    expect(Math.abs(ab - ba)).toBeLessThan(0.001);
  });

  // ── Non-negative output ───────────────────────────────────────────────────

  it("always returns a non-negative value", () => {
    expect(haversineDistanceKm(-90, -180, 90, 180)).toBeGreaterThanOrEqual(0);
    expect(haversineDistanceKm(0, 0, -45, -90)).toBeGreaterThanOrEqual(0);
  });

  // ── Very close points ─────────────────────────────────────────────────────

  it("returns a small distance for points 1 metre apart (< 0.01 km)", () => {
    // 0.00001 degree latitude ≈ 1.11 metres
    const dist = haversineDistanceKm(48.8566, 2.3522, 48.85661, 2.3522);
    expect(dist).toBeLessThan(0.01);
    expect(dist).toBeGreaterThan(0);
  });

  // ── Known sub-50km pairs for filtering tests ──────────────────────────────

  it("two drivers 10 km apart are flagged as nearby (< 50 km)", () => {
    // Approx 10 km north of Paris
    const dist = haversineDistanceKm(48.8566, 2.3522, 48.9466, 2.3522);
    expect(dist).toBeLessThan(50);
  });

  it("London and Paris are NOT within 50 km", () => {
    const dist = haversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(dist).toBeGreaterThan(50);
  });
});
