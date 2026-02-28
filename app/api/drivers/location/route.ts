import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { validateOrThrow } from "@/lib/validate";
import { successResponse } from "@/lib/api";
import { LocationUpdateSchema } from "@/schemas/location.schema";
import { db } from "@/db";
import { driverLocations } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/drivers/location
 *
 * Persists the authenticated driver's GPS coordinates to the database.
 * If a row already exists for the user, it is updated in-place (upsert pattern
 * using update → if-no-rows → insert).
 *
 * Body: { latitude: number, longitude: number }
 * Response 200: { latitude, longitude }
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const body: unknown = await req.json();
  const { latitude, longitude } = await validateOrThrow(LocationUpdateSchema, body);

  // Upsert: try update first; if no row found, insert.
  const updated = await db
    .update(driverLocations)
    .set({ latitude, longitude, updatedAt: new Date() })
    .where(eq(driverLocations.userId, session.user.id))
    .returning({ id: driverLocations.id });

  if (updated.length === 0) {
    await db.insert(driverLocations).values({
      userId: session.user.id,
      latitude,
      longitude,
    });
  }

  return successResponse({ latitude, longitude }, 200);
}
