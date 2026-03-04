"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";
import type { StressSignalAlert } from "@/sockets/types";

/**
 * SosAlertListener
 *
 * Mounts once in the protected layout and subscribes to the global
 * "stress:alerts" Ably channel. On every incoming SOS, it:
 *   1. Shows a persistent sonner toast with sender name + "View Alerts" action.
 *   2. Fires a native browser notification (if permission is granted) so the
 *      driver is alerted even when the tab is in the background.
 *
 * The sender's own alert is suppressed (they already know they sent it).
 */
export function SosAlertListener() {
  const { on } = useSocket();
  const { data: session }  = useSession();
  const router = useRouter();
  const permissionRef = useRef<NotificationPermission>("default");

  // Request browser notification permission once on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      permissionRef.current = "granted";
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        permissionRef.current = p;
      });
    } else {
      permissionRef.current = Notification.permission;
    }
  }, []);

  useEffect(() => {
    const off = on("stress_signal_alert", (payload: StressSignalAlert) => {
      // Don't notify the driver about their own SOS
      if (payload.userId === session?.user?.id) return;

      const senderLabel = payload.senderName ?? "A truck driver";

      // ── Sonner toast (in-app) ────────────────────────────────────────────
      toast.error(`🚨 ${senderLabel} sent an SOS alert!`, {
        description: "A nearby driver needs immediate help.",
        duration: 12_000,
        action: {
          label: "View Alerts",
          onClick: () => router.push("/stress"),
        },
      });

      // ── Native browser notification (works when tab is backgrounded) ─────
      if (permissionRef.current === "granted") {
        const n = new Notification("🚨 SOS Alert — TruckNet", {
          body: `${senderLabel} needs help! Open the app to respond.`,
          icon: "/favicon.ico",
          tag:  `sos-${payload.id}`,   // deduplicates repeated alerts
          requireInteraction: true,    // stays until the driver dismisses it
        });
        n.onclick = () => {
          window.focus();
          router.push("/stress");
          n.close();
        };
      }
    });

    return off;
  }, [on, session?.user?.id, router]);

  // This component renders nothing — it only triggers side-effects
  return null;
}
