"use client";

import { useState } from "react";
import { toast } from "sonner";

interface Props {
  driverId: string;
  onCreated?: () => void;
}

export function ShiftLogForm({ driverId, onCreated }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const nowIso = new Date().toISOString().slice(0, 16);

  const [form, setForm] = useState({
    shift_date:    today,
    started_at:    nowIso,
    break_minutes: "0",
    driver_notes:  "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/drivers/${driverId}/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_date:    form.shift_date,
          started_at:    new Date(form.started_at).toISOString(),
          break_minutes: parseInt(form.break_minutes, 10) || 0,
          driver_notes:  form.driver_notes || undefined,
        }),
      });
      if (!res.ok) { toast.error("Failed to create shift"); return; }
      toast.success("Shift started");
      onCreated?.();
      setForm({ shift_date: today, started_at: nowIso, break_minutes: "0", driver_notes: "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Shift date</label>
        <input type="date" value={form.shift_date} onChange={(e) => set("shift_date", e.target.value)}
          className="rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--navy)] bg-transparent"
          style={{ borderColor: "var(--hairline)" }} required />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Started at</label>
        <input type="datetime-local" value={form.started_at} onChange={(e) => set("started_at", e.target.value)}
          className="rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--navy)] bg-transparent"
          style={{ borderColor: "var(--hairline)" }} required />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Break (minutes)</label>
        <input type="number" min="0" max="480" value={form.break_minutes} onChange={(e) => set("break_minutes", e.target.value)}
          className="rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--navy)] bg-transparent"
          style={{ borderColor: "var(--hairline)" }} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Notes</label>
        <input type="text" value={form.driver_notes} onChange={(e) => set("driver_notes", e.target.value)}
          className="rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--navy)] bg-transparent"
          style={{ borderColor: "var(--hairline)" }} />
      </div>
      <div className="col-span-2 flex justify-end">
        <button type="submit" disabled={saving}
          className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--navy)" }}>
          {saving ? "Saving…" : "Start Shift"}
        </button>
      </div>
    </form>
  );
}
