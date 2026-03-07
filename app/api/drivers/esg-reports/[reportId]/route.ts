import { type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { driverEsgReports } from "@/db/schema";
import { isUUID } from "@/lib/validate-uuid";

export async function GET(
  _req: NextRequest,
  { params }: { params: { reportId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.reportId)) return errorResponse("Invalid reportId", 400);

  const [report] = await db
    .select()
    .from(driverEsgReports)
    .where(eq(driverEsgReports.id, params.reportId))
    .limit(1);

  if (!report) return errorResponse("Report not found", 404);
  return successResponse({ report }, 200);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { reportId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.reportId)) return errorResponse("Invalid reportId", 400);

  const [deleted] = await db
    .delete(driverEsgReports)
    .where(eq(driverEsgReports.id, params.reportId))
    .returning({ id: driverEsgReports.id });

  if (!deleted) return errorResponse("Report not found", 404);
  return successResponse({ deleted: true }, 200);
}
