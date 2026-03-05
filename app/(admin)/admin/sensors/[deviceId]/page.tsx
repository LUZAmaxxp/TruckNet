"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Cpu } from "lucide-react";
import Ably from "ably";
import { DeviceStatusDot } from "@/components/admin/sensors/DeviceStatusDot";
import { SensorGauge } from "@/components/admin/sensors/SensorGauge";
import { SensorSparkline } from "@/components/admin/sensors/SensorSparkline";
import { SensorAlertPanel } from "@/components/admin/sensors/SensorAlertPanel";
import { type AdminSensorDeviceView } from "@/app/(admin)/admin/sensors/page";
import type { SensorReadingPayload, DeviceStatusPayload } from "@/sockets/types";

type Range = "1h" | "6h" | "24h" | "7d";

type DeviceDetailData = AdminSensorDeviceView & {
  readings: {
    id: string;
    recordedAt: string;
    temperatureC: number;
    humidityPct: number;
    vibrationMagnitude: number;
  }[];
  activeAlerts: {
    id: string;
    alertType: string;
    value: number;
    threshold: number;
    triggeredAt: string;
  }[];
};

const RANGES: { label: string; value: Range }[] = [
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
];

export default function SensorDeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const router = useRouter();
  const [range, setRange] = useState<Range>("6h");
  const [data, setData] = useState<DeviceDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const ablyRef = useRef<Ably.Realtime | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sensors/${deviceId}?range=${range}`);
      if (res.ok) {
        const json = await res.json() as DeviceDetailData;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [deviceId, range]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Direct Ably subscription for device-specific channel sensors:{deviceId}
  useEffect(() => {
    const realtime = new Ably.Realtime({ authUrl: "/api/auth/ably-token" });
    ablyRef.current = realtime;

    const channel = realtime.channels.get(`sensors:${deviceId}`);

    void channel.subscribe("sensor_reading", (msg: Ably.Message) => {
      const p = msg.data as SensorReadingPayload;
      const newReading = {
        id: Math.random().toString(36).slice(2),
        recordedAt: p.recordedAt,
        temperatureC: p.temperatureC,
        humidityPct: p.humidityPct,
        vibrationMagnitude: p.vibrationMagnitude,
      };
      setData((prev) => {
        if (!prev) return prev;
        const readings = [newReading, ...prev.readings].slice(0, 300);
        return { ...prev, latestReading: newReading, readings };
      });
    });

    void channel.subscribe("device_status", (msg: Ably.Message) => {
      const p = msg.data as DeviceStatusPayload;
      setData((prev) => prev ? { ...prev, status: p.status } : prev);
    });

    return () => {
      channel.unsubscribe();
      realtime.close();
      ablyRef.current = null;
    };
  }, [deviceId]);

  const readings = data?.readings ?? [];
  const latest = data?.latestReading;

  const tempReadings = readings.map((r) => ({ recordedAt: r.recordedAt, value: r.temperatureC }));
  const humReadings = readings.map((r) => ({ recordedAt: r.recordedAt, value: r.humidityPct }));
  const vibReadings = readings.map((r) => ({ recordedAt: r.recordedAt, value: r.vibrationMagnitude }));

  return (
    <div className="flex h-full flex-col gap-4 p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors hover:bg-[var(--base)]"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" style={{ color: "var(--muted)" }} />
        </button>
        {data ? (
          <>
            <DeviceStatusDot status={data.status ?? "unknown"} />
            <div>
              <h1
                className="font-display text-[18px] font-bold leading-tight"
                style={{ color: "var(--ink)" }}
              >
                {data.truckLabel}
              </h1>
              <p className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>
                {deviceId} {data.firmwareVersion ? `· fw ${data.firmwareVersion}` : ""}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5" style={{ color: "var(--hairline)" }} />
            <div
              className="h-5 w-32 rounded animate-pulse"
              style={{ background: "var(--hairline)" }}
            />
          </div>
        )}

        {/* Range pills */}
        <div className="ml-auto flex gap-1">
          {RANGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className="rounded-[8px] px-3 py-1 font-mono text-[12px] font-medium transition-colors"
              style={
                range === value
                  ? { background: "var(--navy)", color: "white" }
                  : { background: "var(--base)", color: "var(--muted)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
        {/* Left: gauges + sparklines */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-40 rounded-[12px] animate-pulse"
                  style={{ background: "var(--hairline)" }}
                />
              ))}
            </div>
          ) : (
            <>
              {/* Gauge row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div
                  className="rounded-[12px] p-4"
                  style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
                >
                  <p
                    className="mb-2 font-body text-[12px]"
                    style={{ color: "var(--muted)" }}
                  >
                    Temperature
                  </p>
                  <SensorGauge
                    value={latest?.temperatureC ?? 0}
                    min={-10}
                    max={30}
                    warnMin={2}
                    warnMax={8}
                    unit="°C"
                    label="Cargo Temp"
                  />
                  <SensorSparkline
                    readings={tempReadings}
                    color="var(--sage)"
                    threshold={8}
                    height={50}
                  />
                </div>
                <div
                  className="rounded-[12px] p-4"
                  style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
                >
                  <p
                    className="mb-2 font-body text-[12px]"
                    style={{ color: "var(--muted)" }}
                  >
                    Humidity
                  </p>
                  <SensorGauge
                    value={latest?.humidityPct ?? 0}
                    min={0}
                    max={100}
                    warnMax={85}
                    unit="%"
                    label="Relative"
                  />
                  <SensorSparkline
                    readings={humReadings}
                    color="var(--sage)"
                    threshold={85}
                    height={50}
                  />
                </div>
                <div
                  className="rounded-[12px] p-4"
                  style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
                >
                  <p
                    className="mb-2 font-body text-[12px]"
                    style={{ color: "var(--muted)" }}
                  >
                    Vibration
                  </p>
                  <SensorGauge
                    value={latest?.vibrationMagnitude ?? 0}
                    min={0}
                    max={2}
                    warnMax={0.5}
                    unit="G"
                    label="Magnitude"
                  />
                  <SensorSparkline
                    readings={vibReadings}
                    color="var(--honey)"
                    threshold={0.5}
                    height={50}
                  />
                </div>
              </div>

              {/* Full-width sparkline overview */}
              {readings.length > 0 && (
                <div
                  className="rounded-[12px] p-4"
                  style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
                >
                  <p
                    className="mb-2 font-display text-[13px] font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    Temperature trend{" "}
                    <span className="font-mono font-normal text-[11px]" style={{ color: "var(--subtle)" }}>
                      (last {readings.length} readings)
                    </span>
                  </p>
                  <SensorSparkline
                    readings={tempReadings}
                    color="var(--sage)"
                    threshold={8}
                    height={100}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: alert panel filtered by device */}
        <div className="w-72 shrink-0">
          <SensorAlertPanel deviceId={deviceId} />
        </div>
      </div>
    </div>
  );
}
