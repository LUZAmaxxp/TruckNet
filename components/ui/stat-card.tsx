"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Emoji or icon character */
  icon: string;
  label: string;
  value: string;
  delta?: string;
  deltaType?: "up" | "down" | "neutral";
  /** Hex color for the accent bar and icon box — e.g. '#3A6B52' */
  accentColor?: string;
}

export function StatCard({
  icon,
  label,
  value,
  delta,
  deltaType = "neutral",
  accentColor = "var(--navy)",
  className,
  ...props
}: StatCardProps) {
  const deltaColors: Record<string, string> = {
    up:      "bg-sage-lt text-sage",
    down:    "bg-terra-lt text-terra",
    neutral: "bg-hairline-2 text-muted",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-hairline bg-surface shadow-sm",
        "transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
        "before:bg-[linear-gradient(135deg,rgba(255,255,255,0.5)_0%,transparent_60%)]",
        className
      )}
      {...props}
    >
      {/* Accent bar */}
      <div
        className="absolute left-0 top-0 h-[3px] w-full rounded-tl-lg rounded-tr-lg"
        style={{ background: accentColor }}
      />

      <div className="px-[22px] pb-5 pt-6">
        {/* Icon box */}
        <div
          className="mb-4 flex h-9 w-9 items-center justify-center rounded-sm text-[18px]"
          style={{ background: `${accentColor}20` }}
        >
          {icon}
        </div>

        {/* Value */}
        <p
          className="font-display text-[30px] font-bold leading-none tracking-[-0.04em] text-ink"
        >
          {value}
        </p>

        {/* Label + delta */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[12px] font-medium text-muted">{label}</span>
          {delta && (
            <span
              className={cn(
                "inline-flex items-center rounded-[10px] px-[7px] py-[2px] font-mono text-[10px] font-semibold",
                deltaColors[deltaType]
              )}
            >
              {delta}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
