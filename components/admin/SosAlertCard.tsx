"use client";

import { AlertTriangle, MapPin, CheckCircle } from "lucide-react";
import { useState } from "react";
import type { SosAdminEntry } from "@/app/(admin)/admin/page";

function formatElapsed(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface SosAlertCardProps {
  alert: SosAdminEntry;
  onResolve: (id: string) => Promise<void>;
  onViewOnMap?: (driverId: string) => void;
}

/**
 * SosAlertCard — individual SOS alert card used in SosPanel and /admin/sos.
 */
export function SosAlertCard({ alert, onResolve, onViewOnMap }: SosAlertCardProps) {
  const [resolving, setResolving] = useState(false);
  const isActive = alert.status === "active";

  const handleResolve = async () => {
    setResolving(true);
    try {
      await onResolve(alert.id);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      className="rounded-[12px] p-3 transition-colors"
      style={{
        border: isActive ? "1px solid rgba(184,80,57,0.3)" : "1px solid var(--hairline)",
        background: isActive
          ? "linear-gradient(145deg, var(--terra-lt), var(--surface))"
          : "var(--base)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar / icon */}
        <div className="relative shrink-0">
          {alert.senderAvatar ? (
            <img
              src={alert.senderAvatar}
              alt={alert.senderName}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center font-display text-[13px] font-bold"
              style={{ background: "var(--navy-lt)", color: "var(--navy)" }}
            >
              {alert.senderName[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          {isActive && (
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full animate-sos-beat" style={{ background: "var(--terra)" }} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <AlertTriangle
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: isActive ? "var(--terra)" : "var(--muted)" }}
            />
            <p className="font-body text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>{alert.senderName}</p>
            <span className="font-mono text-[10px]" style={{ color: "var(--subtle)" }}>@{alert.senderTag}</span>
          </div>
          <p className="font-mono text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
            {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)} · {formatElapsed(alert.createdAt)}
          </p>

          {/* Actions */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {isActive && (
              <button
                onClick={() => void handleResolve()}
                disabled={resolving}
                className="flex items-center gap-1 rounded-[8px] px-2.5 py-1 font-body text-[12px] font-semibold transition-colors disabled:opacity-50"
                style={{ background: "var(--sage)", color: "white" }}
              >
                <CheckCircle className="h-3 w-3" />
                {resolving ? "Resolving…" : "Resolve"}
              </button>
            )}
            {onViewOnMap && (
              <button
                onClick={() => onViewOnMap(alert.userId)}
                className="flex items-center gap-1 rounded-[8px] px-2.5 py-1 font-body text-[12px] font-semibold transition-colors"
                style={{ background: "var(--base)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
              >
                <MapPin className="h-3 w-3" />
                View on Map
              </button>
            )}
            {!isActive && (
              <span className="font-body text-[11px] font-semibold" style={{ color: "var(--sage)" }}>Resolved</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
