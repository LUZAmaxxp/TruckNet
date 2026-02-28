"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Loader2, Shield, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/hooks/useSocket";
import { StressSignalBadge, type StressSignalData } from "@/components/stress/StressSignalBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stress Signal</h1>
        <p className="text-muted-foreground text-sm">
          Alert nearby drivers within 50 km in case of emergency.
        </p>
      </div>

      {/* Animated emergency button card */}
      <Card className="border-destructive/30 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-destructive" />
            Emergency Alert
          </CardTitle>
          <CardDescription>
            Sends an immediate alert to all connected drivers within 50 km.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-6 gap-4">
          {/* Breathing glow ring + button */}
          <div className="relative flex items-center justify-center">
            {/* Outer breathing ring — animates only when idle */}
            {!sendingSignal && !justSent && (
              <motion.div
                className="absolute inset-0 rounded-full bg-destructive/20"
                animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 120, height: 120, borderRadius: "50%" }}
              />
            )}

            <motion.button
              onClick={() => setConfirmOpen(true)}
              disabled={sendingSignal}
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.04 }}
              transition={{ type: "spring", stiffness: 350, damping: 20 }}
              aria-label="Send emergency stress signal"
              className="relative z-10 flex flex-col items-center justify-center w-28 h-28 rounded-full bg-destructive text-destructive-foreground font-bold text-sm shadow-lg shadow-destructive/40 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-destructive/50"
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
                    <AlertTriangle className="h-8 w-8" />
                    <span className="text-[11px] leading-tight text-center">SEND SOS</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Tap the button to alert all nearby drivers. Limited to 3 alerts per 10 minutes.
          </p>

          {/* Inline confirmation — fades in when SOS tapped */}
          <AnimatePresence>
            {confirmOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden w-full max-w-xs"
              >
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex flex-col gap-3 text-center">
                  <p className="text-sm font-medium text-destructive">This will alert all drivers within 50 km. Confirm?</p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                    <Button variant="destructive" size="sm" onClick={triggerStressSignal}>
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Send Alert
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Live alerts — animated */}
      <AnimatePresence>
        {liveAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <h2 className="text-lg font-semibold mb-3">Live Alerts (This Session)</h2>
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

      {liveAlerts.length > 0 && <Separator />}

      {/* Active signals from API */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Active Signals (50 km, 30 min window)</h2>
          <Button variant="ghost" size="sm" onClick={fetchActive} disabled={loadingSignals}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loadingSignals ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loadingSignals ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeSignals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No active stress signals in your area.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {activeSignals.map((signal) => (
              <StressSignalBadge key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
