"use client";

import { useCallback, useEffect, useState } from "react";
import { SosAlertCard } from "@/components/admin/SosAlertCard";
import type { SosAdminEntry } from "../page";

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Resolved", value: "resolved" },
] as const;

/**
 * /admin/sos — Full SOS alert management page.
 * Shows active + resolved alerts with filter and inline resolve action.
 */
export default function AdminSosPage() {
  const [alerts, setAlerts] = useState<SosAdminEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "resolved">("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        limit: String(limit),
      });
      const res = await fetch(`/api/admin/sos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts ?? []);
        setTotal(data.total ?? 0);
        setActiveCount(data.activeCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const handleResolve = async (id: string) => {
    const res = await fetch(`/api/admin/sos/${id}/resolve`, { method: "PATCH" });
    if (res.ok) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "resolved" as const } : a))
      );
      setActiveCount((c) => Math.max(0, c - 1));
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-[-0.03em]" style={{ color: "var(--ink)" }}>SOS Alerts</h1>
          <p className="font-body text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            {activeCount} active · {total} total
          </p>
        </div>

        {/* Status filter */}
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setStatusFilter(opt.value);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-[8px] font-body text-[12px] font-semibold transition-colors"
              style={{
                background: statusFilter === opt.value ? "var(--terra-lt)" : "var(--base)",
                color: statusFilter === opt.value ? "var(--terra)" : "var(--muted)",
                border: statusFilter === opt.value ? "1px solid rgba(184,80,57,0.3)" : "1px solid var(--hairline)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-[12px] animate-pulse" style={{ background: "var(--hairline-2)" }} />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="font-display text-[18px] font-bold" style={{ color: "var(--ink)" }}>No alerts found</p>
          <p className="font-body text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            {statusFilter === "active" ? "No active SOS signals right now." : "Nothing to display."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {alerts.map((alert) => (
            <SosAlertCard key={alert.id} alert={alert} onResolve={handleResolve} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-[8px] font-body text-[12px] font-semibold disabled:opacity-40 transition-colors"
            style={{ background: "var(--base)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
          >
            Previous
          </button>
          <span className="font-mono text-[11px]" style={{ color: "var(--subtle)" }}>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-[8px] font-body text-[12px] font-semibold disabled:opacity-40 transition-colors"
            style={{ background: "var(--base)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
