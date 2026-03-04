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
      className={`rounded-xl border p-3 transition-colors ${
        isActive
          ? "border-red-800/60 bg-red-950/30"
          : "border-gray-800 bg-gray-900/50"
      }`}
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
            <div className="h-9 w-9 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-sm font-bold">
              {alert.senderName[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          {isActive && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-red-400" : "text-gray-500"}`} />
            <p className="text-sm font-semibold text-white truncate">{alert.senderName}</p>
            <span className="text-[11px] text-gray-500">@{alert.senderTag}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)} · {formatElapsed(alert.createdAt)}
          </p>

          {/* Actions */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {isActive && (
              <button
                onClick={() => void handleResolve()}
                disabled={resolving}
                className="flex items-center gap-1 rounded-md bg-green-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="h-3 w-3" />
                {resolving ? "Resolving…" : "Resolve"}
              </button>
            )}
            {onViewOnMap && (
              <button
                onClick={() => onViewOnMap(alert.userId)}
                className="flex items-center gap-1 rounded-md bg-gray-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-600 transition-colors"
              >
                <MapPin className="h-3 w-3" />
                View on Map
              </button>
            )}
            {!isActive && (
              <span className="text-[11px] font-medium text-green-500">Resolved</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
