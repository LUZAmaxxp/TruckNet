import { NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { friendRequests, driverLocations } from "@/db/schema";

/**
 * GET /api/friends/[id]/location
 *
 * Returns the last known GPS location for a friend.
 * Requires an accepted friendship between the caller and [id].
 *
 * Response 200: { location: { latitude, longitude, updatedAt } | null }
 * Response 403: { error: "Not your friend" }
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  const userId = session.user.id;
  const { id: friendId } = params;

  // Verify an accepted friendship exists
  const friendship = await db
    .select({ id: friendRequests.id })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.status, "accepted"),
        or(
          and(
            eq(friendRequests.senderId, userId),
            eq(friendRequests.receiverId, friendId)
          ),
          and(
            eq(friendRequests.senderId, friendId),
            eq(friendRequests.receiverId, userId)
          )
        )
      )
    )
    .limit(1);

  if (friendship.length === 0) {
    return NextResponse.json({ error: "Not your friend" }, { status: 403 });
  }

  // Fetch friend's most recent location entry
  const rows = await db
    .select({
      latitude: driverLocations.latitude,
      longitude: driverLocations.longitude,
      updatedAt: driverLocations.updatedAt,
    })
    .from(driverLocations)
    .where(eq(driverLocations.userId, friendId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ location: null });
  }

  return NextResponse.json({ location: rows[0] });
}
