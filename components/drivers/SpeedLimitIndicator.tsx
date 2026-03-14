"use client";

import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import type { SpeedLimitUpdatePayload } from "@/sockets/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Show a stale indicator when no update has arrived within this window (ms). */
const STALE_THRESHOLD_MS = 90_000; // 90 s

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SpeedLimitIndicator
 *
 * Renders a road-sign–style badge that shows the current road speed limit and
 * highlights when the driver is exceeding it.
 *
 * Gated by the NEXT_PUBLIC_FEATURE_SPEED_LIMIT_DISPLAY env flag — returns null
 * while the flag is "false" so it can be toggled without a code deploy.
 *
 * Listens to the "speed_limit_update" Ably event on the driver's private
 * user:{userId} channel (wired in hooks/useSocket.ts).
 */
export function SpeedLimitIndicator() {
  // Feature-gate: return nothing when the flag is off
  if (process.env.NEXT_PUBLIC_FEATURE_SPEED_LIMIT_DISPLAY !== "true") {
    return null;
  }

  return <SpeedLimitIndicatorInner />;
}

function SpeedLimitIndicatorInner() {
  const { on } = useSocket();
  const [payload, setPayload] = useState<SpeedLimitUpdatePayload | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const [isStale, setIsStale] = useState(false);

  // Subscribe to speed_limit_update events
  useEffect(() => {
    const unsub = on("speed_limit_update", (p) => {
      setPayload(p);
      lastUpdateRef.current = Date.now();
      setIsStale(false);
    });
    return unsub;
  }, [on]);

  // Poll every 10 s to detect stale state
  useEffect(() => {
    const id = setInterval(() => {
      if (lastUpdateRef.current > 0) {
        setIsStale(Date.now() - lastUpdateRef.current > STALE_THRESHOLD_MS);
      }
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  // ── Derive visual state ──────────────────────────────────────────────────
  const limitKmh      = payload?.speedLimitKmh ?? null;
  const isOverSpeeding = payload?.isOverSpeeding ?? false;

  const unknownState = limitKmh === null;

  // ── Style tokens ─────────────────────────────────────────────────────────
  const outerBase = "relative flex flex-col items-center justify-center rounded-full select-none shadow-md transition-colors duration-300";

  const outerStyle: React.CSSProperties = {
    width:  80,
    height: 80,
    border: unknownState
      ? "4px solid #9ca3af"           // grey
      : isOverSpeeding
      ? "4px solid #ef4444"           // red (also bg red)
      : "4px solid #ef4444",          // normal: red border, white bg
    background: unknownState
      ? "#6b7280"
      : isOverSpeeding
      ? "#ef4444"
      : "#ffffff",
    animation: isOverSpeeding ? "pulse 1s ease-in-out infinite" : "none",
  };

  const numberStyle: React.CSSProperties = {
    fontWeight: 900,
    fontSize:   26,
    lineHeight: 1,
    color: unknownState
      ? "#ffffff"
      : isOverSpeeding
      ? "#ffffff"
      : "#111827",
  };

  const subLabelStyle: React.CSSProperties = {
    fontSize:   9,
    fontWeight: 600,
    letterSpacing: "0.05em",
    marginTop:  2,
    color: unknownState
      ? "#e5e7eb"
      : isOverSpeeding
      ? "#fee2e2"
      : "#6b7280",
  };

  return (
    <>
      {/* Inline keyframe for pulse (tailwind animate-pulse uses opacity, we want scale) */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.07); }
        }
      `}</style>

      <div className={outerBase} style={outerStyle} title={buildTooltip(payload, isStale)}>
        {/* Main number / unknown glyph */}
        <span style={numberStyle}>
          {unknownState ? "?" : limitKmh}
        </span>

        {/* Sub-label */}
        {!unknownState && (
          <span style={subLabelStyle}>km/h</span>
        )}

        {/* Stale dot */}
        {isStale && (
          <span
            className="absolute top-0 right-0 w-3 h-3 rounded-full bg-gray-400 border-2 border-white"
            style={{ transform: "translate(25%, -25%)" }}
            title="Speed limit info may be outdated"
          />
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildTooltip(
  payload: SpeedLimitUpdatePayload | null,
  isStale: boolean
): string {
  if (!payload) return "Speed limit: waiting for GPS data…";
  const limit = payload.speedLimitKmh !== null
    ? `Speed limit: ${payload.speedLimitKmh} km/h`
    : "Speed limit: unknown road";
  const speed = `Your speed: ${Math.round(payload.currentSpeedKmh)} km/h`;
  const staleNote = isStale ? " (last update >90 s ago)" : "";
  return `${limit}\n${speed}${staleNote}`;
}
