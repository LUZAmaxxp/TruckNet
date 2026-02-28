import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { errorResponse } from "@/lib/api";

/**
 * GET /api/users/by-tag?tag=slug%234567
 *
 * Look up a user by their unique tag (e.g. "john#1234").
 * Returns { id, name, tag } or 404 if not found.
 * Requires authentication.
 */
export async function GET(req: NextRequest) {
  await requireAuth();

  const tag = req.nextUrl.searchParams.get("tag");
  if (!tag || !tag.trim()) {
    return errorResponse("Query param `tag` is required", 400);
  }

  const [found] = await db
    .select({ id: users.id, name: users.name, tag: users.tag })
    .from(users)
    .where(eq(users.tag, tag.trim()))
    .limit(1);

  if (!found) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(found);
}
