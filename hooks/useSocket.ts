"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Ably from "ably";
import type { ServerToClientEvents, ClientToServerEvents } from "@/sockets/types";

type EventName = keyof ServerToClientEvents;

/**
 * Events that live on a shared channel rather than the per-user channel.
 * All other server→client events go to "user:<clientId>".
 *
 * NOTE: nearby_driver_update is intentionally NOT listed here — it is
 * delivered on the private "user:<clientId>" channel so each driver
 * receives their own personalised list (different distances, different subset).
 */
const SHARED_CHANNEL_MAP: Partial<Record<EventName, string>> = {
  // nearby_driver_update → private user:<clientId>  (personalised per driver)
  stress_signal_alert:  "stress:alerts",
};

/**
 * useSocket (Ably-backed)
 *
 * Drop-in replacement for the legacy Socket.io hook.
 * Maintains the same public API so zero page-level changes are required.
 *
 * Auth strategy: fetches a signed Ably TokenRequest from GET /api/auth/ably-token
 * (set as `authUrl`). The Ably SDK auto-refreshes the token before expiry.
 *
 * Channel topology:
 *   "stress:alerts"      — emergency alerts                    (stress_signal_alert)
 *   "user:<userId>"      — per-user private channel  (voice / friends / nearby_driver_update / errors)
 *
 * emit() is intentionally a no-op: all client→server data is sent via REST.
 * Pages already call the REST endpoint directly — the socket emit was supplemental.
 */
export function useSocket() {
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const connectCallbacks = useRef<Array<() => void>>([]);

  useEffect(() => {
    const ably = new Ably.Realtime({
      authUrl: "/api/auth/ably-token",
      autoConnect: true,
    });

    ablyRef.current = ably;

    ably.connection.on("connected", () => {
      clientIdRef.current = ably.auth.clientId ?? null;
      setIsConnected(true);
      connectCallbacks.current.forEach((cb) => cb());
      console.log("[useSocket] Ably connected, clientId:", clientIdRef.current);
    });

    ably.connection.on("disconnected", () => setIsConnected(false));
    ably.connection.on("suspended",    () => setIsConnected(false));
    ably.connection.on("failed", (stateChange) => {
      console.error("[useSocket] Ably connection failed:", stateChange?.reason?.message);
      setIsConnected(false);
    });

    return () => {
      ably.close();
      ablyRef.current    = null;
      clientIdRef.current = null;
    };
  }, []);

  /** Resolve the Ably channel for a given server→client event name. */
  const resolveChannel = useCallback((event: EventName): Ably.RealtimeChannel | null => {
    const ably = ablyRef.current;
    if (!ably) return null;

    const shared = SHARED_CHANNEL_MAP[event];
    if (shared) return ably.channels.get(shared);

    const cid = clientIdRef.current ?? ably.auth.clientId;
    if (!cid) {
      console.warn(`[useSocket] clientId not yet available for private channel (event: ${event})`);
      return null;
    }
    return ably.channels.get(`user:${cid}`);
  }, []);

  /**
   * Subscribe to a typed server→client event.
   * Returns an unsubscribe function — call it on component unmount.
   *
   * Uses a persistent `on("connected", ...)` listener so that subscriptions
   * are automatically re-established after every reconnection, not just the
   * first one.  The channel listener is removed before re-adding to avoid
   * duplicate deliveries.
   */
  const on = useCallback(
    <E extends EventName>(event: E, handler: ServerToClientEvents[E]) => {
      const ably = ablyRef.current;
      if (!ably) return () => {};

      const listener = (msg: Ably.Message) =>
        (handler as (data: unknown) => void)(msg.data);

      const subscribe = () => {
        const channel = resolveChannel(event);
        if (!channel) {
          console.warn(
            `[useSocket] could not resolve channel for "${event}" — clientId not yet available`
          );
          return;
        }
        // Unsubscribe first so reconnections don't stack duplicate listeners.
        channel.unsubscribe(event, listener);
        void channel.subscribe(event, listener);
        console.log(
          `[useSocket] subscribed to "${event}" on channel "${channel.name}"`
        );
      };

      // Subscribe now if already connected.
      if (ably.connection.state === "connected") {
        subscribe();
      }

      // Re-subscribe on every (re)connection — this also covers the initial
      // connection when the hook hasn't connected yet.
      ably.connection.on("connected", subscribe);

      return () => {
        // Stop re-subscribing on future reconnections.
        ably.connection.off("connected", subscribe);
        // Remove the channel listener.
        const channel = resolveChannel(event);
        channel?.unsubscribe(event, listener);
      };
    },
    [resolveChannel]
  );

  /**
   * No-op — all client→server data travels over REST API routes.
   * Preserved for backward compatibility with page-level code.
   */
  const emit = useCallback(
    <E extends keyof ClientToServerEvents>(
      _event: E,
      ..._args: Parameters<ClientToServerEvents[E]>
    ) => {
      // intentional no-op: REST handles persistence + Ably server-side handles broadcast
    },
    []
  );

  /**
   * Register a callback to run each time the Ably connection (re)establishes.
   * Fires immediately if already connected. Returns an unsubscribe function.
   */
  const onConnect = useCallback((cb: () => void) => {
    if (ablyRef.current?.connection.state === "connected") {
      cb();
    }
    connectCallbacks.current.push(cb);
    return () => {
      connectCallbacks.current = connectCallbacks.current.filter((fn) => fn !== cb);
    };
  }, []);

  return { socket: ablyRef, on, emit, onConnect, isConnected };
}
