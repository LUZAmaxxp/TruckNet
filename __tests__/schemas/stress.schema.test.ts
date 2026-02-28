import { describe, it, expect } from "vitest";
import { StressSignalSchema } from "@/schemas/stress.schema";

describe("StressSignalSchema", () => {
  const valid = { latitude: 36.7372, longitude: 3.0865 }; // Algiers

  it("accepts valid Algiers coordinates", () => {
    expect(StressSignalSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts equator (0, 0)", () => {
    expect(StressSignalSchema.safeParse({ latitude: 0, longitude: 0 }).success).toBe(true);
  });

  it("accepts boundary: latitude -90 (south pole)", () => {
    expect(StressSignalSchema.safeParse({ ...valid, latitude: -90 }).success).toBe(true);
  });

  it("accepts boundary: latitude 90 (north pole)", () => {
    expect(StressSignalSchema.safeParse({ ...valid, latitude: 90 }).success).toBe(true);
  });

  it("accepts boundary: longitude -180", () => {
    expect(StressSignalSchema.safeParse({ ...valid, longitude: -180 }).success).toBe(true);
  });

  it("accepts boundary: longitude 180", () => {
    expect(StressSignalSchema.safeParse({ ...valid, longitude: 180 }).success).toBe(true);
  });

  it("rejects latitude > 90", () => {
    const result = StressSignalSchema.safeParse({ ...valid, latitude: 90.001 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("latitude");
  });

  it("rejects latitude < -90", () => {
    expect(StressSignalSchema.safeParse({ ...valid, latitude: -91 }).success).toBe(false);
  });

  it("rejects longitude > 180", () => {
    const result = StressSignalSchema.safeParse({ ...valid, longitude: 180.1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("longitude");
  });

  it("rejects longitude < -180", () => {
    expect(StressSignalSchema.safeParse({ ...valid, longitude: -200 }).success).toBe(false);
  });

  it("rejects string latitude", () => {
    expect(StressSignalSchema.safeParse({ latitude: "36.7", longitude: 3.09 }).success).toBe(false);
  });

  it("rejects missing latitude", () => {
    expect(StressSignalSchema.safeParse({ longitude: 3.0865 }).success).toBe(false);
  });

  it("rejects missing longitude", () => {
    expect(StressSignalSchema.safeParse({ latitude: 36.7372 }).success).toBe(false);
  });

  it("rejects empty object", () => {
    const result = StressSignalSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues.length).toBeGreaterThanOrEqual(2);
  });
});
