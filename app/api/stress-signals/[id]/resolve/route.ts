import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { stressSignals } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/stress-signals/[id]/resolve
 *
 * Marks a stress signal as 'resolved'.
 * Enforces creator ownership — only the user who created the signal may resolve it.
 *
 * Returns 404 if the signal does not exist.
 * Returns 403 if the authenticated user is not the creator.
 * Returns 200 with the updated row on success (idempotent if already resolved).
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  const { id } = params;

  const [signal] = await db
    .select()
    .from(stressSignals)
    .where(eq(stressSignals.id, id));

  if (!signal) {
    return errorResponse("Stress signal not found", 404);
  }

  if (signal.userId !== session.user.id) {
    return errorResponse(
      "Forbidden — only the signal creator may resolve it",
      403
    );
  }

  if (signal.status === "resolved") {
    // Idempotent — already resolved
    return successResponse(signal);
  }

  const [updated] = await db
    .update(stressSignals)
    .set({ status: "resolved" })
    .where(eq(stressSignals.id, id))
    .returning();

  return successResponse(updated);
}
