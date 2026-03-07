"use client";

import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface Trip {
  id: string;
  vehiclePlate: string;
  originLabel: string | null;
  destinationLabel: string | null;
  startedAt: string | null;
  completedAt: string | null;
  distanceKm: number | null;
  fuelLiters: number | null;
  fuelType: string | null;
  cargoWeightKg: number | null;
  loadFactorPct: number | null;
  isEmptyRun: boolean;
  status: string;
}

interface Props {
  driverId: string;
  trips: Trip[];
  onDeleted?: () => void;
}

const GHG_FACTORS: Record<string, number> = {
  diesel: 2.65, petrol: 2.37, lpg: 1.63, cng: 2.30, electric: 0, hydrogen: 0, other: 2.65,
};

function calcCo2(trip: Trip): string {
  if (!trip.fuelLiters) return "—";
  const factor = GHG_FACTORS[trip.fuelType ?? "diesel"] ?? 2.65;
  return (trip.fuelLiters * factor).toFixed(1) + " kg";
}

function fmt(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

export function TripLogTable({ driverId, trips, onDeleted }: Props) {
  const handleDelete = async (tripId: string) => {
    if (!confirm("Delete this trip?")) return;
    const res = await fetch(`/api/drivers/${driverId}/trips/${tripId}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete trip"); return; }
    toast.success("Trip deleted");
    onDeleted?.();
  };

  if (trips.length === 0) {
    return (
      <p className="text-center py-8 text-[13px]" style={{ color: "var(--muted)" }}>
        No trips logged yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[12px] border" style={{ borderColor: "var(--hairline)" }}>
      <table className="w-full text-[13px]">
        <thead>
          <tr style={{ background: "var(--panel)", borderBottom: "1px solid var(--hairline)" }}>
            {["Date", "Plate", "Route", "Dist (km)", "Fuel (L)", "CO₂", "Load %", "Empty?", ""].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wide"
                style={{ color: "var(--muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trips.map((t) => (
            <tr key={t.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
              <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--slate)" }}>{fmt(t.startedAt)}</td>
              <td className="px-3 py-2 font-mono text-[12px]" style={{ color: "var(--ink)" }}>{t.vehiclePlate}</td>
              <td className="px-3 py-2 max-w-[180px]" style={{ color: "var(--ink)" }}>
                <span className="block truncate">
                  {t.originLabel && t.destinationLabel
                    ? `${t.originLabel} → ${t.destinationLabel}`
                    : t.originLabel ?? t.destinationLabel ?? "—"}
                </span>
              </td>
              <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                {t.distanceKm != null ? t.distanceKm.toFixed(1) : "—"}
              </td>
              <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                {t.fuelLiters != null ? t.fuelLiters.toFixed(1) : "—"}
                {t.fuelType ? <span className="ml-1 text-[11px]" style={{ color: "var(--muted)" }}>({t.fuelType})</span> : null}
              </td>
              <td className="px-3 py-2 text-right font-medium" style={{ color: "var(--sage)" }}>
                {calcCo2(t)}
              </td>
              <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                {t.loadFactorPct != null ? `${t.loadFactorPct.toFixed(0)}%` : "—"}
              </td>
              <td className="px-3 py-2 text-center">
                {t.isEmptyRun
                  ? <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: "var(--honey-lt)", color: "var(--honey)" }}>Yes</span>
                  : <span className="text-[11px]" style={{ color: "var(--muted)" }}>No</span>}
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => void handleDelete(t.id)} title="Delete"
                  className="rounded-[6px] p-1 transition-colors"
                  style={{ color: "var(--muted)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--rose)"; e.currentTarget.style.background = "var(--rose-lt)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = "transparent"; }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
