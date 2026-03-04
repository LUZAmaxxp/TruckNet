import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { validateOrThrow } from "@/lib/validate";
import { UserRegisterSchema } from "@/schemas/user.schema";
import { env } from "@/lib/env";

const BCRYPT_SALT_ROUNDS = 12;

/** Generate a slug from a name: lowercase, strip non-alphanum, max 12 chars */
function nameSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12) || "driver";
}

/** Generate a unique `slug#XXXX` tag, retrying up to maxAttempts times */
async function generateUniqueTag(name: string, maxAttempts = 10): Promise<{ tag: string; tagNumber: number }> {
  const slug = nameSlug(name);
  for (let i = 0; i < maxAttempts; i++) {
    const num = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${slug}#${num}`;
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.tag, candidate))
      .limit(1);
    if (existing.length === 0) {
      return { tag: candidate, tagNumber: num };
    }
  }
  throw new Error("Could not generate a unique tag — please retry.");
}

/**
 * POST /api/auth/register
 *
 * Registers a new driver account.
 * - Validates request body with UserRegisterSchema (Zod safeParse via validateOrThrow)
 * - Hashes password with bcrypt (salt rounds: 12)
 * - Inserts user into DB; returns 409 on duplicate email
 * - Returns 201 with safe user payload — password_hash is NEVER returned
 */
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const data = await validateOrThrow(UserRegisterSchema, body);

    // Admin registration requires a valid invite code
    if (data.role === "admin") {
      if (!env.ADMIN_INVITE_CODE) {
        return NextResponse.json(
          { error: "Admin registration is disabled on this server." },
          { status: 403 }
        );
      }
      if (!data.adminInviteCode || data.adminInviteCode !== env.ADMIN_INVITE_CODE) {
        return NextResponse.json(
          { error: "Invalid admin invite code." },
          { status: 403 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
    const { tag, tagNumber } = await generateUniqueTag(data.name);

    const [newUser] = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        passwordHash,
        tag,
        tagNumber,
        role: data.role,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        tag: users.tag,
        role: users.role,
        createdAt: users.createdAt,
      });

    return NextResponse.json(newUser, { status: 201 });
  } catch (err) {
    // validateOrThrow throws a NextResponse directly — propagate it
    if (err instanceof NextResponse) return err;

    // PostgreSQL unique violation on email (code 23505)
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException & { code: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    console.error("[POST /api/auth/register]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
