import { z } from "zod";

/** Body schema for POST /api/drivers/route */
export const RouteSetSchema = z.object({
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
  destinationLabel: z.string().min(1).max(500),
});

export type RouteSetInput = z.infer<typeof RouteSetSchema>;

/** Single geocode result returned by /api/geocode */
export const GeocodeResultSchema = z.object({
  place_id: z.number(),
  displayName: z.string(),
  lat: z.number(),
  lng: z.number(),
  /** e.g. "road", "city", "house" */
  type: z.string().optional(),
  /** Bounding box [south, north, west, east] for map fitBounds */
  boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});

export type GeocodeResult = z.infer<typeof GeocodeResultSchema>;

/** Shape of an active route as returned by the API */
export interface ActiveRoute {
  id: string;
  driverId: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  destinationLabel: string;
  /** GeoJSON LineString coordinates — [longitude, latitude] pairs */
  routeGeometry: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
  completedAt: string | null;
  /** Pre-computed ETAs / display strings */
  distanceLabel: string;
  durationLabel: string;
  etaIso: string;
  etaLabel: string;
}
