import { type NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { friendRequests, users } from "@/db/schema";

/**
 * GET /api/friends/list
 *
 * Returns the current user's accepted friends list.
 * Each entry: { friendId, name, tag }
 */
export async function GET(_req: NextRequest) {
  const session = await requireAuth();
  const userId = session.user.id;

  // Find all accepted requests where user is sender or receiver
  const accepted = await db
    .select({
      id: friendRequests.id,
      senderId: friendRequests.senderId,
      receiverId: friendRequests.receiverId,
    })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.status, "accepted"),
        or(
          eq(friendRequests.senderId, userId),
          eq(friendRequests.receiverId, userId)
        )
      )
    );

  // For each accepted request, resolve the friend's user info
  const friendIds = accepted.map((r) =>
    r.senderId === userId ? r.receiverId : r.senderId
  );

  if (friendIds.length === 0) {
    return NextResponse.json({ friends: [] });
  }

  // Batch fetch friend user profiles
  const friendProfiles = await db
    .select({
      id: users.id,
      name: users.name,
      tag: users.tag,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(or(...friendIds.map((fid) => eq(users.id, fid))));

  return NextResponse.json({ friends: friendProfiles });
}
