"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileBarChart, AlertTriangle, Leaf } from "lucide-react";

interface FleetDriver {
  driverId: string;
  driverName: string;
  totalGhgKgco2eq: number | null;
  ghgIntensityPerKm: number | null;
  expiringCerts: number | null;
  latestReportId: string | null;
  periodEnd: string | null;
}

interface EsgReport {
  id: string;
  driverId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalGhgKgco2eq: number;
  createdAt: string;
}

export function EsgDashboardWidgets() {
  const [fleet, setFleet] = useState<FleetDriver[]>([]);
  const [recentReports, setRecentReports] = useState<EsgReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [fleetRes, reportsRes] = await Promise.all([
        fetch("/api/drivers/fleet-esg-summary"),
        fetch("/api/drivers/esg-reports"),
      ]);
      if (fleetRes.ok) { const d = await fleetRes.json(); setFleet(d.summary ?? []); }
      if (reportsRes.ok) { const d = await reportsRes.json(); setRecentReports((d.reports ?? []).slice(0, 3)); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const totalGhg = fleet.reduce((s, d) => s + (d.totalGhgKgco2eq ?? 0), 0);
  const expiringCerts = fleet.reduce((s, d) => s + (d.expiringCerts ?? 0), 0);
  const driversWithReports = fleet.filter((d) => d.latestReportId).length;

  if (loading) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
        ESG Overview
      </p>
      <div className="grid grid-cols-3 gap-3">
        {/* Fleet GHG total */}
        <div className="flex flex-col gap-1.5 rounded-[12px] p-4" style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}>
          <div className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
            <Leaf className="h-4 w-4" />
            <span className="text-[11px] font-medium uppercase tracking-wide">Fleet GHG Scope 1</span>
          </div>
          <p className="font-display text-[22px] font-bold" style={{ color: "var(--navy)" }}>
            {totalGhg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span className="ml-1 text-[13px] font-normal" style={{ color: "var(--muted)" }}>kg CO₂e</span>
          </p>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>
            {driversWithReports} of {fleet.length} drivers with reports
          </p>
        </div>

        {/* Expiring certifications */}
        <div className="flex flex-col gap-1.5 rounded-[12px] p-4" style={{ border: "1px solid var(--hairline)", background: expiringCerts > 0 ? "var(--terra-lt)" : "var(--surface)" }}>
          <div className="flex items-center gap-2" style={{ color: expiringCerts > 0 ? "var(--terra)" : "var(--muted)" }}>
            <AlertTriangle className="h-4 w-4" />
            <span className="text-[11px] font-medium uppercase tracking-wide">Expiring Certs</span>
          </div>
          <p className="font-display text-[22px] font-bold" style={{ color: expiringCerts > 0 ? "var(--terra)" : "var(--ink)" }}>
            {expiringCerts}
          </p>
          <p className="text-[12px]" style={{ color: expiringCerts > 0 ? "var(--terra)" : "var(--muted)" }}>
            certifications expiring within 90 days
          </p>
        </div>

        {/* Recent reports */}
        <div className="flex flex-col gap-1.5 rounded-[12px] p-4" style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
              <FileBarChart className="h-4 w-4" />
              <span className="text-[11px] font-medium uppercase tracking-wide">Latest Reports</span>
            </div>
            <Link href="/admin/drivers/esg-reports" className="text-[11px] font-medium" style={{ color: "var(--navy)" }}>
              View all →
            </Link>
          </div>
          {recentReports.length === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>No reports yet.</p>
          ) : (
            <div className="flex flex-col gap-1 mt-1">
              {recentReports.map((r) => (
                <Link key={r.id} href={`/admin/drivers/${r.driverId}`}
                  className="flex items-center justify-between text-[12px] rounded-[8px] px-2 py-1 hover:bg-[var(--base)]"
                  style={{ color: "var(--ink)" }}>
                  <span className="font-mono text-[11px]">{r.periodStart.slice(0, 7)}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    r.status === "ready" ? "text-emerald-700 bg-emerald-50" :
                    r.status === "generating" ? "text-blue-700 bg-blue-50" :
                    "text-red-700 bg-red-50"
                  }`}>
                    {r.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
