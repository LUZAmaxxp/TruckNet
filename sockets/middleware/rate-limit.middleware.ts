import type { Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@/sockets/types";
import { RateLimiter } from "@/lib/rate-limit";

type TSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Per-event socket rate limiters.
 * Keyed per socket.data.userId — one limiter instance shared across all connections.
 */
const socketVoiceLimiter = new RateLimiter(10, 60 * 1000); // 10 per minute
const socketStressLimiter = new RateLimiter(3, 10 * 60 * 1000); // 3 per 10 minutes

/**
 * socketRateLimitMiddleware
 *
 * Wraps event listeners for abuse-prone socket events with per-user rate limiting.
 * On limit exceeded: emits an error event to the sender — socket is NOT disconnected.
 *
 * Usage: call once per new socket connection BEFORE registering event handlers,
 * passing the concrete emit names to guard.
 *
 * @example
 *   io.on("connection", (socket) => {
 *     applySocketRateLimits(socket);
 *     registerLocationHandler(io, socket);
 *     ...
 *   });
 */
export function applySocketRateLimits(socket: TSocket): void {
  const userId = socket.data.userId;

  socket.use(([event, ...args], next) => {
    if (event === "send_voice_message") {
      const { allowed, retryAfterSeconds } = socketVoiceLimiter.check(userId);
      if (!allowed) {
        socket.emit("error", {
          error: `Voice message rate limit exceeded. Retry in ${retryAfterSeconds}s.`,
        });
        return; // Drop the event — do not call next()
      }
    }

    if (event === "send_stress_signal") {
      const { allowed, retryAfterSeconds } = socketStressLimiter.check(userId);
      if (!allowed) {
        socket.emit("error", {
          error: `Stress signal rate limit exceeded. Retry in ${retryAfterSeconds}s.`,
        });
        return;
      }
    }

    next();
  });
}
