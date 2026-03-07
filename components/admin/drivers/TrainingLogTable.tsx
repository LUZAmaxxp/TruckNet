"use client";

import { Loader2, AlertTriangle } from "lucide-react";
import { addDays } from "date-fns";

interface TrainingRecord {
  id: string;
  trainingType: string;
  title: string;
  provider: string | null;
  completedAt: string;
  durationHours: number | null;
  passed: boolean | null;
  certificationNumber: string | null;
  expiryDate: string | null;
  isMandatory?: boolean | null;
  csrdRelevant?: boolean | null;
}

interface Props {
  records: TrainingRecord[];
  loading?: boolean;
}

function isExpiringSoon(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) <= addDays(new Date(), 90);
}

export function TrainingLogTable({ records, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }
  if (!records.length) {
    return <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>No training records.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
            {["Date", "Type", "Title", "Hours", "Passed", "Cert #", "Expires"].map((h) => (
              <th key={h} className="pb-2 pr-4 font-medium" style={{ color: "var(--muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const expiring = isExpiringSoon(r.expiryDate);
            return (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                <td className="py-2 pr-4">{r.completedAt}</td>
                <td className="py-2 pr-4">{r.trainingType.replace(/_/g, " ")}</td>
                <td className="py-2 pr-4 max-w-[180px] truncate">{r.title}</td>
                <td className="py-2 pr-4">{r.durationHours ?? "—"}</td>
                <td className="py-2 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.passed ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>
                    {r.passed ? "Yes" : "No"}
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-[12px]">{r.certificationNumber ?? "—"}</td>
                <td className="py-2 pr-4">
                  {r.expiryDate ? (
                    <span className={`inline-flex items-center gap-1 ${expiring ? "text-orange-600 font-semibold" : ""}`}>
                      {expiring && <AlertTriangle className="h-3 w-3" />}
                      {r.expiryDate}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
