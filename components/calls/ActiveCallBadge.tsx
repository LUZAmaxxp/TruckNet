"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, PhoneOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCallState } from "@/hooks/useCallState";
import { cn, toDate } from "@/lib/utils";

/**
 * ActiveCallBadge
 *
 * Persistent floating banner shown when a call is in progress and the user
 * navigates away from the call room page to another part of the app.
 *
 * Renders:
 *   - Pulsing green dot + "Active call" label
 *   - Elapsed call duration timer
 *   - "Return to call" tap target (navigates back to /calls/[roomName])
 *   - "End" button to terminate without returning to the call screen
 *
 * Mount this in the protected layout so it persists across route changes.
 */
export function ActiveCallBadge() {
  const { activeCall, endCall } = useCallState();
  const router = useRouter();

  const [elapsed, setElapsed] = useState(0);

  // Tick the call duration every second
  useEffect(() => {
    if (!activeCall) {
      setElapsed(0);
      return;
    }

    // toDate() handles both Date objects and ISO strings (e.g. after sessionStorage restore)
    const startMs = toDate(activeCall.startedAt)?.getTime() ?? Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall]);

  const formatElapsed = (secs: number): string => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleReturn = () => {
    if (!activeCall) return;
    router.push(`/calls/${activeCall.roomName}?type=${activeCall.type}`);
  };

  return (
    <AnimatePresence>
      {activeCall && (
        <motion.div
          key="active-call-badge"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="fixed top-14 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none"
        >
          <div
            className={cn(
              "pointer-events-auto",
              "flex items-center gap-3 px-4 py-2 rounded-full",
              "bg-green-500/95 text-white shadow-xl backdrop-blur-sm",
              "max-w-sm w-full"
            )}
          >
            {/* Pulsing dot */}
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>

            {/* Return to call — takes up the flex space */}
            <button
              onClick={handleReturn}
              className="flex-1 flex items-center gap-2 text-left"
              aria-label="Return to call"
            >
              <Phone className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium truncate">Active call</span>
              <span className="text-sm font-mono ml-auto pr-2">{formatElapsed(elapsed)}</span>
            </button>

            {/* End call */}
            <button
              onClick={() => void endCall()}
              className="shrink-0 p-1.5 rounded-full hover:bg-white/20 transition-colors"
              aria-label="End call"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
