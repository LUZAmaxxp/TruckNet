"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { format, parseISO } from "date-fns";

interface ChartPoint {
  recordedAt: string;
  value: number;
}

function ChartTooltip(
  props: TooltipProps<number, string> & { unit: string; decimals: number },
) {
  const { active, payload, unit, decimals } = props;
  if (!active || !payload?.length) return null;
  const pt  = payload[0];
  const rec = pt.payload as ChartPoint;
  return (
    <div
      className="rounded-[8px] px-3 py-2 shadow-lg"
      style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}
    >
      <p className="font-mono text-[13px] font-semibold" style={{ color: pt.color }}>
        {(pt.value as number).toFixed(decimals)} {unit}
      </p>
      <p className="font-mono text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
        {format(parseISO(rec.recordedAt), "HH:mm:ss · dd MMM")}
      </p>
    </div>
  );
}

export interface SensorChartProps {
  readings:   ChartPoint[];
  color:      string;
  unit:       string;
  label:      string;
  threshold?: number;
  warnMin?:   number;
  height?:    number;
  decimals?:  number;
}

export function SensorChart({
  readings,
  color,
  unit,
  label,
  threshold,
  warnMin,
  height   = 220,
  decimals = 1,
}: SensorChartProps) {
  // recharts needs ascending time order
  const data       = [...readings].reverse();
  const gradientId = `sg-${label.replace(/\W/g, "")}`;

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-[8px]"
        style={{ height, background: "var(--base)" }}
      >
        <p className="font-mono text-[12px]" style={{ color: "var(--muted)" }}>
          No data in this time range
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--hairline)"
          strokeOpacity={0.8}
          vertical={false}
        />

        <XAxis
          dataKey="recordedAt"
          tickFormatter={(v: string) => format(parseISO(v), "HH:mm")}
          tick={{ fontSize: 10, fill: "var(--muted)", fontFamily: "monospace" }}
          axisLine={false}
          tickLine={false}
          minTickGap={50}
        />

        <YAxis
          tickFormatter={(v: number) => `${v}${unit}`}
          tick={{ fontSize: 10, fill: "var(--muted)", fontFamily: "monospace" }}
          axisLine={false}
          tickLine={false}
          width={46}
        />

        <Tooltip
          content={(p) => (
            <ChartTooltip
              {...(p as TooltipProps<number, string>)}
              unit={unit}
              decimals={decimals}
            />
          )}
          cursor={{ stroke: "var(--hairline)", strokeWidth: 1.5 }}
        />

        {threshold !== undefined && (
          <ReferenceLine
            y={threshold}
            stroke="var(--terra)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: `max ${threshold}${unit}`,
              position: "insideTopRight",
              fontSize: 10,
              fill: "var(--terra)",
              fontFamily: "monospace",
            }}
          />
        )}

        {warnMin !== undefined && (
          <ReferenceLine
            y={warnMin}
            stroke="var(--honey)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: `min ${warnMin}${unit}`,
              position: "insideBottomRight",
              fontSize: 10,
              fill: "var(--honey)",
              fontFamily: "monospace",
            }}
          />
        )}

        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: "var(--surface)", strokeWidth: 2 }}
          isAnimationActive
          animationDuration={600}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
