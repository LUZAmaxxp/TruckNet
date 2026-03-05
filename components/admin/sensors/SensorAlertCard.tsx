"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export interface SensorAlertRow {
  id:          string;
  deviceId:    string;
  driverId:    string | null;
  alertType:   "temp_high" | "temp_low" | "humidity_high" | "vibration_high";
  value:       number;
  threshold:   number;
  status:      "active" | "acknowledged";
  triggeredAt: string;
  truckLabel:  string | null;
}

interface SensorAlertCardProps {
  alert:         SensorAlertRow;
  onAcknowledge: (id: string) => void;
}

const ALERT_LABELS: Record<SensorAlertRow["alertType"], string> = {
  temp_high:       "🌡️ Temperature High",
  temp_low:        "🌡️ Temperature Low",
  humidity_high:   "💧 Humidity High",
  vibration_high:  "📳 Vibration High",
};

const ALERT_UNITS: Record<SensorAlertRow["alertType"], string> = {
  temp_high:       "°C",
  temp_low:        "°C",
  humidity_high:   "%",
  vibration_high:  "G",
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SensorAlertCard({ alert, onAcknowledge }: SensorAlertCardProps) {
  const [acking, setAcking] = useState(false);
  const unit = ALERT_UNITS[alert.alertType];

  const handleAcknowledge = async () => {
    setAcking(true);
    onAcknowledge(alert.id); // optimistic remove
    try {
      await fetch(`/api/admin/sensors/alerts/${alert.id}/acknowledge`, {
        method: "PATCH",
      });
    } catch {
      // silent — optimistic already applied
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl p-3"
      style={{
        background: "var(--terra-lt)",
        border: "1px solid rgba(184,80,57,0.15)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full shrink-0 animate-sos-beat"
          style={{ background: "var(--terra)" }}
        />
        <span
          className="font-body text-[13px] font-semibold flex-1 truncate"
          style={{ color: "var(--ink)" }}
        >
          {alert.truckLabel ?? alert.deviceId}
        </span>
        <span className="font-mono text-[10px] shrink-0" style={{ color: "var(--muted)" }}>
          {formatTimeAgo(alert.triggeredAt)}
        </span>
      </div>

      {/* Alert type */}
      <p className="font-body text-[12px] mt-1" style={{ color: "var(--ink)" }}>
        {ALERT_LABELS[alert.alertType]}
      </p>

      {/* Value vs threshold */}
      <p className="font-mono text-[13px] mt-0.5 font-semibold" style={{ color: "var(--terra)" }}>
        {alert.value.toFixed(1)}{unit} &gt; {alert.threshold.toFixed(1)}{unit} limit
      </p>

      {/* Acknowledge button */}
      <button
        onClick={() => void handleAcknowledge()}
        disabled={acking}
        className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-[8px] py-1.5 font-body text-[12px] font-semibold transition-colors disabled:opacity-50"
        style={{ background: "var(--base)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
      >
        {acking && <Loader2 className="h-3 w-3 animate-spin" />}
        Acknowledge
      </button>
    </motion.div>
  );
}
