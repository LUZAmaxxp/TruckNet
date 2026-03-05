"use client";

import { AlertTriangle } from "lucide-react";
import { useAdminSosStream } from "@/hooks/useAdminSosStream";
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
 * Pushes real-time updates via Kafka → SSE (see /api/admin/sos/stream).
 */
export function SosPanel({ alerts, onResolve, onNewAlert, onViewOnMap }: SosPanelProps) {
  // Connect to the Kafka-backed SSE stream; new alerts are forwarded to the
  // parent via the onNewAlert callback (prepend + stats refresh live there).
  useAdminSosStream(onNewAlert);

  return (
    <div
      className="flex h-full flex-col rounded-[12px]"
      style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <AlertTriangle className="h-4 w-4" style={{ color: "var(--terra)" }} />
        <h2 className="font-display text-[13px] font-bold" style={{ color: "var(--ink)" }}>Active SOS Alerts</h2>
        {alerts.length > 0 && (
          <span
            className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-[10px] px-[6px] font-mono text-[10px] font-bold animate-sos-beat"
            style={{ background: "var(--terra)", color: "white" }}
          >
            {alerts.length}
          </span>
        )}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <AlertTriangle className="h-8 w-8 mb-2 opacity-30" style={{ color: "var(--muted)" }} />
            <p className="font-body text-[13px]" style={{ color: "var(--muted)" }}>No active SOS alerts</p>
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
