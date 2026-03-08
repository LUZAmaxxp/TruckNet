"use client";

import { useEffect, useState } from "react";
import { Shield, AlertTriangle, ClipboardCheck, Gauge } from "lucide-react";
import { BehaviourAlertBanner }  from "@/components/admin/behaviour/BehaviourAlertBanner";
import { FleetSafetyRanking }    from "@/components/admin/behaviour/FleetSafetyRanking";
import Link                      from "next/link";

interface FleetStats {
  fleet_avg_score:       number | null;
  critical_events_today: number;
  unreviewed_reports:    number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  loading,
}: {
  icon:    React.ElementType;
  label:   string;
  value:   React.ReactNode;
  accent:  string;
  loading: boolean;
}) {
  return (
    <div
      className="flex flex-1 items-center gap-3 rounded-[12px] px-4 py-3"
      style={{
        background: "var(--surface)",
        border:     "1px solid var(--hairline)",
        boxShadow:  "var(--shadow-sm)",
      }}
    >
      <div className="rounded-[8px] p-2 shrink-0" style={{ background: accent + "20", color: accent }}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        {loading ? (
          <div className="h-5 w-14 rounded animate-pulse" style={{ background: "var(--hairline-2)" }} />
        ) : (
          <p className="font-display text-[20px] font-bold tracking-[-0.03em]" style={{ color: "var(--ink)" }}>
            {value}
          </p>
        )}
        <p className="text-[11px]" style={{ color: "var(--ink-secondary)" }}>{label}</p>
      </div>
    </div>
  );
}

/**
 * /admin/behaviour — Fleet safety dashboard
 * Shows live alerts, fleet stats, and driver ranking by average score.
 */
export default function BehaviourDashboardPage() {
  const [stats,   setStats]   = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/behaviour/fleet")
      .then((r) => r.json())
      .then((d) => {
        setStats({
          fleet_avg_score:       d.fleet_avg_score,
          critical_events_today: d.critical_events_today ?? 0,
          unreviewed_reports:    d.unreviewed_reports ?? 0,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <h1
            className="font-display text-[22px] font-bold tracking-[-0.04em]"
            style={{ color: "var(--ink)" }}
          >
            Comportement &amp; Sécurité
          </h1>
        </div>
        <Link
          href="/admin/behaviour/config"
          className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-gray-50"
          style={{ borderColor: "var(--hairline)", color: "var(--ink-secondary)" }}
        >
          ⚙️ Configuration
        </Link>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        <StatCard
          icon={Gauge}
          label="Score moyen flotte"
          value={stats?.fleet_avg_score ?? "—"}
          accent="#3b82f6"
          loading={loading}
        />
        <StatCard
          icon={AlertTriangle}
          label="Événements critiques (aujourd'hui)"
          value={stats?.critical_events_today ?? 0}
          accent="#ef4444"
          loading={loading}
        />
        <StatCard
          icon={ClipboardCheck}
          label="Rapports non vérifiés"
          value={stats?.unreviewed_reports ?? 0}
          accent="#f97316"
          loading={loading}
        />
      </div>

      {/* Live alert banner */}
      <BehaviourAlertBanner />

      {/* Fleet ranking */}
      <FleetSafetyRanking />
    </div>
  );
}
