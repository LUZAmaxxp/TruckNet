"use client";

import { cn } from "@/lib/utils";

interface ScoreRow {
  label: string;
  score: number;     // 0–100 (already weighted contribution or sub-score)
  weight?: number;   // percentage contribution if available
  icon?:  string;    // emoji
}

interface ScoreBreakdownBarProps {
  speedScore?:    number | null;
  styleScore?:    number | null;   // harsh braking + accel + swerve combined
  fatigueScore?:  number | null;   // drowsiness
  idleScore?:     number | null;
  sosScore?:      number | null;
  className?:     string;
}

function barColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f97316";
  if (score >= 40) return "#ef4444";
  return "#991b1b";
}

function Bar({ row }: { row: ScoreRow }) {
  const color = barColor(row.score);
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-[12px]" style={{ color: "var(--ink-secondary)" }}>
        {row.icon} {row.label}
      </span>
      <div className="relative flex-1 h-2 rounded-full overflow-hidden"
           style={{ background: "var(--hairline-2, #e5e7eb)" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${row.score}%`, background: color }}
        />
      </div>
      <span className="w-8 text-right text-[12px] font-semibold tabular-nums" style={{ color }}>
        {row.score}
      </span>
    </div>
  );
}

export function ScoreBreakdownBar({
  speedScore,
  styleScore,
  fatigueScore,
  idleScore,
  sosScore,
  className,
}: ScoreBreakdownBarProps) {
  const rows: ScoreRow[] = [
    { label: "Vitesse",   score: speedScore   ?? 0, icon: "🚀" },
    { label: "Style",     score: styleScore   ?? 0, icon: "🔄" },
    { label: "Fatigue",   score: fatigueScore ?? 0, icon: "😴" },
    { label: "Ralenti",   score: idleScore    ?? 0, icon: "⏸️" },
    { label: "SOS",       score: sosScore     ?? 0, icon: "🆘" },
  ];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {rows.map((r) => (
        <Bar key={r.label} row={r} />
      ))}
    </div>
  );
}
