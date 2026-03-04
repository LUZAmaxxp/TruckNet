"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 */
  value: number;
  /** CSS color value, e.g. 'var(--sage)' or '#3A6B52' */
  color?: string;
  label?: string;
  showValue?: boolean;
}

export function ProgressBar({
  value,
  color = "var(--navy)",
  label,
  showValue = false,
  className,
  ...props
}: ProgressBarProps) {
  const [displayed, setDisplayed] = React.useState(0);

  // Animate from 0 to value on mount
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setDisplayed(Math.max(0, Math.min(100, value)));
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div className={cn("w-full", className)} {...props}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && (
            <span className="text-[12px] font-medium text-muted">{label}</span>
          )}
          {showValue && (
            <span
              className="font-mono text-[11px] font-medium"
              style={{ color: "var(--ink-2)" }}
            >
              {value}%
            </span>
          )}
        </div>
      )}
      {/* Track */}
      <div
        className="h-[5px] w-full overflow-hidden rounded-[3px]"
        style={{ background: "var(--hairline)" }}
      >
        {/* Fill */}
        <div
          className="h-full rounded-[3px]"
          style={{
            width: `${displayed}%`,
            background: color,
            transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}
