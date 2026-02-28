import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { friendRequests } from "@/db/schema";
import { errorResponse } from "@/lib/api";

/**
 * PATCH /api/friends/[id]/reject
 *
 * Reject a pending friend request where the current user is the receiver.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  const userId = session.user.id;

  const [request] = await db
    .select()
    .from(friendRequests)
    .where(eq(friendRequests.id, params.id))
    .limit(1);

  if (!request) {
    return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
  }

  if (request.receiverId !== userId) {
    return errorResponse("You are not the receiver of this request", 403);
  }

  if (request.status !== "pending") {
    return errorResponse(`Request is already ${request.status}`, 409);
  }

  const [updated] = await db
    .update(friendRequests)
    .set({ status: "rejected" })
    .where(and(eq(friendRequests.id, params.id), eq(friendRequests.receiverId, userId)))
    .returning();

  return NextResponse.json(updated);
}
