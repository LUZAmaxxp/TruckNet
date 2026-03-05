"use client";

import { useEffect, useState, useCallback } from "react";
import { Cpu, Plus, X } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { SensorDeviceGrid } from "@/components/admin/sensors/SensorDeviceGrid";
import { SensorAlertPanel } from "@/components/admin/sensors/SensorAlertPanel";

export type AdminSensorDeviceView = {
  deviceId: string;
  truckLabel: string;
  status: "online" | "offline" | "unknown";
  lastSeenAt: string | null;
  firmwareVersion: string | null;
  activeAlertCount: number;
  latestReading: {
    temperatureC: number;
    humidityPct: number;
    vibrationMagnitude: number;
    recordedAt: string;
  } | null;
};

export default function SensorsPage() {
  const [devices, setDevices] = useState<AdminSensorDeviceView[]>([]);
  const [loading, setLoading] = useState(true);
  const { on } = useSocket();

  // Register modal state
  const [showRegister, setShowRegister] = useState(false);
  const [regDeviceId, setRegDeviceId] = useState("");
  const [regTruckLabel, setRegTruckLabel] = useState("");
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sensors");
      if (res.ok) {
        const data = await res.json() as { devices?: AdminSensorDeviceView[] };
        setDevices(data.devices ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  // Merge fleet summary updates from Ably
  useEffect(() => {
    const unsub = on("fleet_sensor_update", (payload) => {
      if (!payload.devices) return;
      setDevices((prev) => {
        const map = new Map(prev.map((d) => [d.deviceId, d]));
        for (const d of payload.devices) {
          map.set(d.deviceId, { ...(map.get(d.deviceId) ?? d), ...d });
        }
        return Array.from(map.values());
      });
    });
    return unsub;
  }, [on]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);
    setRegLoading(true);
    try {
      const res = await fetch(`/api/admin/sensors/${encodeURIComponent(regDeviceId.trim())}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: regDeviceId.trim(), truckLabel: regTruckLabel.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setRegError(data.error ?? "Registration failed");
        return;
      }
      setShowRegister(false);
      setRegDeviceId("");
      setRegTruckLabel("");
      await fetchDevices();
    } catch {
      setRegError("Network error — please try again");
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6 overflow-hidden">
      {/* Page header */}
      <div className="flex items-center gap-3 shrink-0">
        <Cpu className="h-5 w-5" style={{ color: "var(--navy)" }} />
        <div>
          <h1
            className="font-display text-[20px] font-bold leading-tight"
            style={{ color: "var(--ink)" }}
          >
            Sensor Monitoring
          </h1>
          <p className="font-body text-[13px]" style={{ color: "var(--muted)" }}>
            Real-time IoT cargo condition telemetry
          </p>
        </div>
        <span
          className="ml-auto font-mono text-[12px] mr-3"
          style={{ color: "var(--subtle)" }}
        >
          {devices.length} device{devices.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => { setShowRegister(true); setRegError(null); }}
          className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--navy)", color: "#fff" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Register Device
        </button>
      </div>

      {/* Main content: device grid + alert panel */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
        {/* Device grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 rounded-[12px] animate-pulse"
                  style={{ background: "var(--hairline)" }}
                />
              ))}
            </div>
          ) : (
            <SensorDeviceGrid devices={devices} />
          )}
        </div>

        {/* Alert sidebar */}
        <div className="w-72 shrink-0 overflow-y-auto">
          <SensorAlertPanel />
        </div>
      </div>

      {/* Register Device Modal */}
      {showRegister && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowRegister(false); }}
        >
          <div
            className="w-full max-w-sm rounded-[16px] p-6 shadow-xl"
            style={{ background: "var(--base)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-[16px] font-bold" style={{ color: "var(--ink)" }}>
                Register New Device
              </h2>
              <button onClick={() => setShowRegister(false)} className="opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => { void handleRegister(e); }} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-body text-[12px] font-medium" style={{ color: "var(--muted)" }}>
                  Device ID
                </label>
                <input
                  type="text"
                  value={regDeviceId}
                  onChange={(e) => setRegDeviceId(e.target.value)}
                  placeholder="e.g. truck-001"
                  required
                  className="rounded-[8px] border px-3 py-2 text-[13px] outline-none focus:ring-2"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--hairline)",
                    color: "var(--ink)",
                  }}
                />
                <span className="font-mono text-[11px]" style={{ color: "var(--subtle)" }}>
                  Must match DEVICE_ID in esp32/src/config.h
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-body text-[12px] font-medium" style={{ color: "var(--muted)" }}>
                  Truck Label
                </label>
                <input
                  type="text"
                  value={regTruckLabel}
                  onChange={(e) => setRegTruckLabel(e.target.value)}
                  placeholder="e.g. Volvo FH16 — AB-123-CD"
                  required
                  className="rounded-[8px] border px-3 py-2 text-[13px] outline-none focus:ring-2"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--hairline)",
                    color: "var(--ink)",
                  }}
                />
              </div>

              {regError && (
                <p className="text-[12px] font-medium" style={{ color: "var(--terra)" }}>
                  {regError}
                </p>
              )}

              <button
                type="submit"
                disabled={regLoading || !regDeviceId.trim() || !regTruckLabel.trim()}
                className="mt-1 rounded-[8px] py-2 text-[13px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: "var(--navy)", color: "#fff" }}
              >
                {regLoading ? "Registering…" : "Register Device"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
