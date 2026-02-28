/**
 * API integration tests for POST /api/auth/register
 *
 * Tests the route handler directly with NextRequest/NextResponse without
 * spinning up a Next.js server. The DB layer and bcrypt are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks (hoisted by Vitest above imports) ─────────────────────────────────
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$hashedpassword"),
  },
}));

const mockReturning = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.mock("@/db", () => ({
  db: { insert: mockInsert },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: successful insert
    mockReturning.mockResolvedValue([
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Alice Driver",
        email: "alice@example.com",
        createdAt: new Date("2024-01-01"),
      },
    ]);
  });

  it("returns 201 with safe user payload on success", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const req = makeRequest({ name: "Alice Driver", email: "alice@example.com", password: "password123" });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBeTruthy();
    expect(body.name).toBe("Alice Driver");
    expect(body.email).toBe("alice@example.com");
    // password_hash must NEVER be in the response
    expect(body.passwordHash).toBeUndefined();
    expect(body.password_hash).toBeUndefined();
  });

  it("returns 400 for missing name field", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const req = makeRequest({ email: "alice@example.com", password: "password123" });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 for name too short (1 char)", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const req = makeRequest({ name: "A", email: "alice@example.com", password: "password123" });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const req = makeRequest({ name: "Alice", email: "not-an-email", password: "password123" });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for short password", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const req = makeRequest({ name: "Alice", email: "alice@example.com", password: "short" });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when email already exists (DB unique violation)", async () => {
    const { POST } = await import("@/app/api/auth/register/route");

    // Simulate PostgreSQL unique constraint violation (code 23505)
    const pgUniqueError = Object.assign(new Error("duplicate key value"), { code: "23505" });
    mockReturning.mockRejectedValue(pgUniqueError);

    const req = makeRequest({ name: "Alice", email: "alice@example.com", password: "password123" });
    const res = await POST(req);
    expect(res.status).toBe(409);

    const body = await res.json() as { error: string };
    expect(body.error).toContain("already exists");
  });

  it("returns 400 for empty body", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const req = makeRequest({});

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
