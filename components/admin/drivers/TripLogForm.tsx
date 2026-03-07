"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Zap } from "lucide-react";

const FUEL_TYPES = ["diesel", "petrol", "lpg", "cng", "electric", "hydrogen", "other"] as const;

/**
 * COPERT-lite fuel estimation model (EU JRC):
 *   fuel_L = (distance_km / 100) × (base_L_per_100km + load_factor_per_tonne × total_laden_tonnes)
 *
 * Defaults (heavy-duty articulated truck):
 *   base      = 25 L/100km  (unladen, per HBEFA 4.1 average HDV)
 *   laden_add = 1.3 L/100km per tonne of cargo
 *   tare      = 8 000 kg    (rigid truck default; user-adjustable)
 */
const BASE_L_PER_100KM   = 25;    // unladen consumption
const LADEN_L_PER_TONNE  = 1.3;   // extra per cargo tonne per 100 km

function estimateFuel(distanceKm: number, cargoKg: number, truckTareKg: number): number {
  const cargoTonnes = cargoKg / 1000;
  const tareTonnes  = truckTareKg / 1000;
  // Only cargo weight drives the variable part; tare just sets minimum base
  const totalFactor = BASE_L_PER_100KM + LADEN_L_PER_TONNE * (cargoTonnes + tareTonnes * 0);
  return Math.round((distanceKm / 100) * (BASE_L_PER_100KM + LADEN_L_PER_TONNE * cargoTonnes) * 10) / 10;
}

interface Props {
  driverId: string;
  onCreated?: () => void;
}

