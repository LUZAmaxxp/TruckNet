"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion }  from "framer-motion";
import { AlertTriangle, X }        from "lucide-react";
import { useSocket }               from "@/hooks/useSocket";
import type { BehaviourEventPayload } from "@/sockets/types";
import { EventTypeBadge }          from "./EventTypeBadge";
import Link                        from "next/link";

const MAX_ALERTS = 50;

const SEVERITY_ACCENT: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#fbbf24",
  low:      "#60a5fa",
};

interface AlertItem extends BehaviourEventPayload {
  receivedAt: number;
}

interface BehaviourAlertBannerProps {
  className?: string;
  maxVisible?: number;
}

export function BehaviourAlertBanner({
  className,
  maxVisible = 8,
}: BehaviourAlertBannerProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const { on } = useSocket();

  useEffect(() => {
    const unsub = on("behaviour_event", (payload) => {
      if (payload.severity !== "high" && payload.severity !== "critical") return;
      setAlerts((prev) => [
        { ...payload, receivedAt: Date.now() },
        ...prev.slice(0, MAX_ALERTS - 1),
      ]);
    });
    return unsub;
  }, [on]);

  const dismiss = (eventId: string) => {
    setAlerts((prev) => prev.filter((a) => a.eventId !== eventId));
  };

  const visible = alerts.slice(0, maxVisible);
  if (!visible.length) return null;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            Alertes comportement en direct
          </span>
          <span className="rounded-full bg-red-100 px-2 text-[11px] font-bold text-red-600">
            {alerts.length}
          </span>
        </div>
        <button
          onClick={() => setAlerts([])}
          className="text-[11px] underline"
          style={{ color: "var(--ink-secondary)" }}
        >
          Tout effacer
        </button>
      </div>

      <div
        className="max-h-72 overflow-y-auto rounded-[10px] flex flex-col gap-1"
        style={{ scrollbarGutter: "stable" }}
      >
        <AnimatePresence initial={false}>
          {visible.map((alert) => (
            <motion.div
              key={alert.eventId}
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{   opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-3 rounded-[8px] px-3 py-2"
              style={{
                background:  "var(--surface)",
                border:      `1px solid ${SEVERITY_ACCENT[alert.severity] ?? "#e5e7eb"}22`,
                borderLeft:  `3px solid ${SEVERITY_ACCENT[alert.severity] ?? "#e5e7eb"}`,
              }}
            >
              {/* Colored dot */}
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ background: SEVERITY_ACCENT[alert.severity] }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/admin/drivers/${alert.driverId}/trips/${alert.tripId}`}
                    className="text-[12px] font-semibold hover:underline truncate"
                    style={{ color: "var(--ink)" }}
                  >
                    {alert.driverName}
                  </Link>
                  <EventTypeBadge type={alert.eventType} severity={alert.severity} />
                </div>
                <p className="text-[11px]" style={{ color: "var(--ink-secondary)" }}>
                  {new Date(alert.occurredAt).toLocaleTimeString("fr-FR")}
                  {alert.score !== null && alert.score !== undefined && (
                    <> · Score {alert.score}</>
                  )}
                </p>
              </div>

              <button
                onClick={() => dismiss(alert.eventId)}
                className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {alerts.length > maxVisible && (
        <p className="mt-1 text-[11px] text-center" style={{ color: "var(--ink-secondary)" }}>
          +{alerts.length - maxVisible} alertes supplémentaires
        </p>
      )}
    </div>
  );
}
