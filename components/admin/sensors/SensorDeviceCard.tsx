"use client";

import { type AdminSensorDeviceView } from "@/app/(admin)/admin/sensors/page";
import { DeviceStatusDot } from "@/components/admin/sensors/DeviceStatusDot";
import { VibrationIndicator } from "@/components/admin/sensors/VibrationIndicator";

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function MetricRow({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body text-[11px]" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      <span
        className="font-mono text-[12px] font-semibold"
        style={{ color }}
      >
        {value}
        <span
          className="ml-[2px] text-[10px] font-normal"
          style={{ color: "var(--subtle)" }}
        >
          {unit}
        </span>
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      className="h-[18px] rounded animate-pulse"
      style={{ background: "var(--hairline)" }}
    />
  );
}

function tempColor(v: number, min = 2, max = 8): string {
  if (v < min - 1 || v > max + 2) return "var(--terra)";
  if (v < min || v > max) return "var(--honey)";
  return "var(--sage)";
}

function humidityColor(v: number, maxPct = 85): string {
  if (v > maxPct + 5) return "var(--terra)";
  if (v > maxPct) return "var(--honey)";
  return "var(--sage)";
}

interface SensorDeviceCardProps {
  device: AdminSensorDeviceView;
  onClick: () => void;
}

export function SensorDeviceCard({ device, onClick }: SensorDeviceCardProps) {
  const r = device.latestReading;

  return (
    <button
      onClick={onClick}
      className="relative w-full rounded-[12px] p-4 text-left transition-transform duration-[0.18s] hover:-translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy)]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        cursor: "pointer",
      }}
    >
      {/* Active alert badge */}
      {device.activeAlertCount > 0 && (
        <span
          className="absolute top-3 right-3 flex h-5 min-w-[20px] items-center justify-center rounded-[10px] px-[6px] font-mono text-[10px] font-bold"
          style={{ background: "var(--terra)", color: "white" }}
        >
          {device.activeAlertCount}
        </span>
      )}

      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <DeviceStatusDot status={device.status ?? "unknown"} />
        <div className="min-w-0 flex-1">
          <p
            className="truncate font-display text-[14px] font-bold leading-tight"
            style={{ color: "var(--ink)" }}
          >
            {device.truckLabel}
          </p>
          <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
            {device.deviceId}
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-[6px]">
        {r ? (
          <>
            <MetricRow
              label="🌡️ Temp"
              value={r.temperatureC.toFixed(1)}
              unit="°C"
              color={tempColor(r.temperatureC)}
            />
            <MetricRow
              label="💧 Humidity"
              value={r.humidityPct.toFixed(0)}
              unit="%"
              color={humidityColor(r.humidityPct)}
            />
            <div className="flex items-center justify-between">
              <span
                className="font-body text-[11px]"
                style={{ color: "var(--muted)" }}
              >
                📳 Vibration
              </span>
              <VibrationIndicator magnitude={r.vibrationMagnitude} />
            </div>
          </>
        ) : (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}
      </div>

      {/* Footer */}
      <p
        className="mt-3 font-mono text-[10px]"
        style={{ color: "var(--subtle)" }}
      >
        Last seen: {formatRelative(device.lastSeenAt)}
      </p>
    </button>
  );
}
