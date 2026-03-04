import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/lib/env";
import { UserLoginSchema } from "@/schemas/user.schema";
import { authConfig } from "@/auth.config";

/**
 * auth.ts — Full Auth.js configuration (Node.js runtime only).
 *
 * Extends authConfig (edge-safe) and adds the Credentials provider with
 * bcrypt password comparison and Drizzle DB lookup.
 *
 * Used by:
 *  - /app/api/auth/[...nextauth]/route.ts
 *  - /app/api/auth/register/route.ts (via bcrypt only)
 *  - /lib/auth-helpers.ts (requireAuth / getServerSession)
 *  - All Node.js Route Handlers
 *
 * NOT imported by middleware.ts — use auth.config.ts there instead.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate shape with Zod safeParse — never use zod.parse()
        const parsed = UserLoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Look up the user by email
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) return null;

        // Constant-time hash comparison via bcrypt
        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) return null;

        // Return Auth.js User shape — never include passwordHash
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
