"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Loader2, Shield, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/hooks/useSocket";
import { StressSignalBadge, type StressSignalData } from "@/components/stress/StressSignalBadge";
import { Button } from "@/components/ui/button";
export default function StressPage() {
  const { on, emit } = useSocket();

  const [activeSignals, setActiveSignals] = useState<StressSignalData[]>([]);
  const [loadingSignals, setLoadingSignals] = useState(true);
  const [sendingSignal, setSendingSignal] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState<StressSignalData[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [justSent, setJustSent] = useState(false);

  // Fetch active stress signals from API
  const fetchActive = useCallback(async () => {
    setLoadingSignals(true);
    const res = await fetch("/api/stress-signals/active");
    if (res.ok) {
      const json = (await res.json()) as { signals: StressSignalData[] };
      setActiveSignals(json.signals);
    }
    setLoadingSignals(false);
  }, []);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  // Subscribe to real-time stress_signal_alert events
  useEffect(() => {
    const unsub = on("stress_signal_alert", (signal) => {
      const newAlert: StressSignalData = {
        id: signal.id,
        userId: signal.userId,
        latitude: signal.latitude,
        longitude: signal.longitude,
        createdAt: signal.createdAt,
      };
      setLiveAlerts((prev) => [newAlert, ...prev].slice(0, 10));
      toast.error("🚨 Stress alert from nearby driver!", {
        description: `${signal.latitude.toFixed(4)}, ${signal.longitude.toFixed(4)}`,
        duration: 10000,
      });
    });
    return unsub;
  }, [on]);

  // Send stress signal
  async function triggerStressSignal() {
    setConfirmOpen(false);
    setSendingSignal(true);

    if (!navigator.geolocation) {
      toast.error("Geolocation not supported.");
      setSendingSignal(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        emit("send_stress_signal", { latitude, longitude });

        const res = await fetch("/api/stress-signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude }),
        });

        setSendingSignal(false);

        if (res.ok) {
          setJustSent(true);
          setTimeout(() => setJustSent(false), 4000);
          toast.success("Stress signal sent! Nearby drivers have been alerted.", { duration: 6000 });
          fetchActive();
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error((err as { error?: string }).error ?? "Failed to send signal.");
        }
      },
      (err) => {
        setSendingSignal(false);
        toast.error(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Page header */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="inline-block h-[1.5px] w-4 rounded-full" style={{ background: "var(--navy-md)" }} />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--navy-md)" }}>
            Safety
          </span>
        </div>
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.03em]" style={{ color: "var(--ink)" }}>
          Stress Signal
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--muted)" }}>
          Alert nearby drivers within 50 km in case of emergency.
        </p>
      </div>

      {/* Emergency button card */}
      <div
        className="rounded-lg border p-6 overflow-hidden"
        style={{
          background: "linear-gradient(145deg, var(--terra-lt), var(--surface))",
          borderColor: "rgba(184,80,57,0.15)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4" style={{ color: "var(--terra)" }} />
          <span className="font-display text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ink)" }}>
            Emergency Alert
          </span>
        </div>
        <p className="text-[12px] mb-6" style={{ color: "var(--muted)" }}>
          Sends an immediate alert to all connected drivers within 50 km. Limited to 3 alerts per 10 minutes.
        </p>

        {/* Ring system + SOS button */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
            {/* Concentric expanding rings */}
            {!sendingSignal && !justSent && (
              <>
                <div
                  className="absolute rounded-full border-[1.5px] animate-ring-expand"
                  style={{ width: 164, height: 164, borderColor: "var(--terra-md)" }}
                />
                <div
                  className="absolute rounded-full border-[1.5px] animate-ring-expand-delay-1"
                  style={{ width: 164, height: 164, borderColor: "var(--terra-md)" }}
                />
                <div
                  className="absolute rounded-full border-[1.5px] animate-ring-expand-delay-2"
                  style={{ width: 164, height: 164, borderColor: "var(--terra-md)" }}
                />
              </>
            )}

            <motion.button
              onClick={() => setConfirmOpen(true)}
              disabled={sendingSignal}
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.04 }}
              transition={{ type: "spring", stiffness: 350, damping: 20 }}
              aria-label="Send emergency stress signal"
              className="relative z-10 flex flex-col items-center justify-center rounded-full text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none"
              style={{
                width: 96,
                height: 96,
                background: "var(--terra)",
                boxShadow: "0 6px 24px rgba(184,80,57,0.4)",
              }}
            >
              <AnimatePresence mode="wait">
                {sendingSignal ? (
                  <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </motion.span>
                ) : justSent ? (
                  <motion.span key="sent" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                    <CheckCircle2 className="h-8 w-8" />
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
                    <AlertTriangle className="h-7 w-7" />
                    <span className="text-[10px] leading-tight font-mono tracking-[0.06em]">SOS</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Confirmation inline */}
          <AnimatePresence>
            {confirmOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden w-full max-w-xs"
              >
                <div
                  className="rounded-[12px] p-4 flex flex-col gap-3 text-center"
                  style={{
                    background: "rgba(184,80,57,0.05)",
                    border: "1px solid rgba(184,80,57,0.2)",
                  }}
                >
                  <p className="text-[13px] font-medium" style={{ color: "var(--terra)" }}>
                    This will alert all drivers within 50 km. Confirm?
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                    <Button variant="danger" size="sm" onClick={triggerStressSignal}>
                      <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                      Send Alert
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Live alerts from this session */}
      <AnimatePresence>
        {liveAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-[14px] flex items-center gap-2">
              <span className="font-display text-[13px] font-semibold leading-none tracking-[-0.01em]" style={{ color: "var(--ink-2)" }}>
                Live Alerts
              </span>
              <span
                className="inline-flex items-center rounded-[10px] px-[7px] py-[2px] font-mono text-[10px] font-semibold animate-sos-beat"
                style={{ background: "var(--terra-lt)", color: "var(--terra)" }}
              >
                {liveAlerts.length}
              </span>
            </div>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {liveAlerts.map((alert) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.25 }}
                  >
                    <StressSignalBadge signal={alert} isAlert />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active signals from API */}
      <div>
        <div className="flex items-center justify-between mb-[14px]">
          <div className="flex items-center gap-2">
            <span className="font-display text-[13px] font-semibold leading-none tracking-[-0.01em]" style={{ color: "var(--ink-2)" }}>
              Active Signals
            </span>
            <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>50 km · 30 min window</span>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchActive} disabled={loadingSignals}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingSignals ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loadingSignals ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted)" }} />
          </div>
        ) : activeSignals.length === 0 ? (
          <div
            className="rounded-lg border py-10 text-center"
            style={{ background: "var(--surface)", borderColor: "var(--hairline)", boxShadow: "var(--shadow-sm)" }}
          >
            <p className="text-[32px] mb-2">🛡️</p>
            <p className="font-display text-[13px] font-semibold" style={{ color: "var(--ink-2)" }}>No active SOS alerts</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>Fleet is operating normally</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeSignals.map((signal) => (
              <StressSignalBadge key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
