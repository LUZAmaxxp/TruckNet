import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { ablyPublish } from "@/lib/ably-server";
import { db } from "@/db";
import { stressSignals, users } from "@/db/schema";
import { assertIsUUID } from "@/lib/validate-uuid";

/**
 * PATCH /api/admin/sos/[id]/resolve
 *
 * Admin resolves an active SOS alert.
 * Updates signal status to "resolved" and notifies the sender via Ably.
 *
 * Response 200: { signal: { id, status, resolvedAt } }
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdminSession();

  try {
    assertIsUUID(params.id, "id");
  } catch {
    return NextResponse.json({ error: "Invalid signal ID" }, { status: 400 });
  }

  // Fetch the signal so we know the sender's userId
  const [signal] = await db
    .select({
      id: stressSignals.id,
      userId: stressSignals.userId,
      status: stressSignals.status,
    })
    .from(stressSignals)
    .where(eq(stressSignals.id, params.id))
    .limit(1);

  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  if (signal.status === "resolved") {
    return NextResponse.json({ error: "Signal is already resolved" }, { status: 409 });
  }

  const resolvedAt = new Date();

  await db
    .update(stressSignals)
    .set({ status: "resolved" })
    .where(and(eq(stressSignals.id, params.id), eq(stressSignals.status, "active")));

  // Fetch admin name to include in notification
  const [admin] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Notify the driver that their SOS was acknowledged by admin
  try {
    await ablyPublish(`user:${signal.userId}`, "sos_resolved_by_admin", {
      signalId: params.id,
      adminName: admin?.name ?? "Admin",
      resolvedAt: resolvedAt.toISOString(),
    });
  } catch {
    // Best-effort — don't fail the response if Ably is unavailable
  }

  return NextResponse.json({
    signal: { id: params.id, status: "resolved", resolvedAt: resolvedAt.toISOString() },
  });
}
