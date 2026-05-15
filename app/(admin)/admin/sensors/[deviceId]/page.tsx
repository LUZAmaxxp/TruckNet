"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Cpu } from "lucide-react";
import Ably from "ably";
import { DeviceStatusDot } from "@/components/admin/sensors/DeviceStatusDot";
import { SensorGauge } from "@/components/admin/sensors/SensorGauge";
import { SensorChart } from "@/components/admin/sensors/SensorChart";
import { SensorAlertPanel } from "@/components/admin/sensors/SensorAlertPanel";
import { type AdminSensorDeviceView } from "@/app/(admin)/admin/sensors/page";
import type { SensorReadingPayload, DeviceStatusPayload } from "@/sockets/types";

type Range = "1h" | "6h" | "24h" | "7d";
type ChartMetric = "temperature" | "humidity" | "vibration";

type ChartConfig = {
  readings:   { recordedAt: string; value: number }[];
  color:      string;
  unit:       string;
  label:      string;
  threshold?: number;
  warnMin?:   number;
  decimals?:  number;
};

const CHART_TABS: { label: string; value: ChartMetric; color: string; activeBg: string }[] = [
  { label: "Temperature", value: "temperature", color: "var(--sage)",    activeBg: "var(--sage-lt)"   },
  { label: "Humidity",    value: "humidity",    color: "var(--navy)",    activeBg: "var(--navy-pale)" },
  { label: "Vibration",   value: "vibration",   color: "var(--honey)",   activeBg: "var(--honey-lt)"  },
];

function statRange(vals: number[]) {
  if (!vals.length) return { min: 0, avg: 0, max: 0 };
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { min, avg, max };
}

function DeltaBadge({
  delta,
  unit,
  decimals = 1,
}: {
  delta: number | null;
  unit: string;
  decimals?: number;
}) {
  if (delta === null)
    return <span className="font-mono text-[11px]" style={{ color: "var(--subtle)" }}>—</span>;
  const abs = Math.abs(delta);
  if (abs < 0.005)
    return <span className="font-mono text-[11px]" style={{ color: "var(--subtle)" }}>→ stable</span>;
  return (
    <span
      className="font-mono text-[11px] font-medium"
      style={{ color: delta > 0 ? "var(--terra)" : "var(--sage)" }}
    >
      {delta > 0 ? "↑" : "↓"} {abs.toFixed(decimals)}{unit}
    </span>
  );
}

