"use client";

interface VibrationIndicatorProps {
  magnitude: number;
}

/** Returns number of segments to light (0–5) and their color. */
function getVibration(mag: number): { segments: number; color: string } {
  if (mag < 0.1)  return { segments: 0, color: "var(--sage)" };
  if (mag < 0.25) return { segments: 1, color: "var(--sage)" };
  if (mag < 0.35) return { segments: 2, color: "var(--honey)" };
  if (mag < 0.4)  return { segments: 3, color: "var(--honey)" };
  if (mag < 0.6)  return { segments: 4, color: "var(--terra)" };
  return                  { segments: 5, color: "var(--terra)" };
}

export function VibrationIndicator({ magnitude }: VibrationIndicatorProps) {
  const { segments, color } = getVibration(magnitude);
  const critical = magnitude >= 0.6;

  return (
    <div className="flex flex-col gap-0.5">
      <div className={`flex items-center gap-1 ${critical ? "animate-sos-beat" : ""}`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-5 rounded-full transition-colors duration-300"
            style={{
              background: i < segments ? color : "var(--hairline)",
            }}
          />
        ))}
      </div>
      <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
        {magnitude.toFixed(3)} G
      </span>
    </div>
  );
}
