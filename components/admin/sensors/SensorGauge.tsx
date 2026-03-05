"use client";

interface SensorGaugeProps {
  value:    number;
  min:      number;
  max:      number;
  unit:     string;
  label:    string;
  warnMin?: number;
  warnMax?: number;
  size?:    number;
}

function getArcColor(
  value: number,
  min: number,
  max: number,
  warnMin?: number,
  warnMax?: number
): string {
  const range = max - min;
  const nearPct = 0.1;

  if (warnMax !== undefined && value > warnMax) return "var(--terra)";
  if (warnMin !== undefined && value < warnMin) return "var(--terra)";
  if (warnMax !== undefined && value > warnMax - range * nearPct) return "var(--honey)";
  if (warnMin !== undefined && value < warnMin + range * nearPct) return "var(--honey)";
  return "var(--sage)";
}

export function SensorGauge({
  value,
  min,
  max,
  unit,
  label,
  warnMin,
  warnMax,
  size = 160,
}: SensorGaugeProps) {
  // SVG semi-circle arc math (viewBox 0 0 120 70)
  const CX = 60, CY = 60, R = 46;
  const circumference = Math.PI * R; // half-circle arc length
  const pct    = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const offset = circumference * (1 - pct);
  const color  = getArcColor(value, min, max, warnMin, warnMax);

  // Arc path: start at left (180°), sweep 180° to right (0°)
  const arcPath = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

  const displayVal = Number.isInteger(value) ? value.toString() : value.toFixed(1);

  return (
    <svg
      viewBox="0 0 120 74"
      width={size}
      height={size * (74 / 120)}
      aria-label={`${label}: ${displayVal} ${unit}`}
    >
      {/* Background arc */}
      <path
        d={arcPath}
        fill="none"
        stroke="var(--hairline)"
        strokeWidth={10}
        strokeLinecap="round"
      />

      {/* Value arc */}
      <path
        d={arcPath}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.4s ease" }}
      />

      {/* Value text */}
      <text
        x={CX}
        y={54}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Bricolage Grotesque', sans-serif"
        fontSize={22}
        fontWeight={700}
        fill="var(--ink)"
      >
        {displayVal}
      </text>

      {/* Unit text */}
      <text
        x={CX}
        y={65}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Instrument Sans', sans-serif"
        fontSize={10}
        fill="var(--muted)"
      >
        {unit}
      </text>

      {/* Label text */}
      <text
        x={CX}
        y={74}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Instrument Sans', sans-serif"
        fontSize={9}
        fill="var(--subtle)"
      >
        {label}
      </text>
    </svg>
  );
}
