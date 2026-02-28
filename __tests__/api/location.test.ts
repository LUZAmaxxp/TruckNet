/**
 * API integration tests for POST /api/drivers/location
 *
 * Tests route handler directly with mocked DB and auth.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockReturning = vi.fn();
const mockWhere = vi.fn(() => ({ returning: mockReturning }));
const mockSet = vi.fn(() => ({ where: mockWhere }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock("@/db", () => ({
  db: {
    update: mockUpdate,
    insert: mockInsert,
  },
}));

// Mock the in-memory location store so socket side-effects don't break tests
vi.mock("@/sockets/store/location.store", () => ({
  setDriverLocation: vi.fn(),
  getDriverLocation: vi.fn(),
  removeDriverLocation: vi.fn(),
  getAllDriverLocations: vi.fn(() => []),
}));

const mockSession = {
  user: { id: "user-test-uuid", email: "driver@test.com", name: "Test Driver" },
  expires: new Date(Date.now() + 3600_000).toISOString(),
};

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/drivers/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/drivers/location", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/auth-helpers");
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    // Default: update finds existing row
    mockReturning.mockResolvedValue([{ id: "row-uuid" }]);
  });

  it("returns 200 with coordinates on success (update path)", async () => {
    const { POST } = await import("@/app/api/drivers/location/route");
    const req = makeRequest({ latitude: 48.8566, longitude: 2.3522 });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json() as { latitude: number; longitude: number };
    expect(body.latitude).toBe(48.8566);
    expect(body.longitude).toBe(2.3522);
  });

  it("inserts new row when update finds none (insert path)", async () => {
    const { POST } = await import("@/app/api/drivers/location/route");
    // update returns empty — triggers insert
    mockReturning.mockResolvedValue([]);

    const req = makeRequest({ latitude: 51.5074, longitude: -0.1278 });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    const { requireAuth } = await import("@/lib/auth-helpers");
    (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const { POST } = await import("@/app/api/drivers/location/route");
    const req = makeRequest({ latitude: 48.8566, longitude: 2.3522 });

    // The route doesn't catch the NextResponse throw — it propagates
    await expect(POST(req)).rejects.toBeInstanceOf(Response);
  });

  // The location route has no try/catch — validateOrThrow throws NextResponse(400)
  // which propagates as a rejection in the test environment.

  it("returns 400 for invalid latitude (> 90)", async () => {
    const { POST } = await import("@/app/api/drivers/location/route");
    const req = makeRequest({ latitude: 91, longitude: 2.3522 });
    await expect(POST(req)).rejects.toSatisfy(
      (e: unknown) => e instanceof Response && (e as Response).status === 400
    );
  });

  it("returns 400 for invalid longitude (< -180)", async () => {
    const { POST } = await import("@/app/api/drivers/location/route");
    const req = makeRequest({ latitude: 48.8566, longitude: -200 });
    await expect(POST(req)).rejects.toSatisfy(
      (e: unknown) => e instanceof Response && (e as Response).status === 400
    );
  });

  it("returns 400 for missing coordinates", async () => {
    const { POST } = await import("@/app/api/drivers/location/route");
    const req = makeRequest({});
    await expect(POST(req)).rejects.toSatisfy(
      (e: unknown) => e instanceof Response && (e as Response).status === 400
    );
  });

  it("returns 400 for string coordinates", async () => {
    const { POST } = await import("@/app/api/drivers/location/route");
    const req = makeRequest({ latitude: "48.8566", longitude: "2.3522" });
    await expect(POST(req)).rejects.toSatisfy(
      (e: unknown) => e instanceof Response && (e as Response).status === 400
    );
  });
});
