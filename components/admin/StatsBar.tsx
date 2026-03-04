"use client";

import { Users, Wifi, AlertTriangle, PhoneCall, MessageSquare, PhoneMissed } from "lucide-react";
import type { AdminStats } from "@/app/(admin)/admin/page";

const SKELETON = "h-4 w-20 rounded bg-gray-700 animate-pulse";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
      <div className={`rounded-lg p-2 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        {loading || value === undefined ? (
          <div className={SKELETON} />
        ) : (
          <p className="text-xl font-bold text-white">{value.toLocaleString()}</p>
        )}
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
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
      <StatCard label="Total Drivers" value={stats?.totalDrivers} icon={Users} color="bg-blue-600/20 text-blue-400" loading={loading} />
      <StatCard label="Online Now" value={stats?.onlineDrivers} icon={Wifi} color="bg-green-600/20 text-green-400" loading={loading} />
      <StatCard label="Active SOS" value={stats?.activeSosAlerts} icon={AlertTriangle} color="bg-red-600/20 text-red-400" loading={loading} />
      <StatCard label="Ongoing Calls" value={stats?.ongoingCalls} icon={PhoneCall} color="bg-purple-600/20 text-purple-400" loading={loading} />
      <StatCard label="Calls Today" value={stats?.totalCallsToday} icon={PhoneMissed} color="bg-yellow-600/20 text-yellow-400" loading={loading} />
      <StatCard label="Messages Today" value={stats?.totalMessagesToday} icon={MessageSquare} color="bg-cyan-600/20 text-cyan-400" loading={loading} />
    </div>
  );
}
