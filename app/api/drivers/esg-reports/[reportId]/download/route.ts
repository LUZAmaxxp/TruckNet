import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/auth-helpers";
import { errorResponse } from "@/lib/api";
import { db } from "@/db";
import { driverEsgReports, users } from "@/db/schema";
import { isUUID } from "@/lib/validate-uuid";
import { buildEsgDataPackage } from "@/lib/driver-esg-aggregator";
import { buildDriverEsgHtml } from "@/lib/driver-esg-html-template";
import { renderDriverEsgPdf } from "@/lib/driver-esg-pdf";
import { generateDriverEsgCsv } from "@/lib/driver-esg-csv";

export async function GET(
  req: NextRequest,
  { params }: { params: { reportId: string } }
) {
  await requireAdminSession();
  if (!isUUID(params.reportId)) return errorResponse("Invalid reportId", 400);

  const format = req.nextUrl.searchParams.get("format") ?? "pdf";
  if (format !== "pdf" && format !== "csv") return errorResponse("format must be pdf or csv", 400);

  const [report] = await db
    .select()
    .from(driverEsgReports)
    .where(eq(driverEsgReports.id, params.reportId))
    .limit(1);

  if (!report) return errorResponse("Report not found", 404);
  if (report.status !== "ready") return errorResponse("Report is not ready yet", 409);

  const language = req.nextUrl.searchParams.get("lang") ?? "fr";

  const [driver] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, report.driverId))
    .limit(1);

  const driverName = (driver?.name ?? "driver").replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  const safePeriod = `${report.periodStart}_${report.periodEnd}`;

  if (format === "csv") {
    const data = await buildEsgDataPackage(report.driverId, report.periodStart, report.periodEnd, language);
    const csv = generateDriverEsgCsv(data);
    const filename = `esg_${driverName}_${safePeriod}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // PDF
  const data = await buildEsgDataPackage(report.driverId, report.periodStart, report.periodEnd, language);
  const html = buildDriverEsgHtml(data, language);
  const pdfBuffer = await renderDriverEsgPdf(html);
  const filename = `esg_${driverName}_${safePeriod}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
