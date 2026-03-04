"use client";

// Must be rendered inside a react-leaflet <MapContainer>
import { useEffect, useMemo } from "react";
import { Polyline, useMap } from "react-leaflet";
import type L from "leaflet";

interface RoutePolylineProps {
  /**
   * GeoJSON LineString coordinates — [longitude, latitude] pairs.
   * IMPORTANT: OSRM returns [lng, lat]; this component reverses to [lat, lng]
   * for Leaflet internally.
   */
  coordinates: [number, number][];
  /** Polyline color — defaults to var(--navy) for drivers, var(--slate) for admin */
  color?: string;
  /** Fit the map bounds to the polyline on mount */
  fitBounds?: boolean;
}

/**
 * RoutePolyline — draws an OSRM route on a react-leaflet map.
 *
 * Coordinate reversal: OSRM uses [lng, lat]; Leaflet/react-leaflet uses [lat, lng].
 * This component handles the reversal transparently.
 */
export function RoutePolyline({
  coordinates,
  color = "var(--navy)",
  fitBounds = true,
}: RoutePolylineProps) {
  const map = useMap();

  // Reverse [lng, lat] → [lat, lng] for Leaflet
  const latLngPositions = useMemo(
    () => coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    [coordinates]
  );

  // Fit map bounds once on mount (when route is first drawn)
  useEffect(() => {
    if (!fitBounds || latLngPositions.length < 2) return;
    try {
      const bounds = latLngPositions.reduce(
        (b, [lat, lng]) => b.extend([lat, lng] as L.LatLngTuple),
        map
          .getBounds()
          .extend([latLngPositions[0]![0], latLngPositions[0]![1]] as L.LatLngTuple)
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true });
    } catch {
      // non-critical — map might not be ready
    }
    // Only run on mount (coordinates won't change for a given route)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (latLngPositions.length < 2) return null;

  return (
    <Polyline
      positions={latLngPositions}
      pathOptions={{
        color,
        weight: 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }}
    />
  );
}
