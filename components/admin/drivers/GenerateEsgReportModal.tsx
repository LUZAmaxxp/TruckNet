"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, X, Truck, Fuel, Route, AlertCircle } from "lucide-react";

interface TripStats {
  tripCount: number;
  totalDistanceKm: number;
  totalFuelLiters: number;
  estimatedGhgKgCo2eq: number;
  emptyRunCount: number;
  activeTripsCount: number;
  earliestTripDate: string | null;
}

interface Props {
  drivers: { id: string; name: string }[];
  /** Pre-select a driver; modal is locked to this driver when provided */
  preselectedDriverId?: string;
  /** Pre-fill period dates when triggered from the Trips tab */
  initialPeriodStart?: string;
  initialPeriodEnd?: string;
  onClose: () => void;
  onCreated?: () => void;
}

// ---------------------------------------------------------------------------
// Quick-period helpers
// ---------------------------------------------------------------------------
function periodPresets(today: string): Array<{ label: string; start: string; end: string; type: string }> {
  const d = new Date(today);
  const y = d.getFullYear(), m = d.getMonth();

  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);

  // This month
  const thisMonthStart = fmt(new Date(y, m, 1));
  // Last month
  const lastMonthStart = fmt(new Date(y, m - 1, 1));
  const lastMonthEnd   = fmt(new Date(y, m, 0));
  // Last 3 months
  const q3Start = fmt(new Date(y, m - 2, 1));
  // Last 6 months
  const h1Start = fmt(new Date(y, m - 5, 1));

  return [
    { label: "This month",    start: thisMonthStart, end: today,         type: "monthly"   },
    { label: "Last month",    start: lastMonthStart, end: lastMonthEnd,   type: "monthly"   },
    { label: "Last 3 months", start: q3Start,        end: today,         type: "quarterly" },
    { label: "Last 6 months", start: h1Start,        end: today,         type: "custom"    },
  ];
}

const inputCls =
  "rounded-[10px] border px-3 py-2 text-[13px] bg-transparent outline-none focus:ring-2 focus:ring-[var(--navy)] w-full";

