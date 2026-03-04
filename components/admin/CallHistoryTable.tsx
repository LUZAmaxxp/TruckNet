"use client";

import { Phone, Video, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { CallHistoryEntry } from "@/app/(admin)/admin/calls/page";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ongoing: { bg: "var(--navy-lt)", text: "var(--navy)" },
  completed: { bg: "var(--sage-lt)", text: "var(--sage)" },
  missed: { bg: "var(--honey-lt)", text: "var(--honey)" },
  declined: { bg: "var(--terra-lt)", text: "var(--terra)" },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface CallHistoryTableProps {
  calls: CallHistoryEntry[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  typeFilter: "all" | "voice" | "video";
  statusFilter: "all" | "ongoing" | "completed" | "missed" | "declined";
  onPageChange: (p: number) => void;
  onTypeFilter: (v: "all" | "voice" | "video") => void;
  onStatusFilter: (v: "all" | "ongoing" | "completed" | "missed" | "declined") => void;
}

/**
 * CallHistoryTable — filterable table of all call records.
 */
export function CallHistoryTable({
  calls,
  total,
  page,
  limit,
  loading,
  typeFilter,
  statusFilter,
  onPageChange,
  onTypeFilter,
  onStatusFilter,
}: CallHistoryTableProps) {
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1 items-center">
          <span className="font-mono text-[10px] uppercase tracking-wide mr-1" style={{ color: "var(--subtle)" }}>Type:</span>
          {(["all", "voice", "video"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onTypeFilter(t)}
              className="px-2.5 py-1.5 rounded-[8px] font-body text-[12px] font-semibold capitalize transition-colors"
              style={{
                background: typeFilter === t ? "var(--navy-lt)" : "var(--base)",
                color: typeFilter === t ? "var(--navy)" : "var(--muted)",
                border: typeFilter === t ? "1px solid var(--navy-pale)" : "1px solid var(--hairline)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1 items-center">
          <span className="font-mono text-[10px] uppercase tracking-wide mr-1" style={{ color: "var(--subtle)" }}>Status:</span>
          {(["all", "ongoing", "completed", "missed", "declined"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onStatusFilter(s)}
              className="px-2.5 py-1.5 rounded-[8px] font-body text-[12px] font-semibold capitalize transition-colors"
              style={{
                background: statusFilter === s ? "var(--navy-lt)" : "var(--base)",
                color: statusFilter === s ? "var(--navy)" : "var(--muted)",
                border: statusFilter === s ? "1px solid var(--navy-pale)" : "1px solid var(--hairline)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[12px]" style={{ border: "1px solid var(--hairline)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--hairline)", background: "var(--base)" }}>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--subtle)" }}>Caller</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--subtle)" }}>Callee</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--subtle)" }}>Type</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--subtle)" }}>Status</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: "var(--subtle)" }}>Duration</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: "var(--subtle)" }}>Started</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--hairline)" }}>
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-7 rounded-[8px] animate-pulse" style={{ background: "var(--hairline-2)" }} />
                    </td>
                  </tr>
                ))
              : calls.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center font-body text-[13px]" style={{ color: "var(--muted)" }}>No calls found</td>
                </tr>
              )
              : calls.map((call) => {
                  const sc = STATUS_COLORS[call.status];
                  return (
                  <tr
                    key={call.id}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--hairline)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--base)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-4 py-3 font-body text-[13px]" style={{ color: "var(--ink)" }}>{call.callerName ?? "Deleted user"}</td>
                    <td className="px-4 py-3 font-body text-[13px]" style={{ color: "var(--ink)" }}>{call.calleeName ?? "Deleted user"}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 font-body text-[13px]" style={{ color: "var(--ink)" }}>
                        {call.callType === "voice" ? (
                          <Phone className="h-3.5 w-3.5" style={{ color: "var(--slate)" }} />
                        ) : (
                          <Video className="h-3.5 w-3.5" style={{ color: "var(--slate)" }} />
                        )}
                        <span className="capitalize">{call.callType}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-[20px] px-[10px] py-[3px] font-body text-[11px] font-semibold capitalize"
                        style={{ background: sc?.bg ?? "var(--hairline-2)", color: sc?.text ?? "var(--subtle)" }}
                      >
                        {call.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="flex items-center gap-1 font-mono text-[11px]" style={{ color: "var(--slate)" }}>
                        <Clock className="h-3 w-3" />
                        {formatDuration(call.durationSeconds)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-[11px]" style={{ color: "var(--muted)" }}>
                      {call.startedAt
                        ? new Date(call.startedAt).toLocaleString()
                        : new Date(call.createdAt).toLocaleString()}
                    </td>
                  </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between font-body text-[12px]" style={{ color: "var(--muted)" }}>
          <span>
            {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-[8px] p-1.5 disabled:opacity-30 transition-colors"
              style={{ color: "var(--ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hairline-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-[8px] p-1.5 disabled:opacity-30 transition-colors"
              style={{ color: "var(--ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hairline-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
