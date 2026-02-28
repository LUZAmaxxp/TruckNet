import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { withAuth, successResponse, errorResponse } from "@/lib/api";
import { validateOrThrow } from "@/lib/validate";

const UpdateNameSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
});

/**
 * GET /api/users/me
 * Returns the authenticated user's profile — password_hash is never included.
 */
export const GET = withAuth(async (_req, session) => {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return errorResponse("User not found", 404);
  }

  return successResponse(user);
});

/**
 * PATCH /api/users/me
 * Updates the authenticated user's display name.
 * Validates body with UpdateNameSchema (name: string min(2)).
 */
export const PATCH = withAuth(async (req, session) => {
  const body: unknown = await req.json();
  const data = await validateOrThrow(UpdateNameSchema, body);

  const [updated] = await db
    .update(users)
    .set({ name: data.name })
    .where(eq(users.id, session.user.id))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    });

  if (!updated) {
    return errorResponse("User not found", 404);
  }

  return successResponse(updated);
});

/**
 * All other HTTP methods → 405
 */
export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed. Use PATCH to update profile." },
    { status: 405, headers: { Allow: "GET, PATCH" } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed." },
    { status: 405, headers: { Allow: "GET, PATCH" } }
  );
}
