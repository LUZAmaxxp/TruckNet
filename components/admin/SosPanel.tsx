"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { SosAlertCard } from "@/components/admin/SosAlertCard";
import type { SosAdminEntry } from "@/app/(admin)/admin/page";

interface SosPanelProps {
  alerts: SosAdminEntry[];
  onResolve: (id: string) => Promise<void>;
  onNewAlert: (alert: SosAdminEntry) => void;
  onViewOnMap?: (driverId: string) => void;
}

/**
 * SosPanel — right sidebar panel on admin home showing active SOS alerts.
 * Subscribes to stress:alerts Ably channel and prepends new alerts in real-time.
 */
export function SosPanel({ alerts, onResolve, onNewAlert, onViewOnMap }: SosPanelProps) {
  const { on } = useSocket();

  useEffect(() => {
    const handler = (payload: unknown) => {
      const p = payload as {
        signalId?: string;
        userId?: string;
        senderName?: string;
        senderTag?: string;
        senderAvatar?: string | null;
        latitude?: number;
        longitude?: number;
        timestamp?: string;
      };
      if (!p.signalId || !p.userId) return;

      const newAlert: SosAdminEntry = {
        id: p.signalId,
        userId: p.userId,
        senderName: p.senderName ?? "Unknown",
        senderTag: p.senderTag ?? "",
        senderAvatar: p.senderAvatar ?? null,
        latitude: p.latitude ?? 0,
        longitude: p.longitude ?? 0,
        status: "active",
        createdAt: p.timestamp ?? new Date().toISOString(),
      };
      onNewAlert(newAlert);
    };

    const unsub = on("stress_signal_alert", handler);
    return unsub;
  }, [on, onNewAlert]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-800 bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <h2 className="text-sm font-semibold text-white">Active SOS Alerts</h2>
        {alerts.length > 0 && (
          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {alerts.length}
          </span>
        )}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500">
            <AlertTriangle className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No active SOS alerts</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <SosAlertCard
              key={alert.id}
              alert={alert}
              onResolve={async (id) => onResolve(id)}
              onViewOnMap={onViewOnMap}
            />
          ))
        )}
      </div>
    </div>
  );
}
