"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/sockets/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * useSocket
 *
 * Singleton-per-component Socket.io client hook.
 *
 * Auth strategy: fetches a raw JWT from GET /api/auth/socket-token and passes
 * it as `auth.token` on the socket handshake.  This matches the server-side
 * socketAuthMiddleware which decodes the same JWT via Auth.js v5 decode().
 *
 * Features:
 *   - Connects once on mount, disconnects cleanly on unmount
 *   - Auto-reconnect handled natively by socket.io-client (reconnection: true)
 *   - Typed on() / emit() wrappers prevent stringly-typed event names
 *   - Returns the raw socket for callers that need direct access
 */
export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  // Buffers emit() calls made before the socket object is created (async JWT fetch window)
  const emitQueue = useRef<Array<() => void>>([]);
  // Callbacks fired on every socket connect / reconnect
  const connectCallbacks = useRef<Array<() => void>>();
  connectCallbacks.current ??= [];
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let socket: TypedSocket;

    async function connect() {
      // Fetch raw JWT for socket handshake auth
      const res = await fetch("/api/auth/socket-token");
      if (!res.ok) {
        console.error("[useSocket] Failed to fetch socket token — not connecting");
        return;
      }
      const { token } = (await res.json()) as { token: string };

      socket = io({
        path: "/socket.io",
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        transports: ["websocket", "polling"],
      }) as TypedSocket;

      // Assign ref FIRST so subsequent emit() calls go directly to the socket
      // (socket.io buffers them internally until the handshake completes)
      socketRef.current = socket;

      // Flush any emissions that arrived before the JWT fetch completed
      const queued = emitQueue.current.splice(0);
      queued.forEach((fn) => fn());

      socket.on("connect", () => {
        console.log("[useSocket] Connected:", socket.id);
        setIsConnected(true);
        // Fire all registered connect callbacks (initial connect + every reconnect)
        connectCallbacks.current!.forEach((cb) => cb());
      });
      socket.on("disconnect", (reason) => {
        console.log("[useSocket] Disconnected:", reason);
        setIsConnected(false);
      });
      socket.on("connect_error", (err) => {
        console.warn("[useSocket] Connection error:", err.message);
        setIsConnected(false);
      });
    }

    connect();

    return () => {
      socket?.disconnect();
      socketRef.current = null;
    };
  }, []);

  /** Listen to a typed server→client event. Automatically removes on component unmount. */
  const on = useCallback(
    <E extends keyof ServerToClientEvents>(
      event: E,
      handler: ServerToClientEvents[E]
    ) => {
      // @ts-expect-error — socket.io typing with generics needs casting
      socketRef.current?.on(event, handler);
      return () => {
        // @ts-expect-error
        socketRef.current?.off(event, handler);
      };
    },
    []
  );

  /** Emit a typed client→server event. Queues the call if socket hasn't been created yet. */
  const emit = useCallback(
    <E extends keyof ClientToServerEvents>(
      event: E,
      ...args: Parameters<ClientToServerEvents[E]>
    ) => {
      if (socketRef.current) {
        (socketRef.current.emit as (...a: unknown[]) => void)(event, ...args);
      } else {
        // Socket object not yet created (JWT fetch in-flight); buffer and replay once ready
        emitQueue.current.push(() => {
          if (socketRef.current) {
            (socketRef.current.emit as (...a: unknown[]) => void)(event, ...args);
          }
        });
      }
    },
    []
  );

  /**
   * Register a callback to run whenever the socket (re)connects.
   * If the socket is already connected when this is called, the callback fires immediately.
   * Returns an unsubscribe function.
   */
  const onConnect = useCallback((cb: () => void) => {
    if (socketRef.current?.connected) {
      cb();
    }
    connectCallbacks.current!.push(cb);
    return () => {
      connectCallbacks.current = connectCallbacks.current!.filter((fn) => fn !== cb);
    };
  }, []);

  return { socket: socketRef, on, emit, onConnect, isConnected };
}
