"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type DriverStatus = "online" | "idle" | "sos" | "offline";

interface DriverRowProps extends React.HTMLAttributes<HTMLDivElement> {
  driver: {
    name: string;
    tag: string;
    status: DriverStatus;
    route?: string;
    color?: string;   // Hex color for avatar background tint
    initials?: string;
    distKm?: number;
  };
  selected?: boolean;
}

const statusDotColors: Record<DriverStatus, string> = {
  online:  "var(--sage-md)",
  idle:    "var(--honey-md)",
  sos:     "var(--terra)",
  offline: "var(--subtle)",
};

export function DriverRow({
  driver,
  selected = false,
  className,
  ...props
}: DriverRowProps) {
  const { name, tag, status, route, color = "var(--navy)", initials, distKm } = driver;

  const avatarBg = `${color}20`; // ~12% alpha tint

  const fallbackInitials =
    initials ??
    name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-[14px] rounded-[12px] border px-[14px] py-3",
        "transition-all duration-[0.18s]",
        selected
          ? "border-[rgba(28,58,94,0.15)] bg-navy-pale"
          : "border-transparent hover:border-hairline hover:bg-base",
        className
      )}
      {...props}
    >
      {/* Avatar with status dot */}
      <div className="relative shrink-0">
        <div
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full"
          style={{ background: avatarBg }}
        >
          <span
            className="font-display text-[13px] font-bold"
            style={{ color }}
          >
            {fallbackInitials}
          </span>
        </div>
        {/* Status dot */}
        <span
          className={cn(
            "absolute bottom-0 right-0 h-[9px] w-[9px] rounded-full border-2",
            status === "sos" && "animate-sos-beat"
          )}
          style={{
            background: statusDotColors[status],
            borderColor: "var(--surface)",
          }}
        />
      </div>

      {/* Name + route */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-[13px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          {name}
        </p>
        {tag && (
          <p className="font-mono text-[10px] text-muted">{tag}</p>
        )}
        {route && (
          <p className="mt-0.5 truncate text-[11px] text-muted">{route}</p>
        )}
      </div>

      {/* Distance + badge */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {distKm !== undefined && (
          <span className="font-mono text-[11px] font-medium" style={{ color: "var(--navy)" }}>
            {distKm < 1
              ? `${Math.round(distKm * 1000)}m`
              : `${distKm.toFixed(1)}km`}
          </span>
        )}
        <Badge variant={status} />
      </div>
    </div>
  );
}
