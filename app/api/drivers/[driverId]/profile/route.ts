import { type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { driverProfiles, users } from "@/db/schema";
import { UpdateDriverProfileSchema } from "@/schemas/driver-esg-report.schema";
import { isUUID } from "@/lib/validate-uuid";

export async function GET(
  _req: NextRequest,
  { params }: { params: { driverId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId)) return errorResponse("Invalid driverId", 400);

  const [driver] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.id, params.driverId), eq(users.role, "driver")))
    .limit(1);
  if (!driver) return errorResponse("Driver not found", 404);

  const [profile] = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.driverId, params.driverId))
    .limit(1);

  return successResponse({ driver, profile: profile ?? null }, 200);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { driverId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId)) return errorResponse("Invalid driverId", 400);

  const [driver] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, params.driverId), eq(users.role, "driver")))
    .limit(1);
  if (!driver) return errorResponse("Driver not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = UpdateDriverProfileSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const now = new Date();
  const [existing] = await db
    .select({ id: driverProfiles.id })
    .from(driverProfiles)
    .where(eq(driverProfiles.driverId, params.driverId))
    .limit(1);

  let profile;
  if (existing) {
    [profile] = await db
      .update(driverProfiles)
      .set({ ...parsed.data, updatedAt: now })
      .where(eq(driverProfiles.driverId, params.driverId))
      .returning();
  } else {
    [profile] = await db
      .insert(driverProfiles)
      .values({ driverId: params.driverId, ...parsed.data, createdAt: now, updatedAt: now })
      .returning();
  }

  return successResponse({ profile }, 200);
}
