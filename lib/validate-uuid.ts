import { NextResponse } from "next/server";

/** UUID v4 regex */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * assertIsUUID
 *
 * Defensive guard — asserts that a value is a valid UUID string before it
 * reaches any DB UUID column.  Throws a NextResponse 400 if the assertion
 * fails, preventing Postgres error 22P02 (invalid input syntax for uuid).
 *
 * Usage:
 *   assertIsUUID(receiverId, "receiverId");
 *
 * @param value   - The value to check.
 * @param field   - Field name used in the error message.
 */
export function assertIsUUID(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !UUID_REGEX.test(value)) {
    throw NextResponse.json(
      { error: `Invalid value for field "${field}": expected a UUID, got "${String(value)}"` },
      { status: 400 }
    );
  }
}

/**
 * isUUID — non-throwing UUID check.
 */
export function isUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}
