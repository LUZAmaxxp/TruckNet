import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Session } from "next-auth";

/**
 * getServerSession()
 *
 * Lightweight wrapper around Auth.js v5 `auth()`.
 * Returns the current session or null.
 * Use in Server Components and Route Handlers for optional session reading.
 *
 * @example
 *   const session = await getServerSession();
 *   if (!session) { ... }
 */
export async function getServerSession(): Promise<Session | null> {
  return auth();
}

/**
 * requireAuth()
 *
 * Asserts that the request is authenticated and returns a fully typed session
 * with session.user.id guaranteed to be a non-empty string.
 *
 * Throws a NextResponse 401 if no valid session exists.
 * Route handlers must NOT wrap this in try/catch unless they intend to handle
 * the 401 — the thrown NextResponse propagates to the Next.js handler boundary.
 *
 * @example
 *   export async function GET() {
 *     const session = await requireAuth();
 *     // session.user.id is string — no casting required
 *   }
 */
export async function requireAuth(): Promise<Session & { user: { id: string; email: string; name: string } }> {
  const session = await auth();

  if (!session?.user?.id) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return session as Session & { user: { id: string; email: string; name: string } };
}
