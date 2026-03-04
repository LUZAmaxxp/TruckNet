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
          <h1 className="text-2xl font-bold text-white">SOS Alerts</h1>
          <p className="text-sm text-gray-400 mt-1">
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === opt.value
                  ? "bg-red-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <p className="text-lg font-medium">No alerts found</p>
          <p className="text-sm mt-1">
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
            className="px-3 py-1.5 rounded-lg bg-gray-800 text-sm disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg bg-gray-800 text-sm disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
