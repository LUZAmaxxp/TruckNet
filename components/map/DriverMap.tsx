"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
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

function makeDriverIcon(selected: boolean) {
  const bg = selected ? "#f97316" : "#64748b";
  return L.divIcon({
    html: `
      <div style="
        width:18px;height:18px;
        background:${bg};
        border:2.5px solid #fff;
        border-radius:50%;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
        transition:background 0.2s;
      "></div>
    `,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
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

export interface DriverMapProps {
  currentDriver: { lat: number; lng: number } | null;
  nearbyDrivers: (NearbyDriverEntry & { distanceKm?: number; name?: string })[];
  selectedDriverId: string | null;
  onSelectDriver: (driverId: string) => void;
}

export function DriverMap({
  currentDriver,
  nearbyDrivers,
  selectedDriverId,
  onSelectDriver,
}: DriverMapProps) {
  // Default center: geographic centroid if no location yet
  const center: [number, number] = currentDriver
    ? [currentDriver.lat, currentDriver.lng]
    : [20, 0];

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
        <Marker position={[currentDriver.lat, currentDriver.lng]} icon={makeCurrentIcon()}>
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
            icon={makeDriverIcon(isSelected)}
            eventHandlers={{ click: () => onSelectDriver(driver.userId) }}
          >
            <Popup>
              <span className="font-semibold">{label}</span>
              <br />
              <span className="text-xs text-gray-500">{distLabel}</span>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
