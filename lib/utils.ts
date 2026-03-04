import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * toDate — safely coerces a DB/API timestamp value to a Date instance.
 *
 * Drizzle ORM returns timestamptz columns as ISO strings in some configs,
 * and JSON.parse always turns Date objects back into strings (sessionStorage).
 * This helper handles all four input types without ever throwing.
 *
 * @returns Date instance, or null if the input is null/undefined/invalid.
 */
export function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
