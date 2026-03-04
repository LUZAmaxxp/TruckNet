"use client";

import { useCallback, useEffect, useState } from "react";
import { CallHistoryTable } from "@/components/admin/CallHistoryTable";

export type CallHistoryEntry = {
  id: string;
  roomName: string;
  callerId: string | null;
  callerName: string | null;
  callerAvatar: string | null;
  calleeId: string | null;
  calleeName: string | null;
  calleeAvatar: string | null;
  callType: "voice" | "video";
  status: "ongoing" | "completed" | "missed" | "declined";
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
};

/**
 * /admin/calls — Call history log for all calls.
 * Filterable by type, status, and date.
 */
export default function AdminCallsPage() {
  const [calls, setCalls] = useState<CallHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<"all" | "voice" | "video">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "ongoing" | "completed" | "missed" | "declined">("all");
  const [loading, setLoading] = useState(true);

  const limit = 25;

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(typeFilter !== "all" ? { type: typeFilter } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      const res = await fetch(`/api/admin/calls?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => {
    void fetchCalls();
  }, [fetchCalls]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[22px] font-bold tracking-[-0.03em]" style={{ color: "var(--ink)" }}>Call History</h1>
        <p className="font-body text-[13px] mt-1" style={{ color: "var(--muted)" }}>{total} total calls</p>
      </div>

      <CallHistoryTable
        calls={calls}
        total={total}
        page={page}
        limit={limit}
        loading={loading}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        onPageChange={setPage}
        onTypeFilter={(v) => { setTypeFilter(v); setPage(1); }}
        onStatusFilter={(v) => { setStatusFilter(v); setPage(1); }}
      />
    </div>
  );
}
