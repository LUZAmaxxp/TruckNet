"use client";

import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Shift {
  id: string;
  shiftDate: string;
  startedAt: string;
  endedAt: string | null;
  drivingMinutes: number | null;
  breakMinutes: number;
  overtimeMinutes: number | null;
  nightShift: boolean | null;
  status: string;
  driverNotes: string | null;
}

interface Props {
  driverId: string;
  shifts: Shift[];
  loading?: boolean;
  onRefresh?: () => void;
}

export function ShiftLogTable({ driverId, shifts, loading, onRefresh }: Props) {
  const [completing, setCompleting] = useState<string | null>(null);

  const handleComplete = async (shiftId: string) => {
    setCompleting(shiftId);
    try {
      const res = await fetch(`/api/drivers/${driverId}/shifts/${shiftId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) { toast.error("Failed to complete shift"); return; }
      toast.success("Shift completed");
      onRefresh?.();
    } finally {
      setCompleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  if (!shifts.length) {
    return <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>No shifts recorded.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
            {["Date", "Started", "Ended", "Drive (h)", "Break (m)", "OT (m)", "Status", ""].map((h) => (
              <th key={h} className="pb-2 pr-4 font-medium" style={{ color: "var(--muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shifts.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
              <td className="py-2 pr-4">{s.shiftDate}</td>
              <td className="py-2 pr-4">{new Date(s.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
              <td className="py-2 pr-4">{s.endedAt ? new Date(s.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
              <td className="py-2 pr-4">{s.drivingMinutes != null ? (s.drivingMinutes / 60).toFixed(1) : "—"}</td>
              <td className="py-2 pr-4">{s.breakMinutes}</td>
              <td className="py-2 pr-4">{s.overtimeMinutes ?? 0}</td>
              <td className="py-2 pr-4">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  s.status === "completed" ? "text-emerald-700 bg-emerald-50" :
                  s.status === "active"    ? "text-blue-700 bg-blue-50" :
                  "text-orange-700 bg-orange-50"
                }`}>
                  {s.status === "completed" ? <CheckCircle2 className="h-3 w-3" /> :
                   s.status === "active"    ? <Clock className="h-3 w-3" /> :
                   <XCircle className="h-3 w-3" />}
                  {s.status}
                </span>
              </td>
              <td className="py-2">
                {s.status === "active" && (
                  <button
                    onClick={() => void handleComplete(s.id)}
                    disabled={completing === s.id}
                    className="rounded-[8px] px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--navy)" }}
                  >
                    {completing === s.id ? "…" : "Complete"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
