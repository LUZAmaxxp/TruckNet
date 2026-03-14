"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface EventPoint {
  minuteOffset: number;
  severity:     "low" | "medium" | "high" | "critical";
  eventType:    string;
  occurredAt:   string;
}

interface EventTimelineProps {
  events:    EventPoint[];
  tripStart: string | Date | null | undefined;
  className?: string;
}

const SEVERITY_ORDER = { low: 1, medium: 2, high: 3, critical: 4 } as const;
const SEVERITY_COLOR: Record<string, string> = {
  low:      "#60a5fa",
  medium:   "#fbbf24",
  high:     "#f97316",
  critical: "#ef4444",
};
const SEVERITY_LABEL: Record<string, string> = {
  1: "Faible", 2: "Moyen", 3: "Élevé", 4: "Critique",
};

const EVENT_LABEL: Record<string, string> = {
  speeding:            "Vitesse",
  harsh_braking:       "Frein. brusque",
  harsh_acceleration:  "Accél. brusque",
  swerve:              "Embardée",
  drowsiness:          "Somnolence",
  phone_use:           "Téléphone",
  idle_excess:         "Ralenti",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as EventPoint & { y: number };
  return (
    <div
      className="rounded-[8px] px-3 py-2 text-[12px] shadow-lg"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        color: "var(--ink)",
      }}
    >
      <p className="font-semibold">{EVENT_LABEL[d.eventType] ?? d.eventType}</p>
      <p style={{ color: SEVERITY_COLOR[d.severity] }}>
        {d.severity.charAt(0).toUpperCase() + d.severity.slice(1)}
      </p>
      <p style={{ color: "var(--ink-secondary)" }}>T+{d.minuteOffset.toFixed(1)} min</p>
    </div>
  );
}

export function EventTimeline({ events, tripStart: _tripStart, className }: EventTimelineProps) {
  if (!events.length) {
    return (
      <p className="text-center text-[13px] py-8" style={{ color: "var(--ink-secondary)" }}>
        Aucun événement enregistré
      </p>
    );
  }

  // Build chart data — add jitter on Y within each severity band so overlapping points separate
  const data = events.map((e, i) => ({
    ...e,
    x: e.minuteOffset,
    y: (SEVERITY_ORDER[e.severity] ?? 1) + (i % 3) * 0.12,
  }));

  return (
    <div className={className} style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
          <XAxis
            dataKey="x"
            type="number"
            name="Minute"
            tickFormatter={(v: number) => `${v.toFixed(0)}m`}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={[0.5, 4.5]}
            ticks={[1, 2, 3, 4]}
            tickFormatter={(v: number) => SEVERITY_LABEL[Math.round(v)] ?? ""}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={55}
          />
          {[1, 2, 3, 4].map((yVal) => (
            <ReferenceLine
              key={yVal}
              y={yVal}
              stroke="var(--hairline)"
              strokeDasharray="3 3"
            />
          ))}
          <Tooltip content={<CustomTooltip />} />
          <Scatter data={data} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={SEVERITY_COLOR[entry.severity] ?? "#60a5fa"}
                opacity={0.85}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
