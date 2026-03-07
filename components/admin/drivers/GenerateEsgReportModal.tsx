"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

interface Props {
  drivers: { id: string; name: string }[];
  onClose: () => void;
  onCreated?: () => void;
}

export function GenerateEsgReportModal({ drivers, onClose, onCreated }: Props) {
  const today      = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [form, setForm] = useState({
    driver_id:    drivers[0]?.id ?? "",
    period_type:  "monthly",
    period_start: firstOfMonth,
    period_end:   today,
    language:     "fr",
  });
  const [generating, setGenerating] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch("/api/drivers/esg-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error((d as { error?: string }).error ?? "Failed to queue report");
        return;
      }
      toast.success("ESG report queued — it will be ready shortly.");
      onCreated?.();
      onClose();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="relative w-full max-w-md rounded-[16px] p-6 shadow-xl"
        style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}
      >
        <button onClick={onClose} className="absolute right-4 top-4" style={{ color: "var(--muted)" }}>
          <X className="h-5 w-5" />
        </button>
        <h2 className="mb-4 font-display text-[16px] font-bold" style={{ color: "var(--navy)" }}>
          Generate ESG Report
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Driver</label>
            <select value={form.driver_id} onChange={(e) => set("driver_id", e.target.value)}
              className="rounded-[10px] border px-3 py-2 text-[13px] bg-transparent outline-none focus:ring-2 focus:ring-[var(--navy)]"
              style={{ borderColor: "var(--hairline)" }} required>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Period type</label>
            <select value={form.period_type} onChange={(e) => set("period_type", e.target.value)}
              className="rounded-[10px] border px-3 py-2 text-[13px] bg-transparent outline-none focus:ring-2 focus:ring-[var(--navy)]"
              style={{ borderColor: "var(--hairline)" }}>
              {["monthly", "quarterly", "custom"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>From</label>
              <input type="date" value={form.period_start} onChange={(e) => set("period_start", e.target.value)}
                className="rounded-[10px] border px-3 py-2 text-[13px] bg-transparent outline-none focus:ring-2 focus:ring-[var(--navy)]"
                style={{ borderColor: "var(--hairline)" }} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>To</label>
              <input type="date" value={form.period_end} onChange={(e) => set("period_end", e.target.value)}
                className="rounded-[10px] border px-3 py-2 text-[13px] bg-transparent outline-none focus:ring-2 focus:ring-[var(--navy)]"
                style={{ borderColor: "var(--hairline)" }} required />
            </div>
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
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-[10px] border px-4 py-2 text-[13px] font-medium"
              style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}>
              Cancel
            </button>
            <button type="submit" disabled={generating}
              className="flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--navy)" }}>
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              {generating ? "Queueing…" : "Generate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
