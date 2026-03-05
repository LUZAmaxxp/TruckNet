"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Thermometer } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { toast } from "sonner";
import { SensorAlertCard, type SensorAlertRow } from "@/components/admin/sensors/SensorAlertCard";

interface SensorAlertPanelProps {
  deviceId?: string;
}

export function SensorAlertPanel({ deviceId }: SensorAlertPanelProps) {
  const [alerts, setAlerts] = useState<SensorAlertRow[]>([]);
  const { on } = useSocket();

  const fetchAlerts = useCallback(async () => {
    try {
      const url = new URL("/api/admin/sensors/alerts", window.location.origin);
      url.searchParams.set("status", "active");
      if (deviceId) url.searchParams.set("deviceId", deviceId);
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json() as { alerts?: SensorAlertRow[] };
        setAlerts(data.alerts ?? []);
      }
    } catch {
      // silent
    }
  }, [deviceId]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  // Ably real-time subscriptions
  useEffect(() => {
    const unsubAlert = on("sensor_alert", (p) => {
      if (deviceId && p.deviceId !== deviceId) return;

      const newAlert: SensorAlertRow = {
        id:          p.alertId,
        deviceId:    p.deviceId,
        driverId:    null,
        alertType:   p.alertType,
        value:       p.value,
        threshold:   p.threshold,
        status:      "active",
        triggeredAt: p.triggeredAt,
        truckLabel:  p.truckLabel,
      };

      setAlerts((prev) => [newAlert, ...prev]);
      toast.error(`Sensor alert: ${p.truckLabel}`, {
        description: `${p.alertType.replace("_", " ")} — ${p.value.toFixed(1)}`,
      });
    });

    const unsubAck = on("sensor_alert_acked", (p) => {
      setAlerts((prev) => prev.filter((a) => a.id !== p.alertId));
    });

    return () => {
      unsubAlert();
      unsubAck();
    };
  }, [on, deviceId]);

  const handleAcknowledge = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      className="flex h-full flex-col rounded-[12px]"
      style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <Thermometer className="h-4 w-4" style={{ color: "var(--terra)" }} />
        <h2 className="font-display text-[13px] font-bold" style={{ color: "var(--ink)" }}>
          Sensor Alerts
        </h2>
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
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-3xl mb-2">🛡️</span>
            <p
              className="font-body text-[13px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              No active sensor alerts
            </p>
            <p className="font-body text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
              All cargo conditions within normal limits
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {alerts.map((alert) => (
              <SensorAlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
