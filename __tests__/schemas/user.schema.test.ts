import { describe, it, expect } from "vitest";
import { UserRegisterSchema, UserLoginSchema } from "@/schemas/user.schema";

// ---------------------------------------------------------------------------
// UserRegisterSchema
// ---------------------------------------------------------------------------
describe("UserRegisterSchema", () => {
  const valid = { name: "Alice Driver", email: "alice@example.com", password: "securePass1" };

  it("accepts a valid registration payload", () => {
    const result = UserRegisterSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 2 characters", () => {
    const result = UserRegisterSchema.safeParse({ ...valid, name: "A" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });

  it("accepts name exactly 2 characters long", () => {
    const result = UserRegisterSchema.safeParse({ ...valid, name: "Jo" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = UserRegisterSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("email");
  });

  it("rejects empty email", () => {
    const result = UserRegisterSchema.safeParse({ ...valid, email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = UserRegisterSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("password");
  });

  it("accepts password exactly 8 characters long", () => {
    const result = UserRegisterSchema.safeParse({ ...valid, password: "exactly8" });
    expect(result.success).toBe(true);
  });

  it("rejects missing name field", () => {
    const { name: _n, ...rest } = valid;
    const result = UserRegisterSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing email field", () => {
    const { email: _e, ...rest } = valid;
    const result = UserRegisterSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing password field", () => {
    const { password: _p, ...rest } = valid;
    const result = UserRegisterSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("strips extra unknown fields", () => {
    const result = UserRegisterSchema.safeParse({ ...valid, extra: "field" });
    // Zod strips unknowns by default when using .safeParse without passthrough
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>)["extra"]).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// UserLoginSchema
// ---------------------------------------------------------------------------
describe("UserLoginSchema", () => {
  const valid = { email: "driver@example.com", password: "mypassword123" };

  it("accepts a valid login payload", () => {
    const result = UserLoginSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = UserLoginSchema.safeParse({ ...valid, email: "bad@" });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = UserLoginSchema.safeParse({ ...valid, password: "1234567" });
    expect(result.success).toBe(false);
  });

  it("accepts password exactly 8 characters", () => {
    const result = UserLoginSchema.safeParse({ ...valid, password: "12345678" });
    expect(result.success).toBe(true);
  });

  it("rejects empty body", () => {
    const result = UserLoginSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues.length).toBeGreaterThanOrEqual(2);
  });
});
