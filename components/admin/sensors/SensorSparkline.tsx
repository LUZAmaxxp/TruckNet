"use client";

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface SparklinePoint {
  recordedAt: string;
  value: number;
}

interface SensorSparklineProps {
  readings:   SparklinePoint[];
  color:      string;
  height?:    number;
  threshold?: number;
}

export function SensorSparkline({
  readings,
  color,
  height = 56,
  threshold,
}: SensorSparklineProps) {
  // recharts needs data in ascending time order
  const data = [...readings].reverse();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={color}
          fillOpacity={0.08}
          isAnimationActive
          animationDuration={400}
          dot={false}
          activeDot={false}
        />
        {threshold !== undefined && (
          <ReferenceLine
            y={threshold}
            stroke={color}
            strokeDasharray="4 2"
            strokeOpacity={0.5}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
