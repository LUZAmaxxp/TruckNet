import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { validateOrThrow } from "@/lib/validate";
import { successResponse } from "@/lib/api";
import { StressSignalSchema } from "@/schemas/stress.schema";
import { db } from "@/db";
import { stressSignals } from "@/db/schema";

/**
 * POST /api/stress-signals
 *
 * Creates a new stress signal for the authenticated driver.
 * Status is set to 'active' on creation.
 * Rate limited to 3 per 10 minutes (enforced in middleware.ts).
 *
 * Body: { latitude: number, longitude: number }
 * Response 201: StressSignal row
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const body: unknown = await req.json();
  const { latitude, longitude } = await validateOrThrow(StressSignalSchema, body);

  const [signal] = await db
    .insert(stressSignals)
    .values({
      userId: session.user.id,
      latitude,
      longitude,
      status: "active",
    })
    .returning();

  return successResponse(signal, 201);
}
