"use client";

import { Loader2 } from "lucide-react";

interface MaintenanceRecord {
  id: string;
  vehiclePlate: string;
  maintenanceType: string;
  performedAt: string;
  odometerKm: number | null;
  costEur: number | null;
  fuelLiters: number | null;
  fuelType: string | null;
  providerName: string | null;
  regulatoryCompliant: boolean | null;
}

interface Props {
  records: MaintenanceRecord[];
  loading?: boolean;
}

export function MaintenanceLogTable({ records, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }
  if (!records.length) {
    return <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>No maintenance records.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
            {["Date", "Plate", "Type", "Km", "Fuel (L)", "Cost (€)", "Compliant"].map((h) => (
              <th key={h} className="pb-2 pr-4 font-medium" style={{ color: "var(--muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
              <td className="py-2 pr-4">{r.performedAt}</td>
              <td className="py-2 pr-4">{r.vehiclePlate}</td>
              <td className="py-2 pr-4">{r.maintenanceType.replace(/_/g, " ")}</td>
              <td className="py-2 pr-4">{r.odometerKm?.toLocaleString() ?? "—"}</td>
              <td className="py-2 pr-4">{r.fuelLiters ?? "—"}</td>
              <td className="py-2 pr-4">{r.costEur != null ? `€${r.costEur.toFixed(2)}` : "—"}</td>
              <td className="py-2 pr-4">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.regulatoryCompliant ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>
                  {r.regulatoryCompliant ? "Yes" : "No"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
