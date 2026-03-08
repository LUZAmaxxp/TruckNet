"use client";

import { useEffect, useState } from "react";
import Link  from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface DriverRankRow {
  driverId:        string;
  name:            string;
  tag:             string;
  profileImageUrl: string | null;
  avg_score:       number;
  trip_count:      number;
  total_critical:  number;
  trend:           number;
}

interface FleetSafetyRankingProps {
  className?: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-orange-500";
  return "text-red-600";
}

function TrendBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 2) return <span className="text-[11px] text-gray-400">→</span>;
  return delta > 0
    ? <span className="text-[11px] text-green-600">↑ +{delta}</span>
    : <span className="text-[11px] text-red-500">↓ {delta}</span>;
}

const SKELETON = "h-4 rounded animate-pulse bg-gray-100";

export function FleetSafetyRanking({ className }: FleetSafetyRankingProps) {
  const [drivers, setDrivers] = useState<DriverRankRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/behaviour/fleet", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setDrivers(data.drivers ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("Impossible de charger le classement");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <div
      className={cn("rounded-[14px] overflow-hidden", className)}
      style={{
        background: "var(--surface)",
        border:     "1px solid var(--hairline)",
        boxShadow:  "var(--shadow-sm)",
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <h3
          className="font-display text-[14px] font-bold"
          style={{ color: "var(--ink)" }}
        >
          Classement sécurité conducteurs
        </h3>
        <span className="text-[12px]" style={{ color: "var(--ink-secondary)" }}>
          Score moyen ↓
        </span>
      </div>

      {error && (
        <p className="px-5 py-4 text-[13px] text-red-500">{error}</p>
      )}

      {loading && (
        <div className="flex flex-col gap-2 p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={SKELETON} style={{ width: "100%", height: 36 }} />
          ))}
        </div>
      )}

      {!loading && !error && drivers && drivers.length === 0 && (
        <p className="px-5 py-6 text-center text-[13px]" style={{ color: "var(--ink-secondary)" }}>
          Aucune donnée disponible
        </p>
      )}

      {!loading && !error && drivers && drivers.length > 0 && (
        <ol className="divide-y" style={{ "--divider": "var(--hairline)" } as React.CSSProperties}>
          {drivers.map((d, i) => (
            <li key={d.driverId}>
              <Link
                href={`/admin/drivers/${d.driverId}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                {/* Rank */}
                <span
                  className="w-6 shrink-0 text-center text-[12px] font-bold"
                  style={{ color: i < 3 ? "#ef4444" : "var(--ink-secondary)" }}
                >
                  #{i + 1}
                </span>

                {/* Avatar */}
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-100">
                  {d.profileImageUrl ? (
                    <Image
                      src={d.profileImageUrl}
                      alt={d.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[12px] font-bold uppercase text-gray-500">
                      {d.name.charAt(0)}
                    </span>
                  )}
                </div>

                {/* Name + tag */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                    {d.name}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--ink-secondary)" }}>
                    @{d.tag} · {d.trip_count} trajet{d.trip_count !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Score */}
                <div className="text-right shrink-0">
                  <p className={cn("text-[15px] font-bold tabular-nums", scoreColor(d.avg_score))}>
                    {d.avg_score}
                  </p>
                  <TrendBadge delta={d.trend} />
                </div>

                {/* Critical badge */}
                {d.total_critical > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600 shrink-0">
                    {d.total_critical} crit.
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
