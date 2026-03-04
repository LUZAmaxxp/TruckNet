"use client";

// Must be rendered inside a react-leaflet <MapContainer>
import { RoutePolyline } from "@/components/map/RoutePolyline";
import { DestinationPin } from "@/components/map/DestinationPin";
import type { ActiveRoute } from "@/schemas/route.schema";

interface DriverRouteOverlayProps {
  route: ActiveRoute;
}

/**
 * DriverRouteOverlay — admin version of the route visualization.
 * Uses the shared RoutePolyline (slate color) and DestinationPin (no clear button).
 * Must be rendered as a child of MapContainer.
 */
export function DriverRouteOverlay({ route }: DriverRouteOverlayProps) {
  if (!route || route.routeGeometry.length < 2) return null;

  return (
    <>
      <RoutePolyline
        coordinates={route.routeGeometry}
        color="var(--slate, #64748b)"
        fitBounds={false}
      />
      <DestinationPin
        lat={route.destinationLat}
        lng={route.destinationLng}
        label={route.destinationLabel}
        // Admin cannot clear driver routes
      />
    </>
  );
}
