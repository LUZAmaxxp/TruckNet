import type { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/cam-agent/session
 *
 * Called once by the cam_agent on startup to resolve driver_email → driver UUID.
 * Authenticated via CAM_AGENT_API_KEY Bearer token — no browser session required.
 *
 * Body: { driver_email: string }
 * Returns: { driver_id: string, driver_name: string }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.CAM_AGENT_API_KEY;
  const authHeader = req.headers.get("authorization") ?? "";

  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return errorResponse("Unauthorized", 401);
  }

  let body: { driver_email?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const email = body.driver_email?.trim().toLowerCase();
  if (!email) {
    return errorResponse("driver_email is required", 400);
  }

  const [driver] = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!driver) {
    return errorResponse(`No user found with email: ${email}`, 404);
  }

  if (driver.role !== "driver") {
    return errorResponse(`User ${email} is not a driver (role: ${driver.role})`, 403);
  }

  return successResponse({ driver_id: driver.id, driver_name: driver.name });
}
