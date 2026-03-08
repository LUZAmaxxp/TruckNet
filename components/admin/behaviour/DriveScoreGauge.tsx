"use client";

import { cn } from "@/lib/utils";

/** Returns color based on score (0–100) */
function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e"; // green-500
  if (score >= 60) return "#f97316"; // orange-500
  if (score >= 40) return "#ef4444"; // red-500
  return "#991b1b";                  // red-800
}

interface DriveScoreGaugeProps {
  score:       number | null | undefined;
  size?:       number;
  strokeWidth?: number;
  label?:      string;
  className?:  string;
}

/**
 * Circular SVG gauge rendering a 0-100 drive safety score.
 * Animates via CSS stroke-dashoffset transition on mount.
 */
export function DriveScoreGauge({
  score,
  size        = 120,
  strokeWidth = 10,
  label,
  className,
}: DriveScoreGaugeProps) {
  const radius    = (size - strokeWidth) / 2;
  const circumf   = 2 * Math.PI * radius;

  // 270° arc (three-quarter circle, starting top-left)
  const arcFrac   = 0.75;
  const arcLen    = circumf * arcFrac;

  const safeScore = score ?? 0;
  const filled    = arcLen * (safeScore / 100);
  const offset    = arcLen - filled;

  const color     = scoreColor(safeScore);
  const trackGray = "var(--hairline-2, #e5e7eb)";

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rotate-[135deg]"          // rotate so arc starts bottom-left → goes CW
        aria-label={`Score de conduite: ${safeScore}`}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackGray}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLen} ${circumf - arcLen}`}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        {score !== null && score !== undefined && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${filled} ${circumf - filled + (circumf - arcLen)}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        )}
      </svg>

      {/* Score label — rotated back */}
      <div className="flex flex-col items-center -mt-2 select-none" style={{ marginTop: `-${size * 0.3}px` }}>
        {score === null || score === undefined ? (
          <span className="text-[11px]" style={{ color: "var(--ink-secondary)" }}>N/A</span>
        ) : (
          <>
            <span
              className="font-display font-bold leading-none"
              style={{ fontSize: size * 0.22, color }}
            >
              {safeScore}
            </span>
            {label && (
              <span
                className="text-[10px] tracking-wide uppercase"
                style={{ color: "var(--ink-secondary)" }}
              >
                {label}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
