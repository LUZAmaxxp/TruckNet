"use client";

import { Phone, Video, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { CallHistoryEntry } from "@/app/(admin)/admin/calls/page";

const STATUS_COLORS: Record<string, string> = {
  ongoing: "bg-blue-600/20 text-blue-400",
  completed: "bg-green-600/20 text-green-400",
  missed: "bg-yellow-600/20 text-yellow-400",
  declined: "bg-red-600/20 text-red-400",
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
        <div className="flex gap-1">
          <span className="text-xs text-gray-500 self-center mr-1">Type:</span>
          {(["all", "voice", "video"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onTypeFilter(t)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                typeFilter === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <span className="text-xs text-gray-500 self-center mr-1">Status:</span>
          {(["all", "ongoing", "completed", "missed", "declined"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onStatusFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900">
              <th className="px-4 py-3 text-left font-medium text-gray-400">Caller</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">Callee</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400 hidden sm:table-cell">Duration</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400 hidden md:table-cell">Started</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-7 rounded-lg bg-gray-800 animate-pulse" />
                    </td>
                  </tr>
                ))
              : calls.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No calls found</td>
                </tr>
              )
              : calls.map((call) => (
                  <tr key={call.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-white">{call.callerName ?? "Deleted user"}</td>
                    <td className="px-4 py-3 text-white">{call.calleeName ?? "Deleted user"}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-gray-300">
                        {call.callType === "voice" ? (
                          <Phone className="h-3.5 w-3.5 text-blue-400" />
                        ) : (
                          <Video className="h-3.5 w-3.5 text-purple-400" />
                        )}
                        <span className="capitalize">{call.callType}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          STATUS_COLORS[call.status] ?? "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {call.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="flex items-center gap-1 text-gray-400 text-xs">
                        <Clock className="h-3 w-3" />
                        {formatDuration(call.durationSeconds)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-400">
                      {call.startedAt
                        ? new Date(call.startedAt).toLocaleString()
                        : new Date(call.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-lg p-1.5 hover:bg-gray-700 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-lg p-1.5 hover:bg-gray-700 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
