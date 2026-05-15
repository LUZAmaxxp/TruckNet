"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Thermometer, Droplets, X } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import type { SensorAlertDriverPayload } from "@/sockets/types";

interface ActiveAlert {
  id:          string;
  alertType:   SensorAlertDriverPayload["alertType"];
  value:       number;
  threshold:   number;
  triggeredAt: string;
  truckLabel:  string;
  deviceId:    string;
}

const ALERT_CONFIG: Record<
  ActiveAlert["alertType"],
  { icon: React.ElementType; label: string; unit: string; color: string; bg: string }
> = {
  vibration_high: {
    icon:  AlertTriangle,
    label: "High Vibration — Please slow down",
    unit:  "G",
    color: "text-amber-700",
    bg:    "bg-amber-50 border-amber-400",
  },
  temp_high: {
    icon:  Thermometer,
    label: "High Temperature — Check refrigeration",
    unit:  "°C",
    color: "text-red-700",
    bg:    "bg-red-50 border-red-400",
  },
  temp_low: {
    icon:  Thermometer,
    label: "Low Temperature — Check refrigeration",
    unit:  "°C",
    color: "text-blue-700",
    bg:    "bg-blue-50 border-blue-400",
  },
  humidity_high: {
    icon:  Droplets,
    label: "High Humidity — Check cargo",
    unit:  "%",
    color: "text-teal-700",
    bg:    "bg-teal-50 border-teal-400",
  },
};

/**
 * DriverAlertBanner
 *
 * Persistent alert notice shown on the driver dashboard.
 * - Fetches active sensor_alerts for the driver's device on mount.
 * - Listens for real-time `sensor_alert_driver` events to immediately add new alerts.
 * - Driver can dismiss (locally hide) an alert — it re-appears on next page load
 *   until it is acknowledged by an admin.
 */
export function DriverAlertBanner() {
  const { on } = useSocket();
  const [alerts, setAlerts]       = useState<ActiveAlert[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/drivers/my-alerts");
      if (!res.ok) return;
      const { alerts: data } = (await res.json()) as { alerts: ActiveAlert[] };
      setAlerts(data);
    } catch {
      // non-critical — fail silently
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  // Real-time updates
  useEffect(() => {
    return on("sensor_alert_driver", (payload: SensorAlertDriverPayload) => {
      setAlerts((prev) => {
        // Update existing alert of same type, or prepend new
        const idx = prev.findIndex((a) => a.alertType === payload.alertType);
        const updated: ActiveAlert = {
          id:          payload.alertId,
          alertType:   payload.alertType,
          value:       payload.value,
          threshold:   payload.threshold,
          triggeredAt: payload.triggeredAt,
          truckLabel:  payload.truckLabel,
          deviceId:    payload.deviceId,
        };
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        }
        return [updated, ...prev];
      });
      // Un-dismiss if it was hidden before (so re-published alerts re-appear)
      setDismissed((d) => d.filter((t) => t !== payload.alertType));
    });
  }, [on]);

  const visibleAlerts = alerts.filter((a) => !dismissed.includes(a.alertType));
  if (visibleAlerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-4">
      {visibleAlerts.map((alert) => {
        const cfg    = ALERT_CONFIG[alert.alertType];
        const Icon   = cfg.icon;
        const isVib  = alert.alertType === "vibration_high";
        const valStr = alert.value.toFixed(isVib ? 3 : 1);

        return (
          <div
            key={alert.alertType}
            className={`flex items-start gap-3 rounded-lg border-l-4 px-4 py-3 ${cfg.bg}`}
            role="alert"
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cfg.color}`} />
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {alert.truckLabel} — current {valStr}{cfg.unit} (limit {alert.threshold}{cfg.unit})
              </p>
            </div>
            <button
              onClick={() =>
                setDismissed((d) => d.includes(alert.alertType) ? d : [...d, alert.alertType])
              }
              className="shrink-0 rounded p-1 hover:bg-black/10 transition-colors"
              aria-label="Dismiss alert"
            >
              <X className={`h-4 w-4 ${cfg.color}`} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
