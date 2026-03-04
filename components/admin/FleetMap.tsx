"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";
import type { LiveDriverEntry } from "@/app/(admin)/admin/page";
import type { FleetDriverUpdate } from "@/sockets/types";

// ---------------------------------------------------------------------------
// Icon helpers
// ---------------------------------------------------------------------------

function makeOnlineIcon(avatarUrl?: string | null, fresh?: boolean) {
  const borderColor = fresh ? "#22c55e" : "#eab308";
  if (avatarUrl) {
    return L.divIcon({
      html: `<div style="
        width:34px;height:34px;border-radius:50%;overflow:hidden;
        border:2.5px solid ${borderColor};
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
      "><img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;" alt="" /></div>`,
      className: "",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -20],
    });
  }
  return L.divIcon({
    html: `<div style="
      width:18px;height:18px;background:${borderColor};
      border:2.5px solid #fff;border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}

// ---------------------------------------------------------------------------
// Focus helper — pans+zooms to a driver when focusDriverId changes
// ---------------------------------------------------------------------------

function MapFocuser({
  focusDriverId,
  drivers,
}: {
  focusDriverId: string | null;
  drivers: LiveDriverEntry[];
}) {
  const map = useMap();
  useEffect(() => {
    if (!focusDriverId) return;
    const d = drivers.find((dr) => dr.id === focusDriverId);
    if (d) map.flyTo([d.latitude, d.longitude], 14, { animate: true, duration: 1 });
  }, [focusDriverId, drivers, map]);
  return null;
}

// ---------------------------------------------------------------------------
// FleetMap props
// ---------------------------------------------------------------------------

export interface FleetMapProps {
  /** Initial set of live drivers from the server (SSR/first load) */
  initialDrivers: LiveDriverEntry[];
  /** If set, fly to this driver's position */
  focusDriverId?: string | null;
}

/**
 * FleetMap — admin fleet overview map.
 * Shows all currently online drivers as color-coded pins.
 * Subscribes to Ably fleet:locations channel for real-time driver position updates.
 *
 * Green pin  = seen within last 1 minute
 * Yellow pin = seen within last 5 minutes
 */
export function FleetMap({ initialDrivers, focusDriverId }: FleetMapProps) {
  const router = useRouter();
  const { on } = useSocket();
  const [drivers, setDrivers] = useState<LiveDriverEntry[]>(initialDrivers);
  const [callingId, setCallingId] = useState<string | null>(null);
  const initialSet = useRef(false);

  // Accept updated initialDrivers (e.g. after parent SSR/first load)
  useEffect(() => {
    if (!initialSet.current && initialDrivers.length > 0) {
      setDrivers(initialDrivers);
      initialSet.current = true;
    }
  }, [initialDrivers]);

  // Real-time driver position updates via Ably fleet:locations channel
  useEffect(() => {
    const handler = (update: FleetDriverUpdate) => {
      setDrivers((prev) => {
        const existing = prev.find((d) => d.id === update.userId);
        if (existing) {
          return prev.map((d) =>
            d.id === update.userId
              ? { ...d, latitude: update.latitude, longitude: update.longitude, updatedAt: update.updatedAt }
              : d
          );
        }
        // New driver came online — append
        return [
          ...prev,
          {
            id: update.userId,
            name: update.name ?? "Unknown",
            profileImageUrl: update.profileImageUrl,
            latitude: update.latitude,
            longitude: update.longitude,
            updatedAt: update.updatedAt,
          },
        ];
      });
    };
    const unsub = on("driver_location_updated", handler);
    return unsub;
  }, [on]);

  async function handleCall(driverId: string, type: "voice" | "video") {
    try {
      setCallingId(driverId);
      const res = await fetch("/api/calls/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calleeId: driverId, type }),
      });
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string };
        toast.error(error ?? "Failed to start call");
        return;
      }
      const { roomName, token, liveKitUrl } = (await res.json()) as {
        roomName: string;
        token: string;
        liveKitUrl: string;
      };
      sessionStorage.setItem(
        "trucknet_active_call",
        JSON.stringify({ roomName, type, token, liveKitUrl, role: "caller" })
      );
      router.push(`/admin/calls/${roomName}?type=${type}`);
    } catch {
      toast.error("Could not start call. Please try again.");
    } finally {
      setCallingId(null);
    }
  }

  const now = Date.now();
  const center: [number, number] =
    drivers.length > 0 ? [drivers[0]!.latitude, drivers[0]!.longitude] : [20, 0];

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={drivers.length > 0 ? 5 : 2}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
        />

        <MapFocuser focusDriverId={focusDriverId ?? null} drivers={drivers} />

        {drivers.map((driver) => {
          const age = now - new Date(driver.updatedAt).getTime();
          const fresh = age < 60_000;
          const icon = makeOnlineIcon(driver.profileImageUrl, fresh);

          return (
            <Marker key={driver.id} position={[driver.latitude, driver.longitude]} icon={icon}>
              <Popup>
                <div className="flex flex-col gap-2 min-w-[160px]">
                  <div className="flex items-center gap-2">
                    {driver.profileImageUrl && (
                      <img
                        src={driver.profileImageUrl}
                        alt={driver.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{driver.name}</p>
                      <p className="text-[10px] text-gray-500">
                        {fresh ? "online" : "recently active"} ·{" "}
                        {Math.round(age / 60_000)}m ago
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1 flex-wrap">
                    <button
                      disabled={callingId === driver.id}
                      onClick={() => void handleCall(driver.id, "voice")}
                      className="flex-1 text-center rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                    >
                      {callingId === driver.id ? "…" : "Voice"}
                    </button>
                    <button
                      disabled={callingId === driver.id}
                      onClick={() => void handleCall(driver.id, "video")}
                      className="flex-1 text-center rounded bg-purple-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-60"
                    >
                      Video
                    </button>
                    <button
                      onClick={() => router.push(`/admin/messages/${driver.id}`)}
                      className="flex-1 text-center rounded bg-gray-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-gray-600 transition-colors"
                    >
                      Message
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Drivers count overlay */}
      <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-gray-900/90 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
        {drivers.length} driver{drivers.length !== 1 ? "s" : ""} online
      </div>
    </div>
  );
}
