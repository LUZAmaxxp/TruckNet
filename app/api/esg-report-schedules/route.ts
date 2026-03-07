import { type NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { esgReportSchedules } from "@/db/schema";
import { CreateEsgReportScheduleSchema } from "@/schemas/driver-esg-report.schema";
import { endOfMonth, endOfQuarter, format } from "date-fns";

function computeNextRunAt(periodType: "monthly" | "quarterly"): string {
  const today = new Date();
  if (periodType === "monthly") {
    // Next run = end of current month
    return format(endOfMonth(today), "yyyy-MM-dd");
  }
  // quarterly = end of current quarter
  return format(endOfQuarter(today), "yyyy-MM-dd");
}

export async function GET(_req: NextRequest) {
  await requireAdminSession();

  const schedules = await db
    .select()
    .from(esgReportSchedules)
    .orderBy(desc(esgReportSchedules.createdAt));

  return successResponse({ schedules }, 200);
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();

  const body = await req.json().catch(() => null);
  const parsed = CreateEsgReportScheduleSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400, parsed.error.issues);

  const d = parsed.data;
  const nextRunAt = computeNextRunAt(d.period_type as "monthly" | "quarterly");

  const [schedule] = await db
    .insert(esgReportSchedules)
    .values({
      periodType: d.period_type,
      hrEmail:    d.hr_email,
      language:   d.language ?? "fr",
      active:     d.active ?? true,
      nextRunAt,
      createdBy:  session.user.id,
      createdAt:  new Date(),
      updatedAt:  new Date(),
    })
    .returning();

  return successResponse({ schedule }, 201);
}
