"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";
import type { SensorAlertDriverPayload } from "@/sockets/types";

const ALERT_MESSAGES: Record<SensorAlertDriverPayload["alertType"], { title: string; body: string }> = {
  vibration_high: {
    title: "⚠️ High Vibration Detected",
    body:  "Your truck is experiencing high vibration. Please slow down and check the road.",
  },
  temp_high: {
    title: "🌡️ Temperature Warning",
    body:  "Cargo temperature is too high. Check refrigeration unit.",
  },
  temp_low: {
    title: "🌡️ Temperature Warning",
    body:  "Cargo temperature is too low. Check refrigeration unit.",
  },
  humidity_high: {
    title: "💧 Humidity Warning",
    body:  "Cargo humidity is too high. Check for moisture.",
  },
};

/**
 * SensorAlertListener
 *
 * Mounts once in the protected layout (driver-side).
 * Listens for `sensor_alert_driver` on the driver's personal Ably channel.
 * Shows a persistent sonner toast + browser notification.
 *
 * Only vibration_high shows the "slow down" action; other alert types
 * show a generic "Dismiss" action.
 */
export function SensorAlertListener() {
  const { on } = useSocket();
  const permissionRef = useRef<NotificationPermission>("default");

  // Request browser notification permission once on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      permissionRef.current = "granted";
      return;
    }
    if (Notification.permission !== "denied") {
      void Notification.requestPermission().then((p) => {
        permissionRef.current = p;
      });
    } else {
      permissionRef.current = "denied";
    }
  }, []);

  useEffect(() => {
    const off = on("sensor_alert_driver", (payload: SensorAlertDriverPayload) => {
      const msg     = ALERT_MESSAGES[payload.alertType];
      const isVib   = payload.alertType === "vibration_high";
      const valStr  = payload.value.toFixed(isVib ? 3 : 1);
      const unit    = isVib ? "G" : payload.alertType.includes("temp") ? "°C" : "%";

      // ── Sonner toast ─────────────────────────────────────────────────────
      toast.warning(msg.title, {
        description: `${msg.body} (${valStr}${unit} — limit ${payload.threshold}${unit})`,
        duration:    isVib ? 15_000 : 10_000,
        action: isVib
          ? { label: "Acknowledged", onClick: () => {} }
          : undefined,
        style: isVib
          ? { borderLeft: "4px solid var(--honey)" }
          : { borderLeft: "4px solid var(--terra)" },
      });

      // ── Browser notification (works when tab is backgrounded) ─────────
      if (permissionRef.current === "granted") {
        const n = new Notification(`TruckNet — ${msg.title}`, {
          body: `${msg.body}\n${valStr}${unit} detected on ${payload.truckLabel}`,
          icon: "/favicon.ico",
          tag:  `sensor-${payload.alertType}`,  // replaces previous of same type
        });
        setTimeout(() => n.close(), isVib ? 15_000 : 10_000);
      }
    });
    return off;
  }, [on]);

  return null;
}