export function GenerateEsgReportModal({
  drivers,
  preselectedDriverId,
  initialPeriodStart,
  initialPeriodEnd,
  onClose,
  onCreated,
}: Props) {
  const today        = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const locked = !!preselectedDriverId;

  const [form, setForm] = useState({
    driver_id:    preselectedDriverId ?? drivers[0]?.id ?? "",
    period_type:  "monthly",
    period_start: initialPeriodStart ?? firstOfMonth,
    period_end:   initialPeriodEnd   ?? today,
    language:     "fr",
  });
  const [generating, setGenerating] = useState(false);
  const [stats, setStats]           = useState<TripStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const presets = periodPresets(today);

  // Fetch trip stats whenever driver + dates change (debounced 400 ms)
  useEffect(() => {
    if (!form.driver_id || !form.period_start || !form.period_end) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setStatsLoading(true);
      try {
        const res = await fetch(
          `/api/drivers/${form.driver_id}/trips/stats?from=${form.period_start}&to=${form.period_end}`
        );
        if (res.ok) {
          const json = await res.json() as TripStats;
          setStats(json);
        } else {
          setStats(null);
        }
      } catch {
        setStats(null);
      } finally {
        setStatsLoading(false);
      }
    }, 400);
  }, [form.driver_id, form.period_start, form.period_end]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stats && stats.tripCount === 0) {
      toast.warning("No completed trips in this period — the report will have no transport data.");
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/drivers/esg-reports", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error((d as { error?: string }).error ?? "Failed to generate report");
        return;
      }
      toast.success("ESG report generated successfully.");
      onCreated?.();
      onClose();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="relative w-full max-w-lg rounded-[16px] p-6 shadow-xl overflow-y-auto max-h-[90dvh]"
        style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4"
          style={{ color: "var(--muted)" }}
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-1 font-display text-[16px] font-bold" style={{ color: "var(--navy)" }}>
          Generate ESG Report
        </h2>
        <p className="mb-4 text-[12px]" style={{ color: "var(--muted)" }}>
          Report is built from the driver's logged trips, shifts, maintenance and training records.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Driver selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Driver</label>
            {locked ? (
              <div
                className="rounded-[10px] border px-3 py-2 text-[13px] font-medium"
                style={{ borderColor: "var(--hairline)", color: "var(--ink)", background: "var(--base)" }}
              >
                {drivers.find((d) => d.id === form.driver_id)?.name ?? form.driver_id.slice(0, 8)}
              </div>
            ) : (
              <select
                value={form.driver_id}
                onChange={(e) => set("driver_id", e.target.value)}
                className={inputCls}
                style={{ borderColor: "var(--hairline)" }}
                required
              >
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Quick period buttons */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Quick period</label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => {
                const active = form.period_start === p.start && form.period_end === p.end;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, period_type: p.type, period_start: p.start, period_end: p.end }))}
                    className="rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-all"
                    style={{
                      background:  active ? "var(--navy)" : "var(--base)",
                      color:       active ? "white" : "var(--muted)",
                      border:      "1px solid var(--hairline)",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Period type + dates */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Period type</label>
              <select
                value={form.period_type}
                onChange={(e) => set("period_type", e.target.value)}
                className={inputCls}
                style={{ borderColor: "var(--hairline)" }}
              >
                {["monthly", "quarterly", "custom"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>From</label>
              <input
                type="date"
                value={form.period_start}
                onChange={(e) => set("period_start", e.target.value)}
                className={inputCls}
                style={{ borderColor: "var(--hairline)" }}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>To</label>
              <input
                type="date"
                value={form.period_end}
                onChange={(e) => set("period_end", e.target.value)}
                className={inputCls}
                style={{ borderColor: "var(--hairline)" }}
                required
              />
            </div>
          </div>

          {/* Trip data preview */}
          <div
            className="rounded-[12px] p-3"
            style={{
              background:  stats?.tripCount === 0 ? "var(--honey-lt)" : "var(--base)",
              border:      `1px solid ${stats?.tripCount === 0 ? "var(--honey)" : "var(--hairline)"}`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Trip data in period
              </span>
              {statsLoading && <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--muted)" }} />}
            </div>

            {stats ? (
              stats.tripCount === 0 ? (
                <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--honey)" }}>
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    No completed trips in this period.
                    {stats.activeTripsCount > 0 && (
                      <span className="ml-1 font-medium">
                        ({stats.activeTripsCount} trip{stats.activeTripsCount > 1 ? "s" : ""} still active)
                      </span>
                    )}
                    {" "}The ESG report will have no transport KPIs.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 sm:grid-cols-4">
                  <div className="flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--navy)" }} />
                    <div>
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>Trips</p>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                        {stats.tripCount}
                        {stats.emptyRunCount > 0 && (
                          <span className="ml-1 text-[10px] font-normal" style={{ color: "var(--muted)" }}>
                            ({stats.emptyRunCount} empty)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Route className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--navy)" }} />
                    <div>
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>Distance</p>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                        {stats.totalDistanceKm.toLocaleString()} km
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Fuel className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--navy)" }} />
                    <div>
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>Fuel</p>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                        {stats.totalFuelLiters.toLocaleString()} L
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] shrink-0">🌱</span>
                    <div>
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>Est. CO₂</p>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                        {stats.estimatedGhgKgCo2eq.toLocaleString()} kg
                      </p>
                    </div>
                  </div>
                </div>
              )
            ) : (
              !statsLoading && (
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                  Select a driver and period to preview trip data.
                </p>
              )
            )}
          </div>

          {/* Language */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Report language</label>
            <select
              value={form.language}
              onChange={(e) => set("language", e.target.value)}
              className={inputCls}
              style={{ borderColor: "var(--hairline)" }}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border px-4 py-2 text-[13px] font-medium"
              style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating}
              className="flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--navy)" }}
            >
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              {generating ? "Generating…" : "Generate Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
