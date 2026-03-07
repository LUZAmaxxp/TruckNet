"use client";

import { Download, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

interface EsgReport {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalTrips: number;
  emptyRunPct: number | null;
  totalDistanceKm: number;
  totalDrivingHours: number;
  totalShiftHours: number;
  totalOvertimeHours: number;
  totalFuelLiters: number;
  totalGhgKgco2eq: number;
  ghgIntensityPerKm: number | null;
  incidentCount: number;
  trainingHours: number;
  certificationsCount: number;
  expiringCertificationsCount: number;
  generatedAt: string | null;
  createdAt: string;
}

interface Props {
  report: EsgReport;
  onRefresh?: () => void;
}

function KpiCell({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-[12px] p-3"
      style={{ background: highlight ? "var(--navy-lt)" : "var(--base)", border: "1px solid var(--hairline)" }}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</span>
      <span className="font-display text-[18px] font-bold leading-tight" style={{ color: highlight ? "var(--navy)" : "var(--ink)" }}>
        {value}
        {unit && <span className="ml-1 text-[12px] font-normal" style={{ color: "var(--muted)" }}>{unit}</span>}
      </span>
    </div>
  );
}

export function EsgReportKpiGrid({ report, onRefresh }: Props) {
  const [downloading, setDownloading] = useState<"pdf" | "csv" | null>(null);

  const download = async (format: "pdf" | "csv") => {
    setDownloading(format);
    try {
      const res = await fetch(`/api/drivers/esg-reports/${report.id}/download?format=${format}`);
      if (!res.ok) { return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `esg_${report.periodStart}_${report.periodEnd}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-[15px] font-bold" style={{ color: "var(--ink)" }}>
            {report.periodType.charAt(0).toUpperCase() + report.periodType.slice(1)} Report
          </p>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>
            {report.periodStart} → {report.periodEnd}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              report.status === "ready"      ? "text-emerald-700 bg-emerald-50" :
              report.status === "generating" ? "text-blue-700 bg-blue-50" :
              "text-red-700 bg-red-50"
            }`}>
              {report.status}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button onClick={onRefresh}
              className="rounded-[8px] border p-2 text-[12px]"
              style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}>
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          {report.status === "ready" && (
            <>
              <button onClick={() => void download("csv")} disabled={!!downloading}
                className="flex items-center gap-1 rounded-[8px] border px-3 py-2 text-[12px] font-medium disabled:opacity-50"
                style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}>
                {downloading === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                CSV
              </button>
              <button onClick={() => void download("pdf")} disabled={!!downloading}
                className="flex items-center gap-1 rounded-[8px] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--navy)" }}>
                {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI grid */}
      {report.status === "ready" && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <KpiCell label="Trips" value={String(report.totalTrips)} />
          <KpiCell label="Empty run %" value={report.emptyRunPct != null ? report.emptyRunPct.toFixed(1) : "N/A"} unit="%" />
          <KpiCell label="Distance" value={report.totalDistanceKm.toLocaleString()} unit="km" />
          <KpiCell label="Driving" value={report.totalDrivingHours.toFixed(1)} unit="h" />
          <KpiCell label="Total shift" value={report.totalShiftHours.toFixed(1)} unit="h" />
          <KpiCell label="Overtime" value={report.totalOvertimeHours.toFixed(1)} unit="h" />
          <KpiCell label="Fuel" value={report.totalFuelLiters.toFixed(0)} unit="L" />
          <KpiCell label="GHG Scope 1" value={report.totalGhgKgco2eq.toFixed(0)} unit="kg CO₂e" highlight />
          <KpiCell label="GHG / km" value={report.ghgIntensityPerKm != null ? report.ghgIntensityPerKm.toFixed(3) : "N/A"} unit="kg/km" />
          <KpiCell label="Incidents" value={String(report.incidentCount)} />
          <KpiCell label="Training" value={report.trainingHours.toFixed(1)} unit="h" />
          <KpiCell label="Certs expiring" value={String(report.expiringCertificationsCount)} highlight={report.expiringCertificationsCount > 0} />
        </div>
      )}
      {report.status === "generating" && (
        <div className="flex items-center justify-center gap-2 py-8 text-[13px]" style={{ color: "var(--muted)" }}>
          <Loader2 className="h-5 w-5 animate-spin" />
          Generating report — please refresh in a moment…
        </div>
      )}
      {report.status === "failed" && (
        <p className="py-4 text-center text-[13px] text-red-600">Report generation failed. Please retry.</p>
      )}
    </div>
  );
}
