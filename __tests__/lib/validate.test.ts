import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateOrThrow, validateSocketEvent } from "@/lib/validate";

const TestSchema = z.object({
  name: z.string().min(2),
  age: z.number().min(0),
});

// ---------------------------------------------------------------------------
// validateOrThrow
// ---------------------------------------------------------------------------
describe("validateOrThrow", () => {
  it("returns typed data when input is valid", async () => {
    const result = await validateOrThrow(TestSchema, { name: "Alice", age: 30 });
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  it("throws a Response (400) when input is invalid", async () => {
    let caught: unknown;
    try {
      await validateOrThrow(TestSchema, { name: "A", age: -1 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Response);
    const res = caught as Response;
    expect(res.status).toBe(400);
  });

  it("thrown response body contains error + details fields", async () => {
    let caught: unknown;
    try {
      await validateOrThrow(TestSchema, { name: "A", age: -1 });
    } catch (err) {
      caught = err;
    }
    const res = caught as Response;
    const body = await res.json() as { error: string; details: unknown[] };
    expect(body.error).toBe("Validation failed");
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
  });

  it("throws on completely malformed input (null)", async () => {
    await expect(validateOrThrow(TestSchema, null)).rejects.toBeInstanceOf(Response);
  });

  it("throws on missing required fields", async () => {
    await expect(validateOrThrow(TestSchema, {})).rejects.toBeInstanceOf(Response);
  });
});

// ---------------------------------------------------------------------------
// validateSocketEvent
// ---------------------------------------------------------------------------
describe("validateSocketEvent", () => {
  it("returns { ok: true, data } for valid input", () => {
    const result = validateSocketEvent(TestSchema, { name: "Bob", age: 25 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: "Bob", age: 25 });
    }
  });

  it("returns { ok: false, error } for invalid input", () => {
    const result = validateSocketEvent(TestSchema, { name: "B", age: -5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Array.isArray(result.error)).toBe(true);
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("never throws — returns ok:false instead", () => {
    expect(() => validateSocketEvent(TestSchema, null)).not.toThrow();
    const result = validateSocketEvent(TestSchema, null);
    expect(result.ok).toBe(false);
  });

  it("error array items have path and message fields", () => {
    const result = validateSocketEvent(TestSchema, { name: "X", age: "bad" });
    if (!result.ok) {
      const issue = result.error[0];
      expect(issue).toHaveProperty("path");
      expect(issue).toHaveProperty("message");
    }
  });
});
