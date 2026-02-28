import { handlers } from "@/auth";

/**
 * Auth.js v5 route handler.
 * Handles GET and POST requests for all /api/auth/* endpoints:
 *   GET  /api/auth/session
 *   GET  /api/auth/csrf
 *   GET  /api/auth/providers
 *   POST /api/auth/callback/credentials
 *   POST /api/auth/signout
 */
export const { GET, POST } = handlers;
