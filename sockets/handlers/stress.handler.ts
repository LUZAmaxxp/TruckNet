import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@/sockets/types";
import { StressSignalSchema } from "@/schemas/stress.schema";
import { validateSocketEvent } from "@/lib/validate";
import { db } from "@/db";
import { stressSignals } from "@/db/schema";
import { getAllDriverLocations } from "@/sockets/store/location.store";
import { haversineDistanceKm } from "@/lib/haversine";

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/** Radius within which connected drivers receive the alert. */
const ALERT_RADIUS_KM = 50;

/**
 * registerStressHandler
 *
 * Handles the `send_stress_signal` client event.
 *
 * Steps:
 *   1. Validate payload with StressSignalSchema
 *   2. Persist stress signal row (status='active') to stress_signals table
 *   3. Find connected drivers within 50 km using in-memory store + Haversine
 *   4. Emit `stress_signal_alert` to each nearby driver's socket
 */
export function registerStressHandler(io: IO, socket: TSocket): void {
  socket.on("send_stress_signal", async (payload: unknown) => {
    const result = validateSocketEvent(StressSignalSchema, payload);

    if (!result.ok) {
      socket.emit("error", {
        error: "Invalid stress signal payload",
        details: result.error,
      });
      return;
    }

    const { latitude, longitude } = result.data;
    const userId = socket.data.userId;

    try {
      // 1. Persist to database
      const [signal] = await db
        .insert(stressSignals)
        .values({
          userId,
          latitude,
          longitude,
          status: "active",
        })
        .returning();

      if (!signal) {
        socket.emit("error", { error: "Failed to save stress signal" });
        return;
      }

      const alert = {
        id: signal.id,
        userId,
        latitude: signal.latitude,
        longitude: signal.longitude,
        createdAt: signal.createdAt,
      };

      // 2. Find connected drivers within ALERT_RADIUS_KM using in-memory store
      const allDrivers = getAllDriverLocations();
      const nearbySocketIds = allDrivers
        .filter(
          (d) =>
            d.userId !== userId &&
            haversineDistanceKm(latitude, longitude, d.latitude, d.longitude) <= ALERT_RADIUS_KM
        )
        .map((d) => d.socketId);

      // 3. Broadcast stress_signal_alert to each nearby driver
      for (const socketId of nearbySocketIds) {
        io.to(socketId).emit("stress_signal_alert", alert);
      }
    } catch (err) {
      console.error("[stress.handler] DB error:", err);
      socket.emit("error", { error: "Internal error while saving stress signal" });
    }
  });
}
