"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Navigation, Loader2, MessageSquare, X, Users } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { NearbyDriverEntry } from "@/sockets/types";

// ---------------------------------------------------------------------------
// Dynamically import the Leaflet map — must be ssr:false (Leaflet needs window)
// ---------------------------------------------------------------------------
const DriverMap = dynamic(
  () => import("@/components/map/DriverMap").then((m) => m.DriverMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DriverWithMeta extends NearbyDriverEntry {
  distanceKm?: number;
  name?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MapPage() {
  const router = useRouter();
  const { on, emit } = useSocket();

  const [drivers, setDrivers] = useState<DriverWithMeta[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Core location broadcast + DB fetch (same contract as before)
  // ---------------------------------------------------------------------------
  const broadcastAndFetch = useCallback(async () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported by your browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setMyLocation({ lat: latitude, lng: longitude });
        emit("update_location", { latitude, longitude });

        await fetch("/api/drivers/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude }),
        }).catch(() => {});

        const res = await fetch("/api/drivers/nearby");
        if (res.ok) {
          const json = (await res.json()) as { drivers: DriverWithMeta[] };
          setDrivers(json.drivers);
        }
        setLoading(false);
      },
      (err) => {
        setGeoError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }, [emit]);

  // ---------------------------------------------------------------------------
  // Socket subscriptions (same event names / payload shapes preserved)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsub = on("nearby_driver_update", (updated) => {
      setDrivers(updated);
    });
    return unsub;
  }, [on]);

  useEffect(() => {
    const unsub = on("stress_signal_alert", (signal) => {
      toast.error("🚨 Stress alert from nearby driver!", {
        description: `${signal.latitude.toFixed(4)}, ${signal.longitude.toFixed(4)}`,
      });
    });
    return unsub;
  }, [on]);

  // ---------------------------------------------------------------------------
  // Initial fetch + 20-second interval broadcast
  // ---------------------------------------------------------------------------
  useEffect(() => {
    broadcastAndFetch();
    intervalRef.current = setInterval(broadcastAndFetch, 20_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [broadcastAndFetch]);

  // ---------------------------------------------------------------------------
  // Derived: selected driver info
  // ---------------------------------------------------------------------------
  const selectedDriver = drivers.find((d) => d.userId === selectedDriverId) ?? null;

  const distanceLabel =
    selectedDriver?.distanceKm != null
      ? selectedDriver.distanceKm < 1
        ? `${Math.round(selectedDriver.distanceKm * 1000)} m`
        : `${selectedDriver.distanceKm.toFixed(1)} km`
      : null;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header bar ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Map</h1>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {drivers.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {geoError && (
            <span className="text-xs text-destructive hidden sm:block">{geoError}</span>
          )}
          <Button onClick={broadcastAndFetch} variant="outline" size="sm" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {geoError && (
        <p className="text-sm text-destructive sm:hidden">{geoError}</p>
      )}

      {/* ── Map + overlay panel wrapper ─────────────────────────────── */}
      <div
        className="relative w-full rounded-lg overflow-hidden border"
        style={{ height: "calc(100dvh - 180px)", minHeight: "400px" }}
      >
        {/* Real interactive OpenStreetMap */}
        <DriverMap
          currentDriver={myLocation}
          nearbyDrivers={drivers}
          selectedDriverId={selectedDriverId}
          onSelectDriver={(id) =>
            setSelectedDriverId((prev) => (prev === id ? null : id))
          }
        />

        {/* Selected driver overlay card */}
        {selectedDriver && (
          <Card className="absolute bottom-3 left-3 right-3 z-[1000] shadow-xl border-0 bg-background/95 backdrop-blur-sm sm:left-auto sm:right-3 sm:w-80">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold leading-tight">
                    {selectedDriver.name ??
                      `Driver ${selectedDriver.userId.slice(0, 8)}`}
                  </p>
                  {distanceLabel && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {distanceLabel} away
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setSelectedDriverId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground font-mono mb-3">
                {selectedDriver.latitude.toFixed(5)},{" "}
                {selectedDriver.longitude.toFixed(5)}
              </p>

              <Button
                className="w-full"
                size="sm"
                onClick={() =>
                  router.push(`/messages?to=${selectedDriver.userId}`)
                }
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Send Voice Message
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Footer tip ───────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground text-center">
        Tap a marker to view driver info • Updates every 20 s via WebSocket
      </p>
    </div>
  );
}
