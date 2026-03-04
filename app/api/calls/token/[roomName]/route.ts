import { NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { getServerSession } from "@/lib/auth-helpers";
import { generateLiveKitToken } from "@/lib/livekit-server";
import { env } from "@/lib/env";
import { db } from "@/db";
import { callHistory, users } from "@/db/schema";

/**
 * GET /api/calls/token/[roomName]
 *
 * Issues a LiveKit JWT for the caller or callee of an ongoing call.
 * Used by the callee when accepting, and as a fallback token refresh
 * for either participant.
 *
 * Response 200: { token: string, liveKitUrl: string }
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    // ── 1. Auth — return 401 directly rather than throwing ──────────────
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { roomName } = await params;

    // ── 2. Find the call record — caller OR callee may fetch a token ─────
    const [call] = await db
      .select()
      .from(callHistory)
      .where(
        and(
          eq(callHistory.roomName, roomName),
          or(
            eq(callHistory.callerId, userId),
            eq(callHistory.calleeId, userId)
          ),
          eq(callHistory.status, "ongoing")
        )
      )
      .limit(1);

    if (!call) {
      return NextResponse.json(
        { error: "Call not found or already ended" },
        { status: 404 }
      );
    }

    // ── 3. Fetch display name ─────────────────────────────────────────────
    const [userRow] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // ── 4. Generate scoped LiveKit JWT ───────────────────────────────────
    const token = await generateLiveKitToken(
      roomName,
      userId,
      userRow?.name ?? "Driver"
    );

    // ── 5. Mark call as started on first join (callee accepting) ─────────
    if (!call.startedAt) {
      await db
        .update(callHistory)
        .set({ startedAt: new Date() })
        .where(eq(callHistory.roomName, roomName));
    }

    return NextResponse.json({ token, liveKitUrl: env.LIVEKIT_URL });
  } catch (error) {
    console.error("[GET /api/calls/token] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
