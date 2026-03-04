"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";

interface IncomingCallModalProps {
  callerName: string;
  callerAvatar: string | null;
  callType: "voice" | "video";
  roomName: string;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * IncomingCallModal
 *
 * Full-screen overlay that appears when a 'call_incoming' Ably event fires.
 * Slides in from the bottom using Framer Motion.
 * Plays a ringtone using the Web Audio API (falls back silently if denied).
 */
export function IncomingCallModal({
  callerName,
  callerAvatar,
  callType,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simple ringtone via Web Audio API
  const playRingtone = () => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const playBeep = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      };

      playBeep();
      ringtoneIntervalRef.current = setInterval(playBeep, 1200);
    } catch {
      // AudioContext may be blocked — continue silently
    }
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  };

  useEffect(() => {
    playRingtone();
    return stopRingtone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAccept = () => {
    stopRingtone();
    onAccept();
  };

  const handleDecline = () => {
    stopRingtone();
    onDecline();
  };

  return (
    <AnimatePresence>
      <motion.div
        key="incoming-call-modal"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-0 z-[100] flex items-end justify-center backdrop-blur-sm"
        style={{ background: "rgba(28,58,94,0.45)" }}
      >
        <div
          className="w-full max-w-sm p-8 flex flex-col items-center gap-6"
          style={{
            background: "var(--surface)",
            borderRadius: "24px 24px 0 0",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Avatar */}
          <div
            className="relative w-24 h-24 rounded-full overflow-hidden flex items-center justify-center border-4"
            style={{ borderColor: "var(--navy-lt)", background: "var(--navy-lt)" }}
          >
            {callerAvatar ? (
              <Image src={callerAvatar} alt={callerName} fill className="object-cover" />
            ) : (
              <span className="font-display text-3xl font-bold" style={{ color: "var(--navy)" }}>
                {callerName.charAt(0).toUpperCase()}
              </span>
            )}
            {/* Pulsing ring */}
            <span className="absolute inset-0 rounded-full border-4 animate-ping opacity-30" style={{ borderColor: "var(--navy)" }} />
          </div>

          {/* Caller info */}
          <div className="text-center">
            <p className="font-mono text-[11px] mb-1" style={{ color: "var(--subtle)" }}>
              Incoming {callType === "video" ? "video" : "voice"} call
            </p>
            <h2 className="font-display text-[24px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>{callerName}</h2>
          </div>

          {/* Controls — large touch targets (min 48px) */}
          <div className="flex items-center justify-between w-full px-8">
            {/* Decline */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleDecline}
                className="w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-all shadow-md"
                style={{ background: "var(--terra)", color: "white" }}
                aria-label="Decline call"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="font-mono text-[10px]" style={{ color: "var(--subtle)" }}>Decline</span>
            </div>

            {/* Accept */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleAccept}
                className="w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-all shadow-md"
                style={{ background: "var(--sage)", color: "white" }}
                aria-label="Accept call"
              >
                {callType === "video" ? (
                  <Video className="w-7 h-7" />
                ) : (
                  <Phone className="w-7 h-7" />
                )}
              </button>
              <span className="font-mono text-[10px]" style={{ color: "var(--subtle)" }}>Accept</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
