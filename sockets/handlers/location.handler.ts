import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@/sockets/types";
import { LocationUpdateSchema } from "@/schemas/location.schema";
import { validateSocketEvent } from "@/lib/validate";
import {
  setDriverLocation,
  removeDriverLocation,
  getAllDriverLocations,
} from "@/sockets/store/location.store";
import { haversineDistanceKm } from "@/lib/haversine";

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * registerLocationHandler
 *
 * Handles the `update_location` client event.
 *
 * Wave 3 (stub): validates payload, updates in-memory store, logs update.
 * Wave 4 (GeolocationAgent): will add Haversine nearby calculation and
 * emit `nearby_driver_update` to all affected connected drivers.
 */
export function registerLocationHandler(io: IO, socket: TSocket): void {
  socket.on("update_location", (payload: unknown) => {
    const result = validateSocketEvent(LocationUpdateSchema, payload);

    if (!result.ok) {
      socket.emit("error", {
        error: "Invalid location payload",
        details: result.error,
      });
      return;
    }

    const { latitude, longitude } = result.data;
    const userId = socket.data.userId;

    // Update in-memory store with fresh location + socket reference
    setDriverLocation(userId, {
      latitude,
      longitude,
      socketId: socket.id,
      updatedAt: new Date(),
    });

    // Compute nearby drivers from in-memory store (50 km radius, stale >5 min excluded)
    const NEARBY_RADIUS_KM = 50;
    const STALE_THRESHOLD_MS = 5 * 60 * 1000;
    const now = Date.now();

    const allDrivers = getAllDriverLocations();
    const nearbyForUpdated = allDrivers
      .filter(
        (d) =>
          d.userId !== userId &&
          now - d.updatedAt.getTime() < STALE_THRESHOLD_MS &&
          haversineDistanceKm(latitude, longitude, d.latitude, d.longitude) <= NEARBY_RADIUS_KM
      )
      .map((d) => ({
        userId: d.userId,
        latitude: d.latitude,
        longitude: d.longitude,
        updatedAt: d.updatedAt,
      }));

    // Emit to the updating driver: their current nearby list
    socket.emit("nearby_driver_update", nearbyForUpdated);

    // Emit to each nearby driver: refresh their list to include the updating driver
    for (const nearby of nearbyForUpdated) {
      const nearbyDriver = allDrivers.find((d) => d.userId === nearby.userId);
      if (!nearbyDriver) continue;

      // Rebuild the nearby list from that driver's perspective
      const listForNearby = allDrivers
        .filter(
          (d) =>
            d.userId !== nearbyDriver.userId &&
            now - d.updatedAt.getTime() < STALE_THRESHOLD_MS &&
            haversineDistanceKm(
              nearbyDriver.latitude,
              nearbyDriver.longitude,
              d.latitude,
              d.longitude
            ) <= NEARBY_RADIUS_KM
        )
        .map((d) => ({
          userId: d.userId,
          latitude: d.latitude,
          longitude: d.longitude,
          updatedAt: d.updatedAt,
        }));

      io.to(nearbyDriver.socketId).emit("nearby_driver_update", listForNearby);
    }

    // TODO (Wave 5 persistence): persist to DB via POST /api/drivers/location
  });

  // Clean up location store on disconnect
  socket.on("disconnect", () => {
    removeDriverLocation(socket.data.userId);
  });
}
