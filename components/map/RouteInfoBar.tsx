"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, Clock, Route, Navigation2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActiveRoute } from "@/schemas/route.schema";
import { formatEta } from "@/lib/osrm";

interface RouteInfoBarProps {
  route: ActiveRoute;
  onClearRoute: () => void;
}

/**
 * RouteInfoBar — floating bottom bar shown while the driver has an active route.
 * Displays: distance · duration · live ETA countdown · clear button
 */
export function RouteInfoBar({ route, onClearRoute }: RouteInfoBarProps) {
  const [etaLabel, setEtaLabel] = useState<string>(route.etaLabel);
  const [clearing, setClearing] = useState(false);

  // Update ETA label every minute based on stored etaIso
  useEffect(() => {
    function tick() {
      const remaining = (new Date(route.etaIso).getTime() - Date.now()) / 1000;
      if (remaining <= 0) {
        setEtaLabel("Arriving");
        return;
      }
      setEtaLabel(formatEta(route.etaIso));
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [route.etaIso]);

  const handleClear = useCallback(async () => {
    setClearing(true);
    try {
      await fetch("/api/drivers/route?reason=cancelled", { method: "DELETE" });
    } catch {
      // parent state cleared regardless
    }
    onClearRoute();
  }, [onClearRoute]);

  return (
    <AnimatePresence>
      <motion.div
        key="route-info-bar"
        className="absolute bottom-3 left-3 right-3 z-[1000] sm:left-3 sm:right-auto sm:w-[340px]"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
      >
        <div className="rounded-2xl border-0 bg-[var(--navy)]/95 backdrop-blur-md shadow-2xl text-white px-4 py-3">
          {/* Destination label */}
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Flag className="h-4 w-4 shrink-0 text-[var(--terra)]" />
              <p className="text-sm font-medium leading-tight line-clamp-1">
                {route.destinationLabel}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => void handleClear()}
              disabled={clearing}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 divide-x divide-white/20">
            <div className="flex flex-col items-center gap-0.5 pr-2">
              <Route className="h-3.5 w-3.5 text-white/70" />
              <span className="text-xs font-bold">{route.distanceLabel}</span>
              <span className="text-[10px] text-white/60">Distance</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-2">
              <Clock className="h-3.5 w-3.5 text-white/70" />
              <span className="text-xs font-bold">{route.durationLabel}</span>
              <span className="text-[10px] text-white/60">Duration</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 pl-2">
              <Navigation2 className="h-3.5 w-3.5 text-[var(--terra)]" />
              <span className="text-xs font-bold">{etaLabel}</span>
              <span className="text-[10px] text-white/60">ETA</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
