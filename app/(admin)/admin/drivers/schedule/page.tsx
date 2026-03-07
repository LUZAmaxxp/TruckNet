"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EsgReportScheduleForm } from "@/components/admin/drivers/EsgReportScheduleForm";

interface Schedule {
  id: string;
  periodType: string;
  hrEmail: string;
  language: string;
  active: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  lastRunReportCount: number | null;
}

export default function EsgSchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/esg-report-schedules");
      if (res.ok) { const d = await res.json(); setSchedules(d.schedules ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetch_(); }, [fetch_]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this schedule?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/esg-report-schedules/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to delete"); return; }
      toast.success("Schedule deleted");
      void fetch_();
    } finally { setDeleting(null); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-[-0.03em]" style={{ color: "var(--ink)" }}>
            ESG Report Schedules
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--muted)" }}>
            Automatic monthly / quarterly report generation
          </p>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-white"
          style={{ background: "var(--navy)" }}>
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "New Schedule"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-[14px] p-4" style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}>
          <h2 className="mb-3 font-semibold text-[14px]" style={{ color: "var(--ink)" }}>New Schedule</h2>
          <EsgReportScheduleForm onCreated={() => { setShowForm(false); void fetch_(); }} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {schedules.length === 0 && (
            <p className="text-center py-8 text-[13px]" style={{ color: "var(--muted)" }}>No schedules configured.</p>
          )}
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-[12px] p-4"
              style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[13px]" style={{ color: "var(--ink)" }}>
                    {s.periodType === "monthly" ? "Monthly" : "Quarterly"} · {s.language.toUpperCase()}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.active ? "text-emerald-700 bg-emerald-50" : "text-gray-600 bg-gray-100"}`}>
                    {s.active ? "Active" : "Paused"}
                  </span>
                </div>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>→ {s.hrEmail}</p>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                  Next run: <strong>{s.nextRunAt}</strong>
                  {s.lastRunAt && ` · Last ran: ${s.lastRunAt} (${s.lastRunReportCount ?? 0} reports)`}
                </p>
              </div>
              <button onClick={() => void handleDelete(s.id)} disabled={deleting === s.id}
                className="rounded-[8px] border p-2 text-red-500 hover:bg-red-50 disabled:opacity-40"
                style={{ borderColor: "var(--hairline)" }}>
                {deleting === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
