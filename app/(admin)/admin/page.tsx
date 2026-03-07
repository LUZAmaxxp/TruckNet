"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { StatsBar } from "@/components/admin/StatsBar";
const FleetMap = dynamic(
  () => import("@/components/admin/FleetMap").then((m) => m.FleetMap),
  { ssr: false }
);
import { SosPanel } from "@/components/admin/SosPanel";
import { EsgDashboardWidgets } from "@/components/admin/drivers/EsgDashboardWidgets";

export type AdminStats = {
  totalDrivers: number;
  onlineDrivers: number;
  activeSosAlerts: number;
  ongoingCalls: number;
  totalCallsToday: number;
  totalMessagesToday: number;
  sensorAlertCount?: number;
};

export type LiveDriverEntry = {
  id: string;
  name: string;
  profileImageUrl: string | null;
  latitude: number;
  longitude: number;
  updatedAt: string;
};

export type SosAdminEntry = {
  id: string;
  userId: string;
  senderName: string;
  senderTag: string;
  senderAvatar: string | null;
  latitude: number;
  longitude: number;
  status: "active" | "resolved";
  createdAt: string;
};

/**
 * /admin — Admin dashboard home page.
 * Sections: StatsBar | FleetMap | SosPanelSidebar
 */
export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [liveDrivers, setLiveDrivers] = useState<LiveDriverEntry[]>([]);
  const [sosAlerts, setSosAlerts] = useState<SosAdminEntry[]>([]);
  const [focusDriverId, setFocusDriverId] = useState<string | null>(null);
  const [activeRoutesSummary, setActiveRoutesSummary] = useState<{ driverId: string }[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) setStats(await res.json());
    } catch {
      // silent — stats are non-critical
    }
  }, []);

  const fetchLiveDrivers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/drivers/live");
      if (res.ok) {
        const data = await res.json();
        setLiveDrivers(data.drivers ?? []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchSosAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sos?status=active&limit=50");
      if (res.ok) {
        const data = await res.json();
        setSosAlerts(data.alerts ?? []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchActiveRoutes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/routes/active");
      if (res.ok) {
        const json = await res.json();
        const routes = (json.routes ?? []) as { driverId: string }[];
        setActiveRoutesSummary(routes.map((r) => ({ driverId: r.driverId })));
      }
    } catch {
      // silent
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchStats();
    void fetchLiveDrivers();
    void fetchSosAlerts();
    void fetchActiveRoutes();
  }, [fetchStats, fetchLiveDrivers, fetchSosAlerts, fetchActiveRoutes]);

  // Stats auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => void fetchStats(), 30_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/admin/sos/${alertId}/resolve`, {
        method: "PATCH",
      });
      if (res.ok) {
        setSosAlerts((prev) => prev.filter((a) => a.id !== alertId));
        void fetchStats();
      }
    } catch {
      // silent
    }
  };

  const handleNewSosAlert = useCallback((alert: SosAdminEntry) => {
    setSosAlerts((prev) => [alert, ...prev]);
    void fetchStats();
  }, [fetchStats]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Stats bar */}
      <StatsBar stats={stats} />

      {/* Main content: map + SOS sidebar */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
        <div className="flex-1 overflow-hidden" style={{ borderRadius: 12, border: "1px solid var(--hairline)" }}>
          <FleetMap
            initialDrivers={liveDrivers}
            focusDriverId={focusDriverId}
            activeRoutesSummary={activeRoutesSummary}
          />
        </div>
        <div className="w-80 shrink-0 overflow-y-auto">
          <SosPanel
            alerts={sosAlerts}
            onResolve={handleResolveAlert}
            onNewAlert={handleNewSosAlert}
            onViewOnMap={(driverId) => setFocusDriverId(driverId)}
          />
        </div>
      </div>

      {/* ESG dashboard widgets */}
      <EsgDashboardWidgets />
    </div>
  );
}
