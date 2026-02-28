import { NextResponse } from "next/server";
import { type ZodSchema, type ZodIssue, type z } from "zod";

// ---------------------------------------------------------------------------
// Shared error response shape used across the entire application.
// Every API error must conform to: { error: string; details?: ZodIssue[] }
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  error: string;
  details?: ZodIssue[];
}

// ---------------------------------------------------------------------------
// validateOrThrow — for Next.js Route Handlers (API routes)
//
// Usage:
//   const data = await validateOrThrow(UserRegisterSchema, await req.json());
//   // data is fully typed — if validation fails a 400 NextResponse is thrown
//
// Note: throws a NextResponse, not an Error — callers should NOT wrap this in
// try/catch unless they intend to handle the 400 response differently.  The
// normal pattern is to let the throw propagate to the route handler boundary.
// ---------------------------------------------------------------------------

export async function validateOrThrow<TSchema extends ZodSchema>(
  schema: TSchema,
  data: unknown
): Promise<z.infer<TSchema>> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const body: ApiErrorBody = {
      error: "Validation failed",
      details: result.error.issues,
    };
    throw NextResponse.json(body, { status: 400 });
  }

  return result.data as z.infer<TSchema>;
}

// ---------------------------------------------------------------------------
// Result<T> — discriminated union returned by validateSocketEvent.
// Handlers must check result.ok before accessing result.data / result.error.
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ZodIssue[] };

// ---------------------------------------------------------------------------
// validateSocketEvent — for Socket.io event handlers
//
// Usage:
//   const result = validateSocketEvent(LocationUpdateSchema, payload);
//   if (!result.ok) {
//     socket.emit("error", { error: "Validation failed", details: result.error });
//     return;
//   }
//   // result.data is fully typed
//
// Never throws — always returns a discriminated union so socket handlers can
// emit an error event to the sender without crashing the server.
// ---------------------------------------------------------------------------

export function validateSocketEvent<TSchema extends ZodSchema>(
  schema: TSchema,
  data: unknown
): ValidationResult<z.infer<TSchema>> {
  const result = schema.safeParse(data);

  if (!result.success) {
    return { ok: false, error: result.error.issues };
  }

  return { ok: true, data: result.data as z.infer<TSchema> };
}
