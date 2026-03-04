"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MapPin, Navigation, Users, Wifi, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/hooks/useSocket";
import { DriverCard } from "@/components/drivers/DriverCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Real-time driver network overview</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Socket connection indicator */}
          <span className="flex items-center gap-1.5 text-xs font-medium">
            {isConnected
              ? <Wifi className="h-3.5 w-3.5 text-green-500" />
              : <WifiOff className="h-3.5 w-3.5 text-amber-500 animate-pulse" />}
            <span className={isConnected ? "text-green-600 dark:text-green-400" : "text-amber-500"}>
              {isConnected ? "Live" : "Reconnecting…"}
            </span>
          </span>
          <Button onClick={updateLocation} variant="outline" size="sm">
            <Navigation className="h-4 w-4 mr-2" />
            Refresh Location
          </Button>
        </div>
      </div>

      {/* Location status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> My Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          {geoError ? (
            <p className="text-sm text-destructive">{geoError}</p>
          ) : myLocation ? (
            <div className="flex items-center gap-2">
              <p className="text-sm font-mono">
                {myLocation.lat.toFixed(5)}, {myLocation.lng.toFixed(5)}
              </p>
              {broadcasting && (
                <Badge variant="secondary" className="text-xs">
                  <span className="h-2 w-2 rounded-full bg-green-500 inline-block mr-1" />
                  Broadcasting
                </Badge>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Acquiring location…</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nearby drivers */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-semibold">Nearby Drivers</h2>
          <Badge variant={nearbyDrivers.length > 0 ? "default" : "secondary"}>
            <Users className="h-3 w-3 mr-1" />
            {nearbyDrivers.length}
          </Badge>
        </div>

        {nearbyDrivers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No drivers within 50 km. Position is broadcasting every 20 seconds.
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {nearbyDrivers.map((driver) => (
                <motion.div
                  key={driver.userId}
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -8 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
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
    </div>
  );
}
