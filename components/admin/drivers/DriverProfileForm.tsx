"use client";

import { useState } from "react";
import { toast } from "sonner";

interface Props {
  driverId: string;
  onSaved?: () => void;
  initial?: {
    licenseNumber?: string;
    licenseCategory?: string;
    licenseExpiryDate?: string;
    vehiclePlate?: string;
    contractType?: string;
    hireDate?: string;
    gender?: string;
    age?: number;
    nationalityIso?: string;
    homeBaseCity?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    hrEmail?: string;
    notes?: string;
  };
}

export function DriverProfileForm({ driverId, onSaved, initial = {} }: Props) {
  const [form, setForm] = useState({
    license_number:          initial.licenseNumber ?? "",
    license_category:        initial.licenseCategory ?? "",
    license_expiry_date:     initial.licenseExpiryDate ?? "",
    vehicle_plate:           initial.vehiclePlate ?? "",
    contract_type:           initial.contractType ?? "cdi",
    hire_date:               initial.hireDate ?? "",
    gender:                  initial.gender ?? "",
    age:                     initial.age?.toString() ?? "",
    nationality_iso:         initial.nationalityIso ?? "",
    home_base_city:          initial.homeBaseCity ?? "",
    emergency_contact_name:  initial.emergencyContactName ?? "",
    emergency_contact_phone: initial.emergencyContactPhone ?? "",
    hr_email:                initial.hrEmail ?? "",
    notes:                   initial.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v !== "") payload[k] = k === "age" ? parseInt(v, 10) : v;
      }
      const res = await fetch(`/api/drivers/${driverId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { toast.error("Failed to save profile"); return; }
      toast.success("Profile saved");
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: string, type = "text", extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>{label}</label>
      <input
        type={type}
        value={form[key as keyof typeof form]}
        onChange={(e) => set(key, e.target.value)}
        className="rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--navy)] bg-transparent"
        style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}
        {...extra}
      />
    </div>
  );

  const select = (label: string, key: string, opts: string[]) => (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>{label}</label>
      <select
        value={form[key as keyof typeof form]}
        onChange={(e) => set(key, e.target.value)}
        className="rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--navy)] bg-transparent"
        style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}
      >
        <option value="">— select —</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
      {field("License number", "license_number")}
      {field("License category", "license_category")}
      {field("License expiry", "license_expiry_date", "date")}
      {field("Vehicle plate", "vehicle_plate")}
      {select("Contract type", "contract_type", ["cdi", "cdd", "interim", "independent", "other"])}
      {field("Hire date", "hire_date", "date")}
      {select("Gender", "gender", ["male", "female", "non_binary", "prefer_not_to_say"])}
      {field("Age", "age", "number", { min: "16", max: "80" })}
      {field("Nationality (ISO-2)", "nationality_iso", "text", { maxLength: 2 })}
      {field("Home base city", "home_base_city")}
      {field("Emergency contact name", "emergency_contact_name")}
      {field("Emergency contact phone", "emergency_contact_phone", "tel")}
      {field("HR e-mail", "hr_email", "email")}
      <div className="col-span-2 flex flex-col gap-1">
        <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          className="rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--navy)] bg-transparent resize-none"
          style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}
        />
      </div>
      <div className="col-span-2 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--navy)" }}
        >
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </div>
    </form>
  );
}