export function TripLogForm({ driverId, onCreated }: Props) {
  const todayIso = new Date().toISOString().slice(0, 16);

  const [form, setForm] = useState({
    vehicle_plate:      "",
    origin_label:       "",
    destination_label:  "",
    started_at:         todayIso,
    completed_at:       "",
    distance_km:        "",
    duration_minutes:   "",
    fuel_liters:        "",
    fuel_type:          "diesel",
    cargo_weight_kg:    "",
    truck_tare_kg:      "8000",
    load_factor_pct:    "",
    is_empty_run:       false,
  });

  // Track whether fuel_liters was manually edited
  const fuelManualRef = useRef(false);
  const [fuelIsEstimated, setFuelIsEstimated] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  // Auto-estimate fuel whenever distance or cargo weight changes (if not manually set)
  useEffect(() => {
    if (fuelManualRef.current) return;
    const dist  = parseFloat(form.distance_km);
    const cargo = parseFloat(form.cargo_weight_kg) || 0;
    const tare  = parseFloat(form.truck_tare_kg) || 8000;
    if (!isNaN(dist) && dist > 0 && form.fuel_type !== "electric" && form.fuel_type !== "hydrogen") {
      const est = estimateFuel(dist, cargo, tare);
      setForm((p) => ({ ...p, fuel_liters: String(est) }));
      setFuelIsEstimated(true);
    }
  }, [form.distance_km, form.cargo_weight_kg, form.truck_tare_kg, form.fuel_type]);

  const handleFuelChange = (v: string) => {
    fuelManualRef.current = true;
    setFuelIsEstimated(false);
    set("fuel_liters", v);
  };

  const resetFuelEstimate = () => {
    fuelManualRef.current = false;
    const dist  = parseFloat(form.distance_km);
    const cargo = parseFloat(form.cargo_weight_kg) || 0;
    const tare  = parseFloat(form.truck_tare_kg) || 8000;
    if (!isNaN(dist) && dist > 0) {
      const est = estimateFuel(dist, cargo, tare);
      setForm((p) => ({ ...p, fuel_liters: String(est) }));
      setFuelIsEstimated(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        vehicle_plate: form.vehicle_plate,
        is_empty_run:  form.is_empty_run,
        status:        "completed",
      };
      if (form.origin_label)      body.origin_label      = form.origin_label;
      if (form.destination_label) body.destination_label = form.destination_label;
      if (form.started_at)        body.started_at        = new Date(form.started_at).toISOString();
      if (form.completed_at)      body.completed_at      = new Date(form.completed_at).toISOString();
      if (form.distance_km)       body.distance_km       = parseFloat(form.distance_km);
      if (form.duration_minutes)  body.duration_minutes  = parseFloat(form.duration_minutes);
      if (form.fuel_liters)       body.fuel_liters       = parseFloat(form.fuel_liters);
      if (form.fuel_type)         body.fuel_type         = form.fuel_type;
      if (form.cargo_weight_kg)   body.cargo_weight_kg   = parseFloat(form.cargo_weight_kg);
      if (form.load_factor_pct)   body.load_factor_pct   = parseFloat(form.load_factor_pct);

      const res = await fetch(`/api/drivers/${driverId}/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { toast.error("Failed to log trip"); return; }
      toast.success("Trip logged");
      onCreated?.();
      fuelManualRef.current = false;
      setFuelIsEstimated(false);
      setForm({
        vehicle_plate: "", origin_label: "", destination_label: "",
        started_at: todayIso, completed_at: "", distance_km: "",
        duration_minutes: "", fuel_liters: "", fuel_type: "diesel",
        cargo_weight_kg: "", truck_tare_kg: "8000", load_factor_pct: "",
        is_empty_run: false,
      });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--navy)] bg-transparent w-full";
  const labelCls = "text-[12px] font-medium";

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
      {/* Vehicle plate */}
      <div className="flex flex-col gap-1">
        <label className={labelCls} style={{ color: "var(--muted)" }}>Vehicle plate *</label>
        <input type="text" value={form.vehicle_plate} onChange={(e) => set("vehicle_plate", e.target.value)}
          className={inputCls} style={{ borderColor: "var(--hairline)" }} required placeholder="e.g. 12-TK-34" />
      </div>

      {/* Fuel type */}
      <div className="flex flex-col gap-1">
        <label className={labelCls} style={{ color: "var(--muted)" }}>Fuel type</label>
        <select value={form.fuel_type} onChange={(e) => set("fuel_type", e.target.value)}
          className={inputCls} style={{ borderColor: "var(--hairline)" }}>
          {FUEL_TYPES.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
        </select>
      </div>

      {/* Origin */}
      <div className="flex flex-col gap-1">
        <label className={labelCls} style={{ color: "var(--muted)" }}>Origin</label>
        <input type="text" value={form.origin_label} onChange={(e) => set("origin_label", e.target.value)}
          className={inputCls} style={{ borderColor: "var(--hairline)" }} placeholder="City / depot" />
      </div>

      {/* Destination */}
      <div className="flex flex-col gap-1">
        <label className={labelCls} style={{ color: "var(--muted)" }}>Destination</label>
        <input type="text" value={form.destination_label} onChange={(e) => set("destination_label", e.target.value)}
          className={inputCls} style={{ borderColor: "var(--hairline)" }} placeholder="City / client" />
      </div>

      {/* Started at */}
      <div className="flex flex-col gap-1">
        <label className={labelCls} style={{ color: "var(--muted)" }}>Started at</label>
        <input type="datetime-local" value={form.started_at} onChange={(e) => set("started_at", e.target.value)}
          className={inputCls} style={{ borderColor: "var(--hairline)" }} />
      </div>

      {/* Completed at */}
      <div className="flex flex-col gap-1">
        <label className={labelCls} style={{ color: "var(--muted)" }}>Completed at</label>
        <input type="datetime-local" value={form.completed_at} onChange={(e) => set("completed_at", e.target.value)}
          className={inputCls} style={{ borderColor: "var(--hairline)" }} />
      </div>

      {/* Distance */}
      <div className="flex flex-col gap-1">
        <label className={labelCls} style={{ color: "var(--muted)" }}>Distance (km) *</label>
        <input type="number" min="0" step="0.1" value={form.distance_km} onChange={(e) => set("distance_km", e.target.value)}
          className={inputCls} style={{ borderColor: "var(--hairline)" }} placeholder="0.0" required />
      </div>

      {/* Truck tare weight */}
      <div className="flex flex-col gap-1">
        <label className={labelCls} style={{ color: "var(--muted)" }}>Truck tare weight (kg)</label>
        <input type="number" min="1000" step="100" value={form.truck_tare_kg} onChange={(e) => set("truck_tare_kg", e.target.value)}
          className={inputCls} style={{ borderColor: "var(--hairline)" }} placeholder="8000" />
      </div>

      {/* Cargo weight */}
      <div className="flex flex-col gap-1">
        <label className={labelCls} style={{ color: "var(--muted)" }}>Cargo weight (kg)</label>
        <input type="number" min="0" step="1" value={form.cargo_weight_kg} onChange={(e) => set("cargo_weight_kg", e.target.value)}
          className={inputCls} style={{ borderColor: "var(--hairline)" }} placeholder="0" />
      </div>

      {/* Load factor */}
      <div className="flex flex-col gap-1">
        <label className={labelCls} style={{ color: "var(--muted)" }}>Load factor (%)</label>
        <input type="number" min="0" max="100" step="1" value={form.load_factor_pct} onChange={(e) => set("load_factor_pct", e.target.value)}
          className={inputCls} style={{ borderColor: "var(--hairline)" }} placeholder="0–100" />
      </div>

      {/* Fuel consumed — auto-estimated */}
      <div className="col-span-2 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className={labelCls} style={{ color: "var(--muted)" }}>
            Fuel consumed (L)
            {fuelIsEstimated && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "var(--honey-lt)", color: "var(--honey)" }}>
                <Zap className="h-3 w-3" />
                Estimated
              </span>
            )}
          </label>
          {!fuelIsEstimated && form.distance_km && (
            <button type="button" onClick={resetFuelEstimate}
              className="text-[11px] underline" style={{ color: "var(--navy)" }}>
              Re-estimate
            </button>
          )}
        </div>
        <input type="number" min="0" step="0.1" value={form.fuel_liters}
          onChange={(e) => handleFuelChange(e.target.value)}
          className={inputCls}
          style={{ borderColor: fuelIsEstimated ? "var(--honey)" : "var(--hairline)" }}
          placeholder="Auto-calculated from distance + cargo" />
        {fuelIsEstimated && (
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            Based on COPERT model: {BASE_L_PER_100KM} L/100km base + {LADEN_L_PER_TONNE} L/100km per cargo tonne. Edit to use actual value.
          </p>
        )}
      </div>

      {/* Empty run */}
      <div className="col-span-2 flex items-center gap-2">
        <input type="checkbox" id="empty_run" checked={form.is_empty_run} onChange={(e) => set("is_empty_run", e.target.checked)}
          className="h-4 w-4 rounded" />
        <label htmlFor="empty_run" className="text-[13px]" style={{ color: "var(--ink)" }}>
          Empty run (truck returned with no cargo)
        </label>
      </div>

      <div className="col-span-2 flex justify-end">
        <button type="submit" disabled={saving}
          className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--navy)" }}>
          {saving ? "Saving…" : "Log Trip"}
        </button>
      </div>
    </form>
  );
}

