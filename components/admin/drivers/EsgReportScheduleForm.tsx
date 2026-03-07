"use client";

import { useState } from "react";
import { toast } from "sonner";
import { endOfMonth, endOfQuarter, format } from "date-fns";

interface Props {
  onCreated?: () => void;
  initial?: {
    id?: string;
    periodType?: string;
    hrEmail?: string;
    language?: string;
    active?: boolean;
  };
}

function nextRunAt(periodType: string): string {
  const today = new Date();
  if (periodType === "monthly")   return format(endOfMonth(today), "yyyy-MM-dd");
  if (periodType === "quarterly") return format(endOfQuarter(today), "yyyy-MM-dd");
  return format(endOfMonth(today), "yyyy-MM-dd");
}

export function EsgReportScheduleForm({ onCreated, initial = {} }: Props) {
  const isEdit = !!initial.id;
  const [form, setForm] = useState({
    period_type: initial.periodType ?? "monthly",
    hr_email:    initial.hrEmail   ?? "",
    language:    initial.language  ?? "fr",
    active:      initial.active != null ? String(initial.active) : "true",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url    = isEdit ? `/api/esg-report-schedules/${initial.id}` : "/api/esg-report-schedules";
      const method = isEdit ? "PATCH" : "POST";
      const body: Record<string, unknown> = {
        period_type: form.period_type,
        hr_email:    form.hr_email,
        language:    form.language,
        active:      form.active === "true",
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { toast.error("Failed to save schedule"); return; }
      toast.success(isEdit ? "Schedule updated" : "Schedule created");
      onCreated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Period type</label>
        <select value={form.period_type} onChange={(e) => set("period_type", e.target.value)}
          className="rounded-[10px] border px-3 py-2 text-[13px] bg-transparent outline-none focus:ring-2 focus:ring-[var(--navy)]"
          style={{ borderColor: "var(--hairline)" }}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Language</label>
        <select value={form.language} onChange={(e) => set("language", e.target.value)}
          className="rounded-[10px] border px-3 py-2 text-[13px] bg-transparent outline-none focus:ring-2 focus:ring-[var(--navy)]"
          style={{ borderColor: "var(--hairline)" }}>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="col-span-2 flex flex-col gap-1">
        <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>HR e-mail (report recipient)</label>
        <input type="email" value={form.hr_email} onChange={(e) => set("hr_email", e.target.value)}
          className="rounded-[10px] border px-3 py-2 text-[13px] bg-transparent outline-none focus:ring-2 focus:ring-[var(--navy)]"
          style={{ borderColor: "var(--hairline)" }} required />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Status</label>
        <select value={form.active} onChange={(e) => set("active", e.target.value)}
          className="rounded-[10px] border px-3 py-2 text-[13px] bg-transparent outline-none focus:ring-2 focus:ring-[var(--navy)]"
          style={{ borderColor: "var(--hairline)" }}>
          <option value="true">Active</option>
          <option value="false">Paused</option>
        </select>
      </div>
      <div className="flex flex-col gap-1 justify-end">
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
          Next run: <strong>{nextRunAt(form.period_type)}</strong>
        </p>
      </div>
      <div className="col-span-2 flex justify-end">
        <button type="submit" disabled={saving}
          className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--navy)" }}>
          {saving ? "Saving…" : isEdit ? "Update Schedule" : "Create Schedule"}
        </button>
      </div>
    </form>
  );
}