function StatsRow({
  stats,
  unit,
  decimals = 1,
}: {
  stats: { min: number; avg: number; max: number };
  unit: string;
  decimals?: number;
}) {
  return (
    <div
      className="grid w-full grid-cols-3 rounded-[8px] overflow-hidden"
      style={{ border: "1px solid var(--hairline)" }}
    >
      {(["Min", "Avg", "Max"] as const).map((lbl, i) => {
        const val = lbl === "Min" ? stats.min : lbl === "Avg" ? stats.avg : stats.max;
        return (
          <div
            key={lbl}
            className="flex flex-col items-center py-1.5"
            style={i > 0 ? { borderLeft: "1px solid var(--hairline)" } : {}}
          >
            <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>{lbl}</span>
            <span className="font-mono text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
              {val.toFixed(decimals)}{unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}

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
  const [chartMetric, setChartMetric] = useState<ChartMetric>("temperature");
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
    let mounted = true;
    const realtime = new Ably.Realtime({ authUrl: "/api/auth/ably-token" });
    ablyRef.current = realtime;

    // Absorb ALL connection state events — prevents any Ably-internal async
    // throws from surfacing as unhandled errors in React's error boundary.
    realtime.connection.on(() => {});

    const channel = realtime.channels.get(`sensors:${deviceId}`);

    // Absorb ALL channel state events for the same reason.
    channel.on(() => {});

    void channel.subscribe("sensor_reading", (msg: Ably.Message) => {
      if (!mounted) return;
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
      if (!mounted) return;
      const p = msg.data as DeviceStatusPayload;
      setData((prev) => prev ? { ...prev, status: p.status } : prev);
    });

    return () => {
      mounted = false;
      channel.unsubscribe();
      realtime.connection.off();
      // Do NOT call realtime.close() — Ably v2 fires an async internal error
      // event that bypasses try-catch and crashes React's error boundary.
      // The connection will close on its own via Ably's built-in TTL (2 min).
      if (ablyRef.current === realtime) ablyRef.current = null;
    };
  }, [deviceId]);

  const readings = data?.readings ?? [];
  const latest   = data?.latestReading;
  const prev     = readings[1];

  // Deltas vs previous reading
  const tempDelta = (latest && prev) ? latest.temperatureC       - prev.temperatureC       : null;
  const humDelta  = (latest && prev) ? latest.humidityPct        - prev.humidityPct        : null;
  const vibDelta  = (latest && prev) ? latest.vibrationMagnitude - prev.vibrationMagnitude : null;

  // Stats over the selected time range
  const tempStats = statRange(readings.map((r) => r.temperatureC));
  const humStats  = statRange(readings.map((r) => r.humidityPct));
  const vibStats  = statRange(readings.map((r) => r.vibrationMagnitude));

  // Chart data for each metric tab
  const chartDataMap: Record<ChartMetric, ChartConfig> = {
    temperature: {
      readings:  readings.map((r) => ({ recordedAt: r.recordedAt, value: r.temperatureC })),
      color:     "var(--sage)",
      unit:      "°C",
      label:     "Temperature",
      threshold: 8,
      warnMin:   2,
    },
    humidity: {
      readings:  readings.map((r) => ({ recordedAt: r.recordedAt, value: r.humidityPct })),
      color:     "var(--navy)",
      unit:      "%",
      label:     "Humidity",
      threshold: 85,
    },
    vibration: {
      readings:  readings.map((r) => ({ recordedAt: r.recordedAt, value: r.vibrationMagnitude })),
      color:     "var(--honey)",
      unit:      "G",
      label:     "Vibration",
      threshold: 0.5,
      decimals:  3,
    },
  };
  const activeChart = chartDataMap[chartMetric];

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
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-56 rounded-[12px] animate-pulse"
                    style={{ background: "var(--hairline)" }}
                  />
                ))}
              </div>
              <div
                className="h-72 rounded-[12px] animate-pulse"
                style={{ background: "var(--hairline)" }}
              />
            </div>
          ) : (
            <>
              {/* ── Gauge cards ─────────────────────────────────────────── */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                {/* Temperature */}
                <div
                  className="rounded-[12px] p-4 flex flex-col items-center gap-2"
                  style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
                >
                  <div className="flex w-full items-center justify-between">
                    <p className="font-body text-[12px] font-medium" style={{ color: "var(--muted)" }}>
                      Temperature
                    </p>
                    <DeltaBadge delta={tempDelta} unit="°C" />
                  </div>
                  <SensorGauge
                    value={latest?.temperatureC ?? 0}
                    min={-10} max={30} warnMin={2} warnMax={8}
                    unit="°C" label="Cargo Temp" size={140}
                  />
                  <StatsRow stats={tempStats} unit="°C" />
                </div>

                {/* Humidity */}
                <div
                  className="rounded-[12px] p-4 flex flex-col items-center gap-2"
                  style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
                >
                  <div className="flex w-full items-center justify-between">
                    <p className="font-body text-[12px] font-medium" style={{ color: "var(--muted)" }}>
                      Humidity
                    </p>
                    <DeltaBadge delta={humDelta} unit="%" />
                  </div>
                  <SensorGauge
                    value={latest?.humidityPct ?? 0}
                    min={0} max={100} warnMax={85}
                    unit="%" label="Relative" size={140}
                  />
                  <StatsRow stats={humStats} unit="%" />
                </div>

                {/* Vibration */}
                <div
                  className="rounded-[12px] p-4 flex flex-col items-center gap-2"
                  style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
                >
                  <div className="flex w-full items-center justify-between">
                    <p className="font-body text-[12px] font-medium" style={{ color: "var(--muted)" }}>
                      Vibration
                    </p>
                    <DeltaBadge delta={vibDelta} unit="G" decimals={3} />
                  </div>
                  <SensorGauge
                    value={latest?.vibrationMagnitude ?? 0}
                    min={0} max={2} warnMax={0.5}
                    unit="G" label="Magnitude" size={140}
                  />
                  <StatsRow stats={vibStats} unit="G" decimals={3} />
                </div>
              </div>

              {/* ── Chart panel ─────────────────────────────────────────── */}
              <div
                className="rounded-[12px] p-4"
                style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
              >
                {/* Tab bar */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-1">
                    {CHART_TABS.map(({ label, value, color, activeBg }) => (
                      <button
                        key={value}
                        onClick={() => setChartMetric(value)}
                        className="rounded-[8px] px-3 py-1.5 font-mono text-[12px] font-medium transition-all"
                        style={
                          chartMetric === value
                            ? { background: activeBg, color }
                            : { background: "transparent", color: "var(--muted)" }
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <span className="font-mono text-[11px]" style={{ color: "var(--subtle)" }}>
                    {readings.length} readings · {range}
                  </span>
                </div>

                {/* Chart */}
                <SensorChart
                  key={chartMetric}
                  readings={activeChart.readings}
                  color={activeChart.color}
                  unit={activeChart.unit}
                  label={activeChart.label}
                  threshold={activeChart.threshold}
                  warnMin={activeChart.warnMin}
                  decimals={activeChart.decimals}
                  height={240}
                />
              </div>
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
