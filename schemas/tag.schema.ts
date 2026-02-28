import { z } from "zod";

/**
 * TagInputSchema — validates a user tag string.
 * Format: alphanumeric/underscore slug + # + exactly 4 digits (e.g. "john#1234").
 * Used by API routes that accept tag-based user resolution.
 */
export const TagInputSchema = z
  .string()
  .regex(
    /^[a-zA-Z0-9_]+#[0-9]{4}$/,
    "Tag must be in the format name#XXXX (e.g. john#1234)"
  );

export type TagInput = z.infer<typeof TagInputSchema>;
