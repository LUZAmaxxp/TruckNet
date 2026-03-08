"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, ClipboardCheck } from "lucide-react";
import Link  from "next/link";
import { DriveScoreGauge } from "@/components/admin/behaviour/DriveScoreGauge";
import { useSocket } from "@/hooks/useSocket";
import type { BehaviourEventPayload } from "@/sockets/types";

interface FleetStats {
  fleet_avg_score:       number | null;
  critical_events_today: number;
  unreviewed_reports:    number;
}

/**
 * Compact widget for the admin dashboard home page.
 * Shows fleet avg score gauge + today's criticals + unreviewed reports.
 * Live-updates its critical count via Ably behaviour_event.
 */
export function BehaviourDashboardWidget() {
  const [stats,   setStats]   = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { on } = useSocket();

  useEffect(() => {
    fetch("/api/admin/behaviour/fleet")
      .then((r) => r.json())
      .then((d) => {
        setStats({
          fleet_avg_score:       d.fleet_avg_score ?? null,
          critical_events_today: d.critical_events_today ?? 0,
          unreviewed_reports:    d.unreviewed_reports ?? 0,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Increment critical count on live events
  useEffect(() => {
    const unsub = on("behaviour_event", (p: BehaviourEventPayload) => {
      if (p.severity === "critical") {
        setStats((prev) =>
          prev ? { ...prev, critical_events_today: prev.critical_events_today + 1 } : prev
        );
      }
    });
    return unsub;
  }, [on]);

  return (
    <div
      className="rounded-[14px] p-4 flex flex-col gap-3"
      style={{
        background: "var(--surface)",
        border:     "1px solid var(--hairline)",
        boxShadow:  "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <p
            className="text-[13px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Sécurité conducteurs
          </p>
        </div>
        <Link
          href="/admin/behaviour"
          className="text-[11px] underline"
          style={{ color: "var(--ink-secondary)" }}
        >
          Voir tout →
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-20">
          <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {/* Gauge */}
          <DriveScoreGauge
            score={stats?.fleet_avg_score ?? null}
            size={80}
            strokeWidth={7}
            label="Moyenne"
          />

          {/* Stats */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <p className="text-[12px]" style={{ color: "var(--ink)" }}>
                <span className="font-bold">{stats?.critical_events_today ?? 0}</span>{" "}
                <span style={{ color: "var(--ink-secondary)" }}>critique{(stats?.critical_events_today ?? 0) !== 1 ? "s" : ""} aujourd&apos;hui</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-3.5 w-3.5 text-orange-500 shrink-0" />
              <p className="text-[12px]" style={{ color: "var(--ink)" }}>
                <span className="font-bold">{stats?.unreviewed_reports ?? 0}</span>{" "}
                <span style={{ color: "var(--ink-secondary)" }}>rapport{(stats?.unreviewed_reports ?? 0) !== 1 ? "s" : ""} à vérifier</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
