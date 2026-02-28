import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import {
  stressSignalLimiter,
  voiceMessageLimiter,
  registerLimiter,
} from "@/lib/rate-limit";

/**
 * Next.js Edge Middleware — route protection + rate limiting.
 *
 * Runs before every matched request in this order:
 *   1. Rate limit check (returns 429 immediately if exceeded)
 *   2. Auth.js authorized() callback (redirects to /login if unauthenticated)
 *
 * Rate limit rules:
 *   POST /api/stress-signals  → 3 req / 10 min  per user (session.user.id)
 *   POST /api/voice-messages  → 10 req / 1 min   per user (session.user.id)
 *   POST /api/auth/register   → 5 req  / 1 hour  per IP
 *
 * Auth guard:
 *   Protected paths: /dashboard, /map, /messages, /stress
 *   Redirects unauthenticated users to /login.
 */

const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // -----------------------------------------------------------------
  // Rate limiting — checked BEFORE auth to also protect register (no session)
  // -----------------------------------------------------------------
  if (method === "POST") {
    // POST /api/auth/register — per-IP, no session required
    if (pathname === "/api/auth/register") {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        req.headers.get("x-real-ip") ??
        "unknown";

      const { allowed, retryAfterSeconds } = registerLimiter.check(ip);
      if (!allowed) {
        return NextResponse.json(
          { error: "Too many registration attempts. Please try again later." },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfterSeconds) },
          }
        );
      }
    }

    // POST /api/stress-signals — per-user (session.user.id)
    if (pathname === "/api/stress-signals") {
      const userId = (req as NextRequest & { auth?: { user?: { id?: string } } }).auth?.user?.id;
      if (userId) {
        const { allowed, retryAfterSeconds } = stressSignalLimiter.check(userId);
        if (!allowed) {
          return NextResponse.json(
            { error: "Stress signal rate limit exceeded. Please wait before sending another." },
            {
              status: 429,
              headers: { "Retry-After": String(retryAfterSeconds) },
            }
          );
        }
      }
    }

    // POST /api/voice-messages — per-user (session.user.id)
    if (pathname === "/api/voice-messages") {
      const userId = (req as NextRequest & { auth?: { user?: { id?: string } } }).auth?.user?.id;
      if (userId) {
        const { allowed, retryAfterSeconds } = voiceMessageLimiter.check(userId);
        if (!allowed) {
          return NextResponse.json(
            { error: "Voice message rate limit exceeded. Please wait before sending another." },
            {
              status: 429,
              headers: { "Retry-After": String(retryAfterSeconds) },
            }
          );
        }
      }
    }
  }

  // -----------------------------------------------------------------
  // Auth guard — NextResponse.next() continues for public/allowed paths,
  // redirect to /login for unauthenticated access to protected paths.
  // This is handled by the authorized() callback in auth.config.ts.
  // -----------------------------------------------------------------
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|login|register).*)",
    "/api/auth/register",
    "/api/voice-messages",
    "/api/stress-signals",
  ],
};
