import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { env } from "@/lib/env";

/**
 * GET /api/auth/socket-token
 *
 * Returns the raw encoded JWT session token for use as Socket.io handshake auth.
 * The client passes this value as: socket = io(url, { auth: { token } })
 * The socket server middleware decodes/verifies it with next-auth/jwt decode().
 *
 * Only valid for authenticated sessions — returns 401 if no session exists.
 */
export async function GET(req: NextRequest) {
  const rawToken = await getToken({
    req,
    secret: env.NEXTAUTH_SECRET,
    raw: true,
    // Auth.js v5 uses the cookie name as the decode salt
    cookieName:
      process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
  });

  if (!rawToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ token: rawToken });
}
