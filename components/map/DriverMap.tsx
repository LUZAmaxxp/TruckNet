"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useMemo, memo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { NearbyDriverEntry } from "@/sockets/types";

// ---------------------------------------------------------------------------
// Custom DivIcon helpers — avoids the broken default Leaflet icon in Next.js
// ---------------------------------------------------------------------------

function makeCurrentIcon() {
  return L.divIcon({
    html: `
      <div style="
        width:22px;height:22px;
        background:#3b82f6;
        border:3px solid #fff;
        border-radius:50%;
        box-shadow:0 0 0 3px #3b82f6aa;
        animation:pulse 2s infinite;
      "></div>
      <style>
        @keyframes pulse {
          0%,100%{box-shadow:0 0 0 3px #3b82f6aa}
          50%{box-shadow:0 0 0 8px #3b82f600}
        }
      </style>
    `,
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

function makeDriverIcon(selected: boolean, avatarUrl?: string | null) {
  const bg = selected ? "#f97316" : "#64748b";
  const html = avatarUrl
    ? `<div style="
        width:32px;height:32px;
        border-radius:50%;
        overflow:hidden;
        border:2.5px solid ${selected ? '#f97316' : '#fff'};
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
      ">
        <img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;" alt="" />
      </div>`
    : `<div style="
        width:18px;height:18px;
        background:${bg};
        border:2.5px solid #fff;
        border-radius:50%;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
        transition:background 0.2s;
      "></div>`;
  const size: [number, number] = avatarUrl ? [32, 32] : [18, 18];
  const anchor: [number, number] = avatarUrl ? [16, 16] : [9, 9];
  return L.divIcon({
    html,
    className: "",
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -12],
  });
}

// ---------------------------------------------------------------------------
// Recenter helper — re-flies the map when the current position changes
// ---------------------------------------------------------------------------

interface RecenterProps {
  lat: number;
  lng: number;
}

function Recenter({ lat, lng }: RecenterProps) {
  const map = useMap();
  const didInit = useRef(false);

  useEffect(() => {
    if (!didInit.current) {
      map.setView([lat, lng], 13, { animate: false });
      didInit.current = true;
    }
  }, [map, lat, lng]);

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type DriverMapEntry = NearbyDriverEntry & { distanceKm?: number; name?: string };

export interface DriverMapProps {
  currentDriver: { lat: number; lng: number } | null;
  nearbyDrivers: DriverMapEntry[];
  selectedDriverId: string | null;
  onSelectDriver: (driver: DriverMapEntry) => void;
  onSendMessage: (driverId: string) => void;
}

export const DriverMap = memo(function DriverMap({
  currentDriver,
  nearbyDrivers,
  selectedDriverId,
  onSelectDriver,
  onSendMessage,
}: DriverMapProps) {
  // Default center: geographic centroid if no location yet
  const center: [number, number] = currentDriver
    ? [currentDriver.lat, currentDriver.lng]
    : [20, 0];

  // Memoize current-user icon so it isn't recreated on every render
  const currentIcon = useMemo(() => makeCurrentIcon(), []);

  return (
    <MapContainer
      center={center}
      zoom={currentDriver ? 13 : 2}
      scrollWheelZoom
      className="w-full h-full rounded-lg z-0"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Recenter once we have real coords */}
      {currentDriver && <Recenter lat={currentDriver.lat} lng={currentDriver.lng} />}

      {/* Current user marker */}
      {currentDriver && (
        <Marker position={[currentDriver.lat, currentDriver.lng]} icon={currentIcon}>
          <Popup>
            <span className="font-semibold text-blue-600">📍 You</span>
            <br />
            <span className="text-xs text-gray-500">
              {currentDriver.lat.toFixed(5)}, {currentDriver.lng.toFixed(5)}
            </span>
          </Popup>
        </Marker>
      )}

      {/* Nearby driver markers */}
      {nearbyDrivers.map((driver) => {
        const isSelected = driver.userId === selectedDriverId;
        const label = driver.name ?? `Driver ${driver.userId.slice(0, 8)}`;
        const distLabel =
          driver.distanceKm != null
            ? driver.distanceKm < 1
              ? `${Math.round(driver.distanceKm * 1000)} m away`
              : `${driver.distanceKm.toFixed(1)} km away`
            : "distance unknown";

        return (
          <Marker
            key={driver.userId}
            position={[driver.latitude, driver.longitude]}
            icon={makeDriverIcon(isSelected, driver.profileImageUrl)}
            eventHandlers={{ click: () => onSelectDriver(driver) }}
          >
            <Popup minWidth={200}>
              <div style={{ fontFamily: "inherit" }}>
                <p style={{ fontWeight: 600, marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
                  {distLabel}
                </p>
                <button
                  onClick={() => onSendMessage(driver.userId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    width: "100%",
                    padding: "7px 12px",
                    background: "#3b82f6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Send Voice Message
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
});

DriverMap.displayName = "DriverMap";
