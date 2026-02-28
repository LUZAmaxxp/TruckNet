import { decode } from "next-auth/jwt";
import type { Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@/sockets/types";
import { env } from "@/lib/env";

type TSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * socketAuthMiddleware
 *
 * Validates the Auth.js JWT passed in socket.handshake.auth.token.
 * The token is the raw encrypted JWE string obtained from GET /api/auth/socket-token.
 *
 * On success: sets socket.data.userId and calls next().
 * On failure: calls next(new Error("unauthorized")) — rejects the connection.
 *
 * Client usage:
 *   const { token } = await fetch("/api/auth/socket-token").then(r => r.json());
 *   const socket = io(SOCKET_URL, { auth: { token } });
 */
export const socketAuthMiddleware = async (
  socket: TSocket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token || typeof token !== "string") {
      return next(new Error("unauthorized"));
    }

    const decoded = await decode({
      token,
      secret: env.NEXTAUTH_SECRET,
      // Auth.js v5 uses the cookie name as the salt.
      // In production the cookie is __Secure-authjs.session-token.
      salt:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
    });

    if (!decoded || !decoded.id) {
      return next(new Error("unauthorized"));
    }

    // Inject the authenticated user ID into socket.data
    socket.data.userId = decoded.id as string;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
};
