"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Download } from "lucide-react";

interface EsgReport {
  id: string;
  driverId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalGhgKgco2eq: number;
  totalDistanceKm: number;
  trainingHours: number;
  incidentCount: number;
  createdAt: string;
}

export default function AllEsgReportsPage() {
  const [reports, setReports] = useState<EsgReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "ready" | "generating" | "failed">("all");
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/drivers/esg-reports");
      if (res.ok) { const d = await res.json(); setReports(d.reports ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchReports(); }, [fetchReports]);

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  const download = async (reportId: string, format: "pdf" | "csv") => {
    setDownloading(`${reportId}-${format}`);
    try {
      const res = await fetch(`/api/drivers/esg-reports/${reportId}/download?format=${format}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `esg_report_${reportId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloading(null); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-[-0.03em]" style={{ color: "var(--ink)" }}>
            ESG Reports
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--muted)" }}>
            All generated driver ESG reports
          </p>
        </div>
        <div className="flex gap-1 rounded-[10px] p-1" style={{ background: "var(--base)" }}>
          {(["all", "ready", "generating", "failed"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="rounded-[8px] px-3 py-1 text-[12px] font-medium transition-all"
              style={{ background: filter === f ? "var(--navy)" : "transparent", color: filter === f ? "white" : "var(--muted)" }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      ) : (
        <div className="rounded-[14px] overflow-hidden" style={{ border: "1px solid var(--hairline)" }}>
          <table className="w-full text-left text-[13px]">
            <thead style={{ background: "var(--base)" }}>
              <tr>
                {["Driver", "Period", "Type", "GHG (kg CO₂e)", "Distance", "Status", "Created", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/drivers/${r.driverId}`} className="font-medium hover:underline" style={{ color: "var(--navy)" }}>
                      {r.driverId.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px]">{r.periodStart} → {r.periodEnd}</td>
                  <td className="px-4 py-3">{r.periodType}</td>
                  <td className="px-4 py-3">{r.totalGhgKgco2eq?.toFixed(0) ?? "—"}</td>
                  <td className="px-4 py-3">{r.totalDistanceKm?.toLocaleString()} km</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      r.status === "ready"      ? "text-emerald-700 bg-emerald-50" :
                      r.status === "generating" ? "text-blue-700 bg-blue-50" :
                      "text-red-700 bg-red-50"
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "var(--muted)" }}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "ready" && (
                      <div className="flex gap-1">
                        <button onClick={() => void download(r.id, "pdf")} disabled={!!downloading}
                          className="rounded-[7px] border px-2 py-1 text-[11px] font-medium flex items-center gap-1 disabled:opacity-40"
                          style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}>
                          {downloading === `${r.id}-pdf` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          PDF
                        </button>
                        <button onClick={() => void download(r.id, "csv")} disabled={!!downloading}
                          className="rounded-[7px] border px-2 py-1 text-[11px] font-medium flex items-center gap-1 disabled:opacity-40"
                          style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}>
                          {downloading === `${r.id}-csv` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          CSV
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>
                    No reports found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
