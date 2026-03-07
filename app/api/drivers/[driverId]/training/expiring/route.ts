import { type NextRequest } from "next/server";
import { and, eq, lte, sql } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { driverTrainingRecords } from "@/db/schema";
import { isUUID } from "@/lib/validate-uuid";
import { addDays } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: { driverId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.driverId)) return errorResponse("Invalid driverId", 400);

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10);
  const cutoff = addDays(new Date(), days).toISOString().split("T")[0];

  const records = await db
    .select()
    .from(driverTrainingRecords)
    .where(
      and(
        eq(driverTrainingRecords.driverId, params.driverId),
        lte(driverTrainingRecords.expiryDate, cutoff),
        sql`${driverTrainingRecords.expiryDate} IS NOT NULL`
      )
    );

  return successResponse({ records }, 200);
}
