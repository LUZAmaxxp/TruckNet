"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flag, Loader2, Navigation2, Clock, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DestinationSearchInput } from "./DestinationSearchInput";
import type { GeocodeResult } from "@/schemas/route.schema";
import type { ActiveRoute } from "@/schemas/route.schema";

interface RouteSetupModalProps {
  open: boolean;
  onClose: () => void;
  /** Driver's current GPS location */
  currentPosition: { lat: number; lng: number } | null;
  onRouteSet: (route: ActiveRoute) => void;
}

type Step = "search" | "preview" | "loading";

/**
 * Modal for setting a navigation destination.
 * Steps: 1. Search → 2. Preview (with OSRM stats) → 3. Confirm → done
 */
export function RouteSetupModal({
  open,
  onClose,
  currentPosition,
  onRouteSet,
}: RouteSetupModalProps) {
  const [step, setStep] = useState<Step>("search");
  const [selectedPlace, setSelectedPlace] = useState<GeocodeResult | null>(null);
  const [preview, setPreview] = useState<ActiveRoute | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("search");
    setSelectedPlace(null);
    setPreview(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  async function handleSelectPlace(place: GeocodeResult) {
    if (!currentPosition) {
      setError("Your location is not available yet. Please enable GPS and try again.");
      return;
    }
    setSelectedPlace(place);
    setError(null);
    setStep("loading");

    try {
      const res = await fetch("/api/drivers/route?preview=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originLat: currentPosition.lat,
          originLng: currentPosition.lng,
          destinationLat: place.lat,
          destinationLng: place.lng,
          destinationLabel: place.displayName,
        }),
      });

      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error?: string };
        throw new Error(msg ?? "Route preview failed");
      }

      const preview = (await res.json()) as ActiveRoute;
      setPreview(preview);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not compute route");
      setStep("search");
    }
  }

  async function handleConfirm() {
    if (!preview || !currentPosition || !selectedPlace) return;
    setStep("loading");
    setError(null);

    try {
      const res = await fetch("/api/drivers/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originLat: currentPosition.lat,
          originLng: currentPosition.lng,
          destinationLat: selectedPlace.lat,
          destinationLng: selectedPlace.lng,
          destinationLabel: selectedPlace.displayName,
        }),
      });

      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error?: string };
        throw new Error(msg ?? "Failed to save route");
      }

      const json = (await res.json()) as { route: ActiveRoute };
      onRouteSet(json.route);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save route");
      setStep("preview");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal panel */}
          <motion.div
            className="fixed inset-x-4 bottom-4 z-[1600] rounded-2xl bg-background shadow-2xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[440px]"
            initial={{ opacity: 0, y: 80, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-[var(--terra)]" />
                <h2 className="font-semibold text-base">Set Destination</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {(step === "search" || step === "loading") && (
                <>
                  {!currentPosition && (
                    <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                      Waiting for your GPS location…
                    </p>
                  )}
                  <DestinationSearchInput
                    onSelect={(place) => void handleSelectPlace(place)}
                    autoFocus
                    dropUp
                  />
                  {step === "loading" && (
                    <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Computing route…
                    </div>
                  )}
                </>
              )}

              {step === "preview" && preview && (
                <>
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground line-clamp-2">
                      {preview.destinationLabel}
                    </p>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center gap-1 rounded-lg bg-background p-2.5 shadow-sm">
                        <Route className="h-4 w-4 text-[var(--navy)]" />
                        <span className="text-xs font-semibold">{preview.distanceLabel}</span>
                        <span className="text-[10px] text-muted-foreground">Distance</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-lg bg-background p-2.5 shadow-sm">
                        <Clock className="h-4 w-4 text-[var(--navy)]" />
                        <span className="text-xs font-semibold">{preview.durationLabel}</span>
                        <span className="text-[10px] text-muted-foreground">Duration</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-lg bg-background p-2.5 shadow-sm">
                        <Navigation2 className="h-4 w-4 text-[var(--terra)]" />
                        <span className="text-xs font-semibold">{preview.etaLabel}</span>
                        <span className="text-[10px] text-muted-foreground">Arrival</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setStep("search");
                        setSelectedPlace(null);
                        setPreview(null);
                      }}
                    >
                      Change
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-[var(--navy)] hover:bg-[var(--navy)]/90 text-white"
                      onClick={() => void handleConfirm()}
                    >
                      <Flag className="h-3.5 w-3.5 mr-1.5" />
                      Start Navigation
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
