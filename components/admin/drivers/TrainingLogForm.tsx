"use client";

import { useState } from "react";
import { toast } from "sonner";

const TRAINING_TYPES = ["eco_driving", "safety", "adr_hazmat", "digital_tachograph", "first_aid", "gdpr", "other"];

interface Props {
  driverId: string;
  onCreated?: () => void;
}

export function TrainingLogForm({ driverId, onCreated }: Props) {
  const [form, setForm] = useState({
    training_type:        "safety",
    title:                "",
    provider:             "",
    completed_at:         new Date().toISOString().split("T")[0],
    duration_hours:       "",
    passed:               "true",
    cost_eur:             "",
    certification_number: "",
    expiry_date:          "",
    notes:                "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        training_type:  form.training_type,
        title:          form.title,
        completed_at:   form.completed_at,
        passed:         form.passed === "true",
      };
      if (form.provider)             payload.provider             = form.provider;
      if (form.duration_hours)       payload.duration_hours       = parseFloat(form.duration_hours);
      if (form.cost_eur)             payload.cost_eur             = parseFloat(form.cost_eur);
      if (form.certification_number) payload.certification_number = form.certification_number;
      if (form.expiry_date)          payload.expiry_date          = form.expiry_date;
      if (form.notes)                payload.notes                = form.notes;

      const res = await fetch(`/api/drivers/${driverId}/training`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { toast.error("Failed to save training record"); return; }
      toast.success("Training record saved");
      onCreated?.();
    } finally {
      setSaving(false);
    }
  };

  const inp = (label: string, key: string, type = "text", extra?: object) => (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>{label}</label>
      <input type={type} value={form[key as keyof typeof form]} onChange={(e) => set(key, e.target.value)}
        className="rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--navy)] bg-transparent"
        style={{ borderColor: "var(--hairline)" }} {...extra} />
    </div>
  );

  const sel = (label: string, key: string, opts: string[]) => (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>{label}</label>
      <select value={form[key as keyof typeof form]} onChange={(e) => set(key, e.target.value)}
        className="rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--navy)] bg-transparent"
        style={{ borderColor: "var(--hairline)" }}>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
      {sel("Training type", "training_type", TRAINING_TYPES)}
      {inp("Title", "title", "text", { required: true })}
      {inp("Provider", "provider")}
      {inp("Completed on", "completed_at", "date")}
      {inp("Duration (hours)", "duration_hours", "number")}
      {sel("Passed?", "passed", ["true", "false"])}
      {inp("Cost (€)", "cost_eur", "number")}
      {inp("Certification number", "certification_number")}
      {inp("Expiry date", "expiry_date", "date")}
      {inp("Notes", "notes")}
      <div className="col-span-2 flex justify-end">
        <button type="submit" disabled={saving}
          className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--navy)" }}>
          {saving ? "Saving…" : "Save Record"}
        </button>
      </div>
    </form>
  );
}
