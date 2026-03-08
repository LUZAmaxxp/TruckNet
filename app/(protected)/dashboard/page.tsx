"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/hooks/useSocket";
import { DriverCard } from "@/components/drivers/DriverCard";
import { ActiveTripCard } from "@/components/drivers/ActiveTripCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NearbyDriverEntry } from "@/sockets/types";

/** Interval (ms) between automatic location broadcasts. */
const LOCATION_BROADCAST_INTERVAL_MS = 20_000; // 20 seconds

export default function DashboardPage() {
  const router = useRouter();
  const { on, onConnect, isConnected } = useSocket();

  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverEntry[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hydrate nearby list from DB immediately (before first broadcast fires)
  const fetchNearbyDrivers = useCallback(async () => {
    try {
      const res = await fetch("/api/drivers/nearby");
      if (res.ok) {
        const { data } = (await res.json()) as { data: { drivers: NearbyDriverEntry[] } };
        const drivers = data?.drivers ?? [];
        console.log(`[dashboard] fetchNearbyDrivers → ${drivers.length} driver(s)`);
        setNearbyDrivers(drivers);
      }
    } catch (err) {
      console.error("[dashboard] fetchNearbyDrivers error:", err);
    }
  }, []);

  // Fetch location from browser and POST it (server side does store + Ably publish)
  const updateLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMyLocation({ lat: latitude, lng: longitude });
        setGeoError(null);
        setBroadcasting(true);
        console.log(`[dashboard] updateLocation lat=${latitude} lon=${longitude}`);
        fetch("/api/drivers/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude }),
        }).catch((err) => console.error("[dashboard] location POST error:", err));
      },
      (err) => {
        setGeoError(err.message);
        setBroadcasting(false);
        console.warn("[dashboard] geolocation error:", err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Re-emit location immediately whenever the socket (re)connects
  useEffect(() => {
    const unsub = onConnect(updateLocation);
    return unsub;
  }, [onConnect, updateLocation]);

  // Hydrate nearby list + start periodic location broadcast
  useEffect(() => {
    void fetchNearbyDrivers(); // immediate DB fetch so list isn't blank on first render
    updateLocation();          // first broadcast
    intervalRef.current = setInterval(updateLocation, LOCATION_BROADCAST_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [updateLocation, fetchNearbyDrivers]);

  // Subscribe to nearby_driver_update (now on private user:<clientId> channel)
  useEffect(() => {
    const unsub = on("nearby_driver_update", (drivers) => {
      console.log(`[dashboard] nearby_driver_update received: ${drivers.length} driver(s)`, drivers);
      setNearbyDrivers(drivers);
    });
    return unsub;
  }, [on]);

  // Subscribe to stress_signal_alert
  useEffect(() => {
    const unsub = on("stress_signal_alert", (signal) => {
      toast.error(`🚨 Stress Alert from nearby driver!`, {
        description: `Location: ${signal.latitude.toFixed(4)}, ${signal.longitude.toFixed(4)}`,
        duration: 8000,
      });
    });
    return unsub;
  }, [on]);

  // Subscribe to voice_message_received
  useEffect(() => {
    const unsub = on("voice_message_received", (msg) => {
      console.log("[dashboard] voice_message_received", msg);
      const name = msg.senderName ?? "A contact";
      toast.info(`🎙️ New voice message from ${name}`, {
        duration: 12_000,
        action: { label: "Listen", onClick: () => router.push(`/messages?from=${msg.senderId}`) },
      });
    });
    return unsub;
  }, [on, router]);

  // Subscribe to text_message_received
  useEffect(() => {
    const unsub = on("text_message_received", (msg) => {
      console.log("[dashboard] text_message_received", msg);
      const name = msg.senderName ?? "A contact";
      const preview = msg.content.length > 60 ? msg.content.slice(0, 60) + "…" : msg.content;
      toast.info(`💬 ${name}: ${preview}`, {
        duration: 10_000,
        action: { label: "Reply", onClick: () => router.push(`/messages?from=${msg.senderId}`) },
      });
    });
    return unsub;
  }, [on, router]);

  return (
    <motion.div
      className="space-y-6 animate-screen-in"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span
              className="inline-block h-[1.5px] w-4 rounded-full"
              style={{ background: "var(--navy-md)" }}
            />
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--navy-md)" }}
            >
              Driver Portal
            </span>
          </div>
          <h1
            className="font-display text-[26px] font-bold leading-tight tracking-[-0.03em]"
            style={{ color: "var(--ink)" }}
          >
            Dashboard
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--muted)" }}>
            {broadcasting
              ? `Broadcasting · ${nearbyDrivers.length} driver${nearbyDrivers.length !== 1 ? "s" : ""} nearby`
              : "Acquiring location…"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Connection status */}
          <span
            className="inline-flex items-center gap-[6px] rounded-[20px] px-[10px] py-[4px] text-[11px] font-semibold"
            style={
              isConnected
                ? { background: "var(--sage-lt)", color: "var(--sage)" }
                : { background: "var(--honey-lt)", color: "var(--honey)" }
            }
          >
            <span
              className={`inline-block h-[5px] w-[5px] rounded-full bg-current ${isConnected ? "animate-live-pulse" : "animate-sos-beat"}`}
            />
            {isConnected ? "Live" : "Reconnecting…"}
          </span>
          <Button onClick={updateLocation} variant="soft" size="sm">
            <Navigation className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Location card */}
      <div
        className="relative overflow-hidden rounded-lg border p-5"
        style={{
          background: "var(--surface)",
          borderColor: "var(--hairline)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-sm text-[16px]"
              style={{ background: "var(--navy-lt)" }}
            >
              📍
            </div>
            <span
              className="font-display text-[14px] font-semibold tracking-[-0.01em]"
              style={{ color: "var(--ink)" }}
            >
              My Location
            </span>
          </div>
          {broadcasting && <Badge variant="online">Broadcasting</Badge>}
        </div>

        {geoError ? (
          <div
            className="rounded-sm px-[14px] py-[10px] text-[13px]"
            style={{ background: "var(--terra-lt)", color: "var(--terra)" }}
          >
            {geoError}
          </div>
        ) : myLocation ? (
          <div
            className="rounded-sm px-[14px] py-3"
            style={{ background: "var(--base)", border: "1px solid var(--hairline)" }}
          >
            <p className="font-mono text-[13px] font-medium" style={{ color: "var(--navy)" }}>
              {myLocation.lat.toFixed(5)},&nbsp;{myLocation.lng.toFixed(5)}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[13px]">Acquiring location…</span>
          </div>
        )}
      </div>

      {/* Active trip */}
      <ActiveTripCard />

      {/* Nearby drivers */}
      <div>
        {/* Section title */}
        <div className="mb-[14px] flex items-center gap-2">
          <span
            className="font-display text-[13px] font-semibold leading-none tracking-[-0.01em]"
            style={{ color: "var(--ink-2)" }}
          >
            Nearby Drivers
          </span>
          <span
            className="inline-flex items-center rounded-[10px] px-[7px] py-[2px] font-mono text-[10px]"
            style={{ background: "var(--hairline-2)", color: "var(--muted)" }}
          >
            {nearbyDrivers.length}
          </span>
        </div>

        {nearbyDrivers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="rounded-lg border py-10 text-center"
              style={{
                background: "var(--surface)",
                borderColor: "var(--hairline)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <p className="text-[32px] mb-2">🚛</p>
              <p
                className="font-display text-[13px] font-semibold"
                style={{ color: "var(--ink-2)" }}
              >
                No drivers within 50 km
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
                Position is broadcasting every 20 seconds
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {nearbyDrivers.map((driver, i) => (
                <motion.div
                  key={driver.userId}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -6 }}
                  transition={{ duration: 0.18, delay: i * 0.04, ease: "easeOut" }}
                >
                  <DriverCard
                    driver={driver}
                    onSendMessage={(id) => router.push(`/messages?to=${id}`)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
