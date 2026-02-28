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
  const { on, emit, onConnect, isConnected } = useSocket();

  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverEntry[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Broadcast current position to socket server
  const broadcastLocation = useCallback(
    (lat: number, lng: number) => {
      emit("update_location", { latitude: lat, longitude: lng });
    },
    [emit]
  );

  // Fetch location from browser and broadcast
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
        broadcastLocation(latitude, longitude);
        setBroadcasting(true);
        // Also persist to DB (fire-and-forget)
        fetch("/api/drivers/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude }),
        }).catch(() => {});
      },
      (err) => {
        setGeoError(err.message);
        setBroadcasting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [broadcastLocation]);

  // Re-emit location immediately whenever the socket (re)connects
  useEffect(() => {
    const unsub = onConnect(updateLocation);
    return unsub;
  }, [onConnect, updateLocation]);

  // Initial location fetch + periodic interval
  useEffect(() => {
    updateLocation();
    intervalRef.current = setInterval(updateLocation, LOCATION_BROADCAST_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [updateLocation]);

  // Subscribe to nearby_driver_update
  useEffect(() => {
    const unsub = on("nearby_driver_update", (drivers) => {
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
    const unsub = on("voice_message_received", () => {
      toast.info("🎙️ New voice message received!", {
        action: { label: "View", onClick: () => router.push("/messages") },
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
