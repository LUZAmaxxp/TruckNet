"use client";

import { useState } from "react";
import { toast } from "sonner";

const FUEL_TYPES = ["diesel", "petrol", "lpg", "electric", "hydrogen", "cng", "other"];
const MAINTENANCE_TYPES = ["oil_change", "tire_rotation", "brake_inspection", "fuel_fill", "scheduled_service", "repair", "inspection", "other"];

interface Props {
  driverId: string;
  onCreated?: () => void;
}

export function MaintenanceLogForm({ driverId, onCreated }: Props) {
  const [form, setForm] = useState({
    vehicle_plate:        "",
    maintenance_type:     "fuel_fill",
    performed_at:         new Date().toISOString().split("T")[0],
    odometer_km:          "",
    cost_eur:             "",
    fuel_liters:          "",
    fuel_type:            "diesel",
    provider_name:        "",
    next_due_at:          "",
    next_due_km:          "",
    regulatory_compliant: "true",
    notes:                "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        vehicle_plate:        form.vehicle_plate,
        maintenance_type:     form.maintenance_type,
        performed_at:         form.performed_at,
        regulatory_compliant: form.regulatory_compliant === "true",
      };
      if (form.odometer_km)  payload.odometer_km  = parseFloat(form.odometer_km);
      if (form.cost_eur)     payload.cost_eur      = parseFloat(form.cost_eur);
      if (form.fuel_liters)  payload.fuel_liters   = parseFloat(form.fuel_liters);
      if (form.fuel_type)    payload.fuel_type      = form.fuel_type;
      if (form.provider_name) payload.provider_name = form.provider_name;
      if (form.next_due_at)  payload.next_due_at   = form.next_due_at;
      if (form.next_due_km)  payload.next_due_km   = parseFloat(form.next_due_km);
      if (form.notes)        payload.notes          = form.notes;

      const res = await fetch(`/api/drivers/${driverId}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { toast.error("Failed to save maintenance log"); return; }
      toast.success("Maintenance log saved");
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
      {inp("Vehicle plate", "vehicle_plate", "text", { required: true })}
      {sel("Type", "maintenance_type", MAINTENANCE_TYPES)}
      {inp("Date performed", "performed_at", "date")}
      {inp("Odometer (km)", "odometer_km", "number")}
      {inp("Cost (€)", "cost_eur", "number")}
      {inp("Fuel liters", "fuel_liters", "number")}
      {sel("Fuel type", "fuel_type", FUEL_TYPES)}
      {inp("Provider name", "provider_name")}
      {inp("Next due date", "next_due_at", "date")}
      {inp("Next due km", "next_due_km", "number")}
      {sel("Regulatory compliant?", "regulatory_compliant", ["true", "false"])}
      {inp("Notes", "notes")}
      <div className="col-span-2 flex justify-end">
        <button type="submit" disabled={saving}
          className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--navy)" }}>
          {saving ? "Saving…" : "Save Log"}
        </button>
      </div>
    </form>
  );
}
