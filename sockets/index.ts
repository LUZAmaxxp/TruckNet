import { Server as SocketServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@/sockets/types";
import { socketAuthMiddleware } from "@/sockets/middleware/auth.middleware";
import { applySocketRateLimits } from "@/sockets/middleware/rate-limit.middleware";
import { registerLocationHandler } from "@/sockets/handlers/location.handler";
import { registerVoiceHandler } from "@/sockets/handlers/voice.handler";
import { registerStressHandler } from "@/sockets/handlers/stress.handler";
import { registerFriendHandler } from "@/sockets/handlers/friend.handler";

export type TypedSocketServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/** Singleton Socket.io server instance */
let io: TypedSocketServer | null = null;

/**
 * initSocketServer
 *
 * Initialises the Socket.io server, attaches authentication middleware,
 * registers all event handlers, and returns the server instance.
 * Must be called exactly once when the HTTP server starts.
 *
 * Architecture note: Socket.io is attached to the same HTTP server as
 * Next.js so both share port and authentication cookies (same origin).
 * For multi-instance horizontal scaling, replace the in-memory SocketServer
 * with io.adapter(createAdapter(redisClient)) — no handler code changes needed.
 */
export function initSocketServer(
  httpServer: HTTPServer,
  corsOrigin: string
): TypedSocketServer {
  io = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Connection state recovery — re-deliver missed events on reconnect
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    },
  });

  // --- Authentication middleware: must run before any handler ---
  io.use(socketAuthMiddleware);

  // --- Per-connection handler registration ---
  io.on("connection", (socket) => {
    applySocketRateLimits(socket);
    registerLocationHandler(io!, socket);
    registerVoiceHandler(io!, socket);
    registerStressHandler(io!, socket);
    registerFriendHandler(io!, socket);
  });

  return io;
}

/**
 * getIO
 *
 * Returns the singleton Socket.io server.
 * Call from route handlers or other server-side code to emit events.
 * Throws if called before initSocketServer().
 *
 * @example
 *   import { getIO } from "@/sockets";
 *   getIO().to(socketId).emit("voice_message_received", message);
 */
export function getIO(): TypedSocketServer {
  if (!io) {
    throw new Error(
      "Socket.io server is not initialised. Ensure server.ts has started."
    );
  }
  return io;
}
