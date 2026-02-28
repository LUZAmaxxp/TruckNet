import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { validateOrThrow } from "@/lib/validate";
import { UserRegisterSchema } from "@/schemas/user.schema";

const BCRYPT_SALT_ROUNDS = 12;

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

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

    const [newUser] = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        passwordHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
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
