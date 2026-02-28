import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ZodIssue } from "zod";
import { requireAuth } from "@/lib/auth-helpers";
import type { Session } from "next-auth";

// ---------------------------------------------------------------------------
// ApiResponse<T> — generic typed response wrapper used across all route handlers
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: ZodIssue[];
}

// ---------------------------------------------------------------------------
// errorResponse — standardised error shape: { error: string, details?: ZodIssue[] }
//
// Usage:
//   return errorResponse("Not found", 404);
//   return errorResponse("Validation failed", 400, zodIssues);
// ---------------------------------------------------------------------------

export function errorResponse(
  message: string,
  status: number,
  details?: ZodIssue[]
): NextResponse<{ error: string; details?: ZodIssue[] }> {
  const body: { error: string; details?: ZodIssue[] } = { error: message };
  if (details?.length) body.details = details;
  return NextResponse.json(body, { status });
}

// ---------------------------------------------------------------------------
// successResponse — consistent data wrapper with configurable status code
//
// Usage:
//   return successResponse(user, 200);
//   return successResponse(newRecord, 201);
// ---------------------------------------------------------------------------

export function successResponse<T>(
  data: T,
  status = 200
): NextResponse<T> {
  return NextResponse.json(data, { status });
}

// ---------------------------------------------------------------------------
// methodGuard — returns 405 for unsupported HTTP methods
//
// Usage:
//   export async function PUT(req: NextRequest) {
//     return methodGuard(["GET", "POST"], req);
//   }
// ---------------------------------------------------------------------------

export function methodGuard(
  allowed: string[],
  req: NextRequest
): NextResponse<{ error: string }> {
  return NextResponse.json(
    {
      error: `Method ${req.method} not allowed. Allowed: ${allowed.join(", ")}`,
    },
    {
      status: 405,
      headers: { Allow: allowed.join(", ") },
    }
  );
}

// ---------------------------------------------------------------------------
// withAuth — higher-order route handler that injects a typed, authenticated session.
//
// Internally calls requireAuth() from /lib/auth-helpers.ts which throws a
// NextResponse(401) if the session is missing or user.id is absent.
//
// Contract for all protected routes:
//   1. Wrap with withAuth — NEVER check auth manually inside the handler
//   2. Use validateOrThrow() from /lib/validate.ts for all request bodies
//   3. Return using successResponse() / errorResponse() for consistent shapes
//
// Usage:
//   export const GET = withAuth(async (req, session) => {
//     return successResponse({ userId: session.user.id });
//   });
// ---------------------------------------------------------------------------

type AuthedHandler = (
  req: NextRequest,
  session: Session & { user: { id: string; email: string; name: string } }
) => Promise<NextResponse>;

export function withAuth(handler: AuthedHandler) {
  return async function (req: NextRequest): Promise<NextResponse> {
    try {
      const session = await requireAuth();
      return await handler(req, session);
    } catch (err) {
      // requireAuth and validateOrThrow both throw NextResponse — propagate directly
      if (err instanceof NextResponse) return err;
      console.error("[withAuth] Unexpected error:", err);
      return errorResponse("Internal server error", 500);
    }
  };
}
