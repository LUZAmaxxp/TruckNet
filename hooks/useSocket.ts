"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Ably from "ably";
import { useSession } from "next-auth/react";
import type { ServerToClientEvents, ClientToServerEvents } from "@/sockets/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventName    = keyof ServerToClientEvents;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler   = (data: any) => void;

/** Events delivered on the shared "stress:alerts" channel */
const STRESS_EVENTS = new Set<EventName>(["stress_signal_alert"]);

/** Events delivered on the shared "fleet:locations" channel (admin map) */
const FLEET_EVENTS = new Set<EventName>(["driver_location_updated", "driver_route_set", "driver_route_cleared"]);

/** Events delivered on the shared "admin:sensors" channel */
const SENSOR_EVENTS = new Set<EventName>(["sensor_alert", "sensor_alert_acked", "fleet_sensor_update"]);

interface SocketContextValue {
  on:          <E extends EventName>(event: E, handler: ServerToClientEvents[E]) => () => void;
  emit:        <E extends keyof ClientToServerEvents>(event: E, ...args: Parameters<ClientToServerEvents[E]>) => void;
  onConnect:   (cb: () => void) => () => void;
  isConnected: boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SocketContext = createContext<SocketContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider — single Ably.Realtime instance per authenticated session
// ---------------------------------------------------------------------------

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const realtimeRef    = useRef<Ably.Realtime | null>(null);
  // Map<eventName, Set<handler>> — components register here; Ably dispatches to all
  const listenersRef   = useRef<Map<EventName, Set<AnyHandler>>>(new Map());
  // Stable Ably dispatch functions per event — created once on first subscription
  const dispatchersRef = useRef<Map<EventName, Ably.messageCallback<Ably.Message>>>(new Map());
  const connectCallbacksRef = useRef<Set<() => void>>(new Set());

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const realtime = new Ably.Realtime({ authUrl: "/api/auth/ably-token" });
    realtimeRef.current = realtime;

    const userChannel   = realtime.channels.get(`user:${userId}`);
    const stressChannel = realtime.channels.get("stress:alerts");
    const fleetChannel  = realtime.channels.get("fleet:locations");
    const sensorChannel = realtime.channels.get("admin:sensors");

    // Build one stable dispatcher per event — routes Ably messages into our
    // listener registry. Ably keeps exactly ONE subscription per event.
    const allEvents: EventName[] = [
      "nearby_driver_update",
      "voice_message_received",
      "text_message_received",
      "stress_signal_alert",
      "friend_request_received",
      "friend_request_accepted",
      "call_incoming",
      "call_declined",
      "call_missed",
      "call_ended",
      "driver_location_updated",
      "driver_route_set",
      "driver_route_cleared",
      // IoT sensor fleet events
      "sensor_alert",
      "sensor_alert_acked",
      "fleet_sensor_update",
      "error",
    ];

    for (const event of allEvents) {
      const dispatcher: Ably.messageCallback<Ably.Message> = (msg: Ably.Message) => {
        listenersRef.current.get(event)?.forEach((h) => h(msg.data));
      };
      dispatchersRef.current.set(event, dispatcher);

      const channel = STRESS_EVENTS.has(event)
        ? stressChannel
        : FLEET_EVENTS.has(event)
        ? fleetChannel
        : SENSOR_EVENTS.has(event)
        ? sensorChannel
        : userChannel;
      void channel.subscribe(event, dispatcher);
    }

    realtime.connection.on("connected", () => {
      setIsConnected(true);
      connectCallbacksRef.current.forEach((cb) => cb());
    });
    realtime.connection.on("disconnected", () => setIsConnected(false));
    realtime.connection.on("suspended",    () => setIsConnected(false));
    realtime.connection.on("failed",       () => setIsConnected(false));

    return () => {
      userChannel.unsubscribe();
      stressChannel.unsubscribe();
      fleetChannel.unsubscribe();
      sensorChannel.unsubscribe();
      realtime.close();
      realtimeRef.current    = null;
      dispatchersRef.current = new Map();
      connectCallbacksRef.current.clear();
      // Keep listenersRef alive — components' useEffect cleanups will remove
      // their own handlers. Clearing here would break re-mounts in StrictMode.
    };
  }, [userId]);

  // ── Stable API — safe to pass as props without triggering re-renders ──

  const on = useCallback(
    <E extends EventName>(event: E, handler: ServerToClientEvents[E]) => {
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }
      listenersRef.current.get(event)!.add(handler as AnyHandler);

      return () => {
        listenersRef.current.get(event)?.delete(handler as AnyHandler);
      };
    },
    []
  );

  const emit = useCallback(
    <E extends keyof ClientToServerEvents>(
      _event: E,
      ..._args: Parameters<ClientToServerEvents[E]>
    ) => {
      // Intentional no-op: all client→server data travels over REST API routes.
    },
    []
  );

  const onConnect = useCallback((cb: () => void) => {
    if (realtimeRef.current?.connection.state === "connected") {
      cb();
    }
    connectCallbacksRef.current.add(cb);
    return () => { connectCallbacksRef.current.delete(cb); };
  }, []);

  return React.createElement(
    SocketContext.Provider,
    { value: { on, emit, onConnect, isConnected } },
    children
  );
}

// ---------------------------------------------------------------------------
// Hook — all components share the single Provider instance
// ---------------------------------------------------------------------------

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within <SocketProvider>");
  return ctx;
}
