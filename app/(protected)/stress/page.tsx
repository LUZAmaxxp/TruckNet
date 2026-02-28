"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Loader2, Shield } from "lucide-react";
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
      setLiveAlerts((prev) => [newAlert, ...prev].slice(0, 10)); // keep last 10
      toast.error("🚨 Stress alert from nearby driver!", {
        description: `${signal.latitude.toFixed(4)}, ${signal.longitude.toFixed(4)}`,
        duration: 10000,
      });
    });
    return unsub;
  }, [on]);

  // Send stress signal
  async function triggerStressSignal() {
    setSendingSignal(true);

    if (!navigator.geolocation) {
      toast.error("Geolocation not supported.");
      setSendingSignal(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        // Emit socket event for sub-500ms delivery to nearby drivers
        emit("send_stress_signal", { latitude, longitude });

        // Also persist via REST API
        const res = await fetch("/api/stress-signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude }),
        });

        setSendingSignal(false);

        if (res.ok) {
          toast.success("Stress signal sent! Nearby drivers have been alerted.", {
            duration: 6000,
          });
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

      {/* Big red trigger button */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-destructive" />
            Emergency Alert
          </CardTitle>
          <CardDescription>
            Sends an immediate alert to all connected drivers within 50 km. Limited to 3 per 10 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            variant="destructive"
            className="w-full h-16 text-lg font-bold"
            disabled={sendingSignal}
            onClick={triggerStressSignal}
          >
            {sendingSignal ? (
              <Loader2 className="h-6 w-6 mr-2 animate-spin" />
            ) : (
              <AlertTriangle className="h-6 w-6 mr-2" />
            )}
            {sendingSignal ? "Sending…" : "SEND STRESS SIGNAL"}
          </Button>
        </CardContent>
      </Card>

      {/* Live alerts (real-time, this session) */}
      {liveAlerts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Live Alerts (This Session)</h2>
          <div className="space-y-2">
            {liveAlerts.map((alert) => (
              <StressSignalBadge key={alert.id} signal={alert} isAlert />
            ))}
          </div>
        </div>
      )}

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
