import { describe, it, expect } from "vitest";
import { LocationUpdateSchema } from "@/schemas/location.schema";

describe("LocationUpdateSchema", () => {
  const valid = { latitude: 48.8566, longitude: 2.3522 };

  it("accepts valid Paris coordinates", () => {
    const result = LocationUpdateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts boundary latitude -90", () => {
    expect(LocationUpdateSchema.safeParse({ ...valid, latitude: -90 }).success).toBe(true);
  });

  it("accepts boundary latitude 90", () => {
    expect(LocationUpdateSchema.safeParse({ ...valid, latitude: 90 }).success).toBe(true);
  });

  it("accepts boundary longitude -180", () => {
    expect(LocationUpdateSchema.safeParse({ ...valid, longitude: -180 }).success).toBe(true);
  });

  it("accepts boundary longitude 180", () => {
    expect(LocationUpdateSchema.safeParse({ ...valid, longitude: 180 }).success).toBe(true);
  });

  it("rejects latitude below -90", () => {
    const result = LocationUpdateSchema.safeParse({ ...valid, latitude: -90.1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("latitude");
  });

  it("rejects latitude above 90", () => {
    const result = LocationUpdateSchema.safeParse({ ...valid, latitude: 91 });
    expect(result.success).toBe(false);
  });

  it("rejects longitude below -180", () => {
    const result = LocationUpdateSchema.safeParse({ ...valid, longitude: -181 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("longitude");
  });

  it("rejects longitude above 180", () => {
    const result = LocationUpdateSchema.safeParse({ ...valid, longitude: 181 });
    expect(result.success).toBe(false);
  });

  it("rejects string latitude", () => {
    const result = LocationUpdateSchema.safeParse({ latitude: "48.8566", longitude: 2.3522 });
    expect(result.success).toBe(false);
  });

  it("rejects missing latitude", () => {
    const result = LocationUpdateSchema.safeParse({ longitude: 2.3522 });
    expect(result.success).toBe(false);
  });

  it("rejects missing longitude", () => {
    const result = LocationUpdateSchema.safeParse({ latitude: 48.8566 });
    expect(result.success).toBe(false);
  });

  it("rejects zero coordinates (equator) — valid", () => {
    expect(LocationUpdateSchema.safeParse({ latitude: 0, longitude: 0 }).success).toBe(true);
  });
});
