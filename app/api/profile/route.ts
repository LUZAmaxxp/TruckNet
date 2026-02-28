import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * GET /api/profile
 *
 * Returns the authenticated user's profile.
 * Fields: id, name, email, tag, profile_image_url
 * Never returns password_hash.
 */
export async function GET(_req: NextRequest) {
  const session = await requireAuth();

  const [profile] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      tag: users.tag,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}
