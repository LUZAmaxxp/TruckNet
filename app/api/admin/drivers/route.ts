import { type NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gt, ilike, isNull, lte, or } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { driverLocations, users } from "@/db/schema";

/**
 * GET /api/admin/drivers
 *
 * Returns all registered drivers (role = 'driver') with their latest
 * GPS location and online status.
 *
 * Query params:
 *   page   — 1-based page number (default: 1)
 *   limit  — results per page (default: 20, max: 100)
 *   search — partial match on name or tag
 *   status — "online" | "offline" | "all" (default: "all")
 *
 * Response 200: { drivers: DriverAdminEntry[], total: number, onlineCount: number }
 */
export async function GET(req: NextRequest) {
  await requireAdminSession();

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
  const search = searchParams.get("search")?.trim() ?? "";
  const status = searchParams.get("status") ?? "all";

  const offset = (page - 1) * limit;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  // Subquery: latest location row per driver (driver_locations is a history table)
  const latestLoc = db
    .selectDistinctOn([driverLocations.userId], {
      userId:    driverLocations.userId,
      latitude:  driverLocations.latitude,
      longitude: driverLocations.longitude,
      updatedAt: driverLocations.updatedAt,
    })
    .from(driverLocations)
    .orderBy(driverLocations.userId, desc(driverLocations.updatedAt))
    .as("latest_loc");

  // Build WHERE conditions
  const conditions = [eq(users.role, "driver")];

  if (search) {
    conditions.push(
      or(
        ilike(users.name, `%${search}%`),
        ilike(users.tag, `%${search}%`)
      )!
    );
  }

  if (status === "online") {
    conditions.push(gt(latestLoc.updatedAt, fiveMinutesAgo));
  } else if (status === "offline") {
    conditions.push(
      or(
        isNull(latestLoc.userId),
        lte(latestLoc.updatedAt, fiveMinutesAgo)
      )!
    );
  }

  const whereClause = and(...conditions);

  // Parallel queries: paginated rows + total count + online count
  const [rows, [{ count: total }], [{ count: onlineCount }]] = await Promise.all([
    db
      .select({
        id:              users.id,
        name:            users.name,
        tag:             users.tag,
        profileImageUrl: users.profileImageUrl,
        role:            users.role,
        createdAt:       users.createdAt,
        lastLatitude:    latestLoc.latitude,
        lastLongitude:   latestLoc.longitude,
        lastSeenAt:      latestLoc.updatedAt,
      })
      .from(users)
      .leftJoin(latestLoc, eq(latestLoc.userId, users.id))
      .where(whereClause)
      .orderBy(latestLoc.updatedAt)
      .limit(limit)
      .offset(offset),

    db
      .select({ count: count() })
      .from(users)
      .leftJoin(latestLoc, eq(latestLoc.userId, users.id))
      .where(whereClause),

    db
      .select({ count: count() })
      .from(users)
      .leftJoin(latestLoc, eq(latestLoc.userId, users.id))
      .where(and(eq(users.role, "driver"), gt(latestLoc.updatedAt, fiveMinutesAgo))),
  ]);

  const drivers = rows.map((row) => ({
    ...row,
    isOnline:
      row.lastSeenAt != null && row.lastSeenAt > fiveMinutesAgo,
  }));

  return NextResponse.json({ drivers, total, onlineCount });
}
