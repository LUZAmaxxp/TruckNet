/**
 * API integration tests for stress signal endpoints:
 *  - POST /api/stress-signals
 *  - PATCH /api/stress-signals/[id]/resolve  (ownership + 404 checks)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ── DB mock setup ─────────────────────────────────────────────────────────────
// POST: db.insert().values().returning()
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

// PATCH select: db.select().from().where()  — terminal call → Promise<Row[]>
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

// PATCH update: db.update().set().where().returning()
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

vi.mock("@/db", () => ({
  db: { insert: mockInsert, select: mockSelect, update: mockUpdate },
}));

const CREATOR_ID = "creator-uuid";

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: CREATOR_ID, email: "creator@test.com", name: "Creator" },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/stress-signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatch(id: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/stress-signals/${id}/resolve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

// ── POST /api/stress-signals ──────────────────────────────────────────────────

describe("POST /api/stress-signals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockInsertReturning).mockResolvedValue([{
      id: "signal-uuid",
      userId: CREATOR_ID,
      latitude: 48.8566,
      longitude: 2.3522,
      status: "active",
      createdAt: new Date(),
    }]);
  });

  it("returns 201 with signal on valid payload", async () => {
    const { POST } = await import("@/app/api/stress-signals/route");
    const res = await POST(makePost({ latitude: 48.8566, longitude: 2.3522 }));
    expect(res.status).toBe(201);
  });

  // The stress POST route has no try/catch; validateOrThrow throws NextResponse(400)
  // which propagates as a rejection in the test environment.

  it("returns 400 for out-of-range latitude", async () => {
    const { POST } = await import("@/app/api/stress-signals/route");
    await expect(
      POST(makePost({ latitude: 200, longitude: 2.3522 }))
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof Response && (e as Response).status === 400
    );
  });

  it("returns 400 for missing coordinates", async () => {
    const { POST } = await import("@/app/api/stress-signals/route");
    await expect(
      POST(makePost({}))
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof Response && (e as Response).status === 400
    );
  });

  it("returns 401 when not authenticated", async () => {
    const { requireAuth } = await import("@/lib/auth-helpers");
    vi.mocked(requireAuth).mockRejectedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const { POST } = await import("@/app/api/stress-signals/route");
    await expect(POST(makePost({ latitude: 0, longitude: 0 }))).rejects.toBeInstanceOf(Response);
  });
});

// ── PATCH /api/stress-signals/[id]/resolve ────────────────────────────────────

describe("PATCH /api/stress-signals/[id]/resolve", () => {
  const SIGNAL_ID = "signal-resolve-uuid";

  const activeSignal = {
    id: SIGNAL_ID,
    userId: CREATOR_ID,
    latitude: 48.8566,
    longitude: 2.3522,
    status: "active",
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: signal exists, owned by creator
    mockSelectWhere.mockResolvedValue([activeSignal]);
    // Default: update succeeds
    mockUpdateReturning.mockResolvedValue([{ ...activeSignal, status: "resolved" }]);
  });

  it("returns 200 when creator resolves their own signal", async () => {
    const { PATCH } = await import("@/app/api/stress-signals/[id]/resolve/route");
    const res = await PATCH(makePatch(SIGNAL_ID), { params: { id: SIGNAL_ID } });
    expect(res.status).toBe(200);
  });

  it("returns 404 when signal does not exist", async () => {
    mockSelectWhere.mockResolvedValue([]);
    const { PATCH } = await import("@/app/api/stress-signals/[id]/resolve/route");
    const res = await PATCH(makePatch("nonexistent"), { params: { id: "nonexistent" } });
    expect(res.status).toBe(404);
  });

  it("is idempotent: returns 200 if already resolved", async () => {
    mockSelectWhere.mockResolvedValue([{ ...activeSignal, status: "resolved" }]);
    const { PATCH } = await import("@/app/api/stress-signals/[id]/resolve/route");
    const res = await PATCH(makePatch(SIGNAL_ID), { params: { id: SIGNAL_ID } });
    expect(res.status).toBe(200);
  });
});
