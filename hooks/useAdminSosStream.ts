"use client";

import { useEffect, useRef } from "react";
import type { SosAdminEntry } from "@/app/(admin)/admin/page";

/**
 * useAdminSosStream
 *
 * Connects to the admin SSE stream at /api/admin/sos/stream and calls
 * `onNewAlert` for every new SOS alert that arrives from Kafka.
 *
 * - One EventSource per component mount; closed automatically on unmount.
 * - EventSource auto-reconnects on transient network failures (browser built-in).
 * - The callback ref pattern prevents re-opening the stream when the parent
 *   re-renders with a freshly-bound callback.
 */
export function useAdminSosStream(onNewAlert: (alert: SosAdminEntry) => void) {
  // Keep the latest callback in a ref so the EventSource effect stays stable
  const callbackRef = useRef(onNewAlert);
  useEffect(() => {
    callbackRef.current = onNewAlert;
  }, [onNewAlert]);

  useEffect(() => {
    const es = new EventSource("/api/admin/sos/stream");

    es.onmessage = (event: MessageEvent<string>) => {
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        return; // malformed frame — ignore
      }

      // Skip the initial handshake event ({ type: "connected" })
      if (typeof data === "object" && data !== null && "type" in data) return;

      callbackRef.current(data as SosAdminEntry);
    };

    // onerror is intentionally left as a no-op: EventSource will retry automatically
    es.onerror = () => {};

    return () => {
      es.close();
    };
  }, []); // stable — only runs once per mount
}
