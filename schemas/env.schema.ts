import { z } from "zod";

/**
 * EnvSchema — validates all required environment variables at application startup.
 * Application must fail fast with a descriptive ZodError if any variable is
 * missing or malformed. Import `env` from /lib/env.ts — never access process.env directly.
 */
export const EnvSchema = z.object({
  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid URL" }),
  NEXTAUTH_SECRET: z
    .string()
    .min(10, { message: "NEXTAUTH_SECRET must be at least 10 characters" }),
  NEXTAUTH_URL: z
    .string()
    .url({ message: "NEXTAUTH_URL must be a valid URL" }),
  SOCKET_PORT: z.string({ required_error: "SOCKET_PORT is required" }).optional(),
  ABLY_API_KEY: z.string().min(1, { message: "ABLY_API_KEY is required" }),
});

export type Env = z.infer<typeof EnvSchema>;
