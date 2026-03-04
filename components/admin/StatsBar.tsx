"use client";

import { Users, Wifi, AlertTriangle, PhoneCall, MessageSquare, PhoneMissed } from "lucide-react";
import type { AdminStats } from "@/app/(admin)/admin/page";

const SKELETON = "h-4 w-20 rounded animate-pulse" ;

function StatCard({
  label,
  value,
  icon: Icon,
  accentColor,
  loading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  accentColor: string;
  loading: boolean;
}) {
  return (
    <div
      className="flex flex-1 items-center gap-3 rounded-[12px] px-4 py-3 transition-shadow duration-200 hover:shadow-md"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="rounded-[8px] p-2 shrink-0"
        style={{ background: accentColor + "20", color: accentColor }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        {loading || value === undefined ? (
          <div className={SKELETON} style={{ background: "var(--hairline-2)" }} />
        ) : (
          <p className="font-display text-[20px] font-bold tracking-[-0.03em]" style={{ color: "var(--ink)" }}>
            {value.toLocaleString()}
          </p>
        )}
        <p className="font-body text-[11px] mt-0.5" style={{ color: "var(--subtle)" }}>{label}</p>
      </div>
    </div>
  );
}

interface StatsBarProps {
  stats: AdminStats | null;
}

/**
 * StatsBar — horizontal row of fleet stat cards.
 * Shows skeleton while data is loading.
 */
export function StatsBar({ stats }: StatsBarProps) {
  const loading = stats === null;

  return (
    <div className="flex gap-3 flex-wrap">
      <StatCard label="Total Drivers" value={stats?.totalDrivers} icon={Users} accentColor="var(--navy)" loading={loading} />
      <StatCard label="Online Now" value={stats?.onlineDrivers} icon={Wifi} accentColor="var(--sage)" loading={loading} />
      <StatCard label="Active SOS" value={stats?.activeSosAlerts} icon={AlertTriangle} accentColor="var(--terra)" loading={loading} />
      <StatCard label="Ongoing Calls" value={stats?.ongoingCalls} icon={PhoneCall} accentColor="var(--slate)" loading={loading} />
      <StatCard label="Calls Today" value={stats?.totalCallsToday} icon={PhoneMissed} accentColor="var(--honey)" loading={loading} />
      <StatCard label="Messages Today" value={stats?.totalMessagesToday} icon={MessageSquare} accentColor="var(--slate)" loading={loading} />
    </div>
  );
}
