"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { CheckCircle, XCircle, Navigation, MapPin } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TripStatus = "active" | "completed" | "cancelled";

interface Trip {
  id: string;
  vehiclePlate: string;
  originLabel: string | null;
  destinationLabel: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  fuelLiters: number | null;
  cargoWeightKg: number | null;
  fuelType: string | null;
  startedAt: string | null;
  status: TripStatus;
}

type ActionPanel = "complete" | "cancel" | null;

// ---------------------------------------------------------------------------
// COPERT-lite fuel estimation (same model as TripLogForm)
// ---------------------------------------------------------------------------
const BASE_L_PER_100KM  = 25;
const LADEN_L_PER_TONNE = 1.3;

function estimateFuel(distKm: number, cargoKg: number): number {
  const cargoTonnes = cargoKg / 1000;
  return Math.round((distKm / 100) * (BASE_L_PER_100KM + LADEN_L_PER_TONNE * cargoTonnes) * 10) / 10;
}

const FUEL_TYPES = ["diesel", "petrol", "lpg", "cng", "electric", "hydrogen", "other"] as const;

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------
const inputCls =
  "w-full rounded-[10px] border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--navy)] bg-transparent";
const labelCls = "text-[12px] font-medium mb-1 block";

// ---------------------------------------------------------------------------
// ActiveTripCard
// ---------------------------------------------------------------------------
export function ActiveTripCard() {
  // null = no active trip, "loading" = initial fetch in progress
  const [trip, setTrip] = useState<Trip | null | "loading">("loading");
  const [action, setAction] = useState<ActionPanel>(null);
  const [showStartForm, setShowStartForm] = useState(false);

  // "Start a trip" form state
  const [startForm, setStartForm] = useState({
    vehicle_plate:     "",
    origin_label:      "",
    destination_label: "",
    cargo_weight_kg:   "",
    fuel_type:         "diesel",
  });
  const [starting, setStarting] = useState(false);

  // "Complete trip" optional details form
  const [completeForm, setCompleteForm] = useState({
    distance_km:      "",
    duration_minutes: "",
    fuel_liters:      "",
  });
  const [fuelEstimated, setFuelEstimated] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const fetchActiveTrip = useCallback(async () => {
    try {
      const res = await fetch("/api/trips");
      if (!res.ok) { setTrip(null); return; }
      const json = (await res.json()) as { trip: Trip | null };
      setTrip(json.trip ?? null);
    } catch {
      setTrip(null);
    }
  }, []);

  useEffect(() => { void fetchActiveTrip(); }, [fetchActiveTrip]);

  // Auto-estimate fuel when distance changes in the complete form
  useEffect(() => {
    const dist  = parseFloat(completeForm.distance_km);
    const cargo = trip && trip !== "loading" ? (trip.cargoWeightKg ?? 0) : 0;
    if (!isNaN(dist) && dist > 0) {
      const est = estimateFuel(dist, cargo);
      setCompleteForm((p) => ({ ...p, fuel_liters: String(est) }));
      setFuelEstimated(true);
    }
    // Only react to distance changes; cargo is fixed once the trip is active
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeForm.distance_km]);

  // -------------------------------------------------------------------------
  // Start trip
  // -------------------------------------------------------------------------
  const handleStart = async () => {
    if (!startForm.vehicle_plate.trim()) {
      toast.error("Vehicle plate is required");
      return;
    }
    setStarting(true);
    try {
      const body: Record<string, unknown> = {
        vehicle_plate: startForm.vehicle_plate.trim(),
        fuel_type:     startForm.fuel_type,
      };
      if (startForm.origin_label.trim())      body.origin_label      = startForm.origin_label.trim();
      if (startForm.destination_label.trim()) body.destination_label = startForm.destination_label.trim();
      if (startForm.cargo_weight_kg)          body.cargo_weight_kg   = parseFloat(startForm.cargo_weight_kg);

      const res = await fetch("/api/trips", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Failed to start trip");
        return;
      }

      toast.success("Trip started — safe travels! 🚛");
      setShowStartForm(false);
      setStartForm({ vehicle_plate: "", origin_label: "", destination_label: "", cargo_weight_kg: "", fuel_type: "diesel" });
      await fetchActiveTrip();
    } finally {
      setStarting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Complete or cancel active trip
  // -------------------------------------------------------------------------
  const handleAction = async (type: "completed" | "cancelled") => {
    if (!trip || trip === "loading") return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { status: type };
      if (type === "completed") {
        if (completeForm.distance_km)      body.distance_km      = parseFloat(completeForm.distance_km);
        if (completeForm.duration_minutes) body.duration_minutes = parseFloat(completeForm.duration_minutes);
        if (completeForm.fuel_liters)      body.fuel_liters      = parseFloat(completeForm.fuel_liters);
      }

      const res = await fetch(`/api/trips/${trip.id}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Failed to update trip");
        return;
      }

      toast.success(type === "completed" ? "Trip completed! Great work. ✅" : "Trip cancelled.");
      setAction(null);
      setCompleteForm({ distance_km: "", duration_minutes: "", fuel_liters: "" });
      setFuelEstimated(false);
      await fetchActiveTrip();
    } finally {
      setSubmitting(false);
    }
  };

  const resetCompleteForm = () => {
    setAction(null);
    setCompleteForm({ distance_km: "", duration_minutes: "", fuel_liters: "" });
    setFuelEstimated(false);
  };

  // -------------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------------
  if (trip === "loading") {
    return (
      <div
        className="rounded-lg border p-5 animate-pulse"
        style={{ background: "var(--surface)", borderColor: "var(--hairline)" }}
      >
        <div className="h-4 w-36 rounded bg-[var(--hairline-2)]" />
        <div className="mt-3 h-3 w-48 rounded bg-[var(--hairline-2)]" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        background:   "var(--surface)",
        borderColor:  trip ? "var(--honey)" : "var(--hairline)",
        boxShadow:    "var(--shadow-sm)",
      }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-sm text-[16px]"
            style={{ background: trip ? "var(--honey-lt)" : "var(--navy-lt)" }}
          >
            🚛
          </div>
          <span
            className="font-display text-[14px] font-semibold tracking-[-0.01em]"
            style={{ color: "var(--ink)" }}
          >
            Active Trip
          </span>
        </div>

        {/* Status badge */}
        {trip ? (
          <span
            className="inline-flex items-center gap-[6px] rounded-[20px] px-[10px] py-[4px] text-[11px] font-semibold"
            style={{ background: "var(--honey-lt)", color: "var(--honey)" }}
          >
            <span className="inline-block h-[5px] w-[5px] rounded-full bg-current animate-live-pulse" />
            On the Job
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-[6px] rounded-[20px] px-[10px] py-[4px] text-[11px] font-semibold"
            style={{ background: "var(--hairline-2)", color: "var(--muted)" }}
          >
            No active trip
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ACTIVE TRIP view                                                    */}
      {/* ------------------------------------------------------------------ */}
      {trip ? (
        <>
          {/* Trip info tiles */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div
              className="rounded-sm px-3 py-2.5"
              style={{ background: "var(--base)", border: "1px solid var(--hairline)" }}
            >
              <p className="text-[11px] mb-0.5" style={{ color: "var(--muted)" }}>Vehicle</p>
              <p className="font-mono text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                {trip.vehiclePlate}
              </p>
            </div>

            {trip.startedAt && (
              <div
                className="rounded-sm px-3 py-2.5"
                style={{ background: "var(--base)", border: "1px solid var(--hairline)" }}
              >
                <p className="text-[11px] mb-0.5" style={{ color: "var(--muted)" }}>Started</p>
                <p className="text-[12px] font-medium" style={{ color: "var(--ink)" }}>
                  {new Date(trip.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )}
          </div>

          {/* Origin → Destination */}
          {(trip.originLabel || trip.destinationLabel) && (
            <div
              className="flex items-center gap-2 mb-4 text-[13px]"
              style={{ color: "var(--ink-2)" }}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted)" }} />
              {trip.originLabel && <span>{trip.originLabel}</span>}
              {trip.originLabel && trip.destinationLabel && (
                <span style={{ color: "var(--muted)" }}>→</span>
              )}
              {trip.destinationLabel && <span>{trip.destinationLabel}</span>}
            </div>
          )}

          {/* ------- Main action buttons (shown when no action is open) ------- */}
          {!action && (
            <div className="flex gap-2">
              <button
                onClick={() => setAction("complete")}
                className="flex-1 flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--sage)" }}
              >
                <CheckCircle className="h-4 w-4" />
                Mark Completed
              </button>
              <button
                onClick={() => setAction("cancel")}
                className="flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--terra-lt)", color: "var(--terra)" }}
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </button>
            </div>
          )}

          {/* ------- Complete confirmation panel ------- */}
          {action === "complete" && (
            <div
              className="border rounded-[10px] p-4"
              style={{ borderColor: "var(--sage)", background: "var(--sage-lt)" }}
            >
              <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--sage)" }}>
                Complete this trip
              </p>
              <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
                Optionally log the final details before completing.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelCls} style={{ color: "var(--muted)" }}>Distance (km)</label>
                  <input
                    type="number" min="0" step="0.1" placeholder="0.0"
                    value={completeForm.distance_km}
                    onChange={(e) => {
                      setFuelEstimated(false);
                      setCompleteForm((p) => ({ ...p, distance_km: e.target.value, fuel_liters: "" }));
                    }}
                    className={inputCls}
                    style={{ borderColor: "var(--hairline)" }}
                  />
                </div>

                <div>
                  <label className={labelCls} style={{ color: "var(--muted)" }}>Duration (min)</label>
                  <input
                    type="number" min="0" step="1" placeholder="0"
                    value={completeForm.duration_minutes}
                    onChange={(e) => setCompleteForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                    className={inputCls}
                    style={{ borderColor: "var(--hairline)" }}
                  />
                </div>

                <div className="col-span-2">
                  <label className={labelCls} style={{ color: "var(--muted)" }}>
                    Fuel consumed (L)
                    {fuelEstimated && (
                      <span
                        className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: "var(--honey-lt)", color: "var(--honey)" }}
                      >
                        ⚡ Estimated
                      </span>
                    )}
                  </label>
                  <input
                    type="number" min="0" step="0.1" placeholder="0.0"
                    value={completeForm.fuel_liters}
                    onChange={(e) => {
                      setFuelEstimated(false);
                      setCompleteForm((p) => ({ ...p, fuel_liters: e.target.value }));
                    }}
                    className={inputCls}
                    style={{ borderColor: fuelEstimated ? "var(--honey)" : "var(--hairline)" }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleAction("completed")}
                  disabled={submitting}
                  className="flex-1 rounded-[10px] py-2 text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ background: "var(--sage)" }}
                >
                  {submitting ? "Saving…" : "Confirm Complete"}
                </button>
                <button
                  onClick={resetCompleteForm}
                  className="rounded-[10px] px-4 py-2 text-[13px] font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* ------- Cancel confirmation panel ------- */}
          {action === "cancel" && (
            <div
              className="border rounded-[10px] p-4"
              style={{ borderColor: "var(--terra)", background: "var(--terra-lt)" }}
            >
              <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--terra)" }}>
                Cancel this trip?
              </p>
              <p className="text-[12px] mb-4" style={{ color: "var(--muted)" }}>
                The trip will be marked as cancelled. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction("cancelled")}
                  disabled={submitting}
                  className="flex-1 rounded-[10px] py-2 text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ background: "var(--terra)" }}
                >
                  {submitting ? "Cancelling…" : "Yes, Cancel Trip"}
                </button>
                <button
                  onClick={() => setAction(null)}
                  className="rounded-[10px] px-4 py-2 text-[13px] font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ---------------------------------------------------------------- */
        /* NO ACTIVE TRIP view                                               */
        /* ---------------------------------------------------------------- */
        <>
          {!showStartForm ? (
            <div className="text-center py-3">
              <p className="text-[13px] mb-1" style={{ color: "var(--ink-2)" }}>
                No trip in progress
              </p>
              <p className="text-[12px] mb-4" style={{ color: "var(--muted)" }}>
                Start a new trip to track your route and fuel here
              </p>
              <button
                onClick={() => setShowStartForm(true)}
                className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--navy)" }}
              >
                <Navigation className="h-3.5 w-3.5" />
                Start a Trip
              </button>
            </div>
          ) : (
            /* Start trip form */
            <div className="mt-1">
              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Vehicle plate — full width */}
                <div className="col-span-2">
                  <label className={labelCls} style={{ color: "var(--muted)" }}>Vehicle plate *</label>
                  <input
                    type="text" placeholder="e.g. 12-TK-34"
                    value={startForm.vehicle_plate}
                    onChange={(e) => setStartForm((p) => ({ ...p, vehicle_plate: e.target.value }))}
                    className={inputCls}
                    style={{ borderColor: "var(--hairline)" }}
                  />
                </div>

                <div>
                  <label className={labelCls} style={{ color: "var(--muted)" }}>Origin</label>
                  <input
                    type="text" placeholder="Departure point"
                    value={startForm.origin_label}
                    onChange={(e) => setStartForm((p) => ({ ...p, origin_label: e.target.value }))}
                    className={inputCls}
                    style={{ borderColor: "var(--hairline)" }}
                  />
                </div>

                <div>
                  <label className={labelCls} style={{ color: "var(--muted)" }}>Destination</label>
                  <input
                    type="text" placeholder="Arrival point"
                    value={startForm.destination_label}
                    onChange={(e) => setStartForm((p) => ({ ...p, destination_label: e.target.value }))}
                    className={inputCls}
                    style={{ borderColor: "var(--hairline)" }}
                  />
                </div>

                <div>
                  <label className={labelCls} style={{ color: "var(--muted)" }}>Cargo weight (kg)</label>
                  <input
                    type="number" min="0" step="1" placeholder="0"
                    value={startForm.cargo_weight_kg}
                    onChange={(e) => setStartForm((p) => ({ ...p, cargo_weight_kg: e.target.value }))}
                    className={inputCls}
                    style={{ borderColor: "var(--hairline)" }}
                  />
                </div>

                <div>
                  <label className={labelCls} style={{ color: "var(--muted)" }}>Fuel type</label>
                  <select
                    value={startForm.fuel_type}
                    onChange={(e) => setStartForm((p) => ({ ...p, fuel_type: e.target.value }))}
                    className={inputCls}
                    style={{ borderColor: "var(--hairline)" }}
                  >
                    {FUEL_TYPES.map((f) => (
                      <option key={f} value={f}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="flex-1 rounded-[10px] py-2.5 text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ background: "var(--navy)" }}
                >
                  {starting ? "Starting…" : "Start Trip"}
                </button>
                <button
                  onClick={() => setShowStartForm(false)}
                  className="rounded-[10px] px-4 py-2 text-[13px] font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
