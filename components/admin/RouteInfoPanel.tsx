"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flag, Route, Clock, Navigation2, X, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActiveRoute } from "@/schemas/route.schema";
import { formatEta } from "@/lib/osrm";

interface RouteInfoPanelProps {
  route: ActiveRoute;
  driverName: string;
  driverAvatar?: string | null;
  onClose: () => void;
}

/**
 * RouteInfoPanel — floating admin card showing a single driver's active route stats.
 * Shows: driver name, destination, distance/duration/ETA, a progress indicator.
 */
export function RouteInfoPanel({
  route,
  driverName,
  driverAvatar,
  onClose,
}: RouteInfoPanelProps) {
  const [etaLabel, setEtaLabel] = useState(route.etaLabel);

  // ETA countdown — refresh every 30 seconds
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

  // Progress: elapsed / total duration clamped to [0, 1]
  const elapsed = (Date.now() - new Date(route.createdAt).getTime()) / 1000;
  const progress = Math.min(1, elapsed / route.durationSeconds);
  const progressPct = Math.round(progress * 100);

  return (
    <motion.div
      key={route.id}
      className="absolute top-3 right-3 z-[1000] w-72"
      initial={{ opacity: 0, x: 30, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 30, scale: 0.95 }}
      transition={{ type: "spring", damping: 24, stiffness: 280 }}
    >
      <div className="rounded-2xl border bg-background/97 backdrop-blur-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            {driverAvatar ? (
              <img
                src={driverAvatar}
                alt={driverName}
                className="h-7 w-7 rounded-full object-cover shrink-0 border"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-[var(--navy,#1e3a5f)] flex items-center justify-center shrink-0">
                <Truck className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{driverName}</p>
              <p className="text-[10px] text-muted-foreground">On Route</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Destination */}
        <div className="px-4 pt-2.5 pb-2">
          <div className="flex items-start gap-1.5">
            <Flag className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--terra)]" />
            <p className="text-xs text-foreground leading-snug line-clamp-2">
              {route.destinationLabel}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x px-0 border-t border-b">
          <div className="flex flex-col items-center gap-0.5 py-2.5 px-1">
            <Route className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-bold">{route.distanceLabel}</span>
            <span className="text-[10px] text-muted-foreground">Distance</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 py-2.5 px-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-bold">{route.durationLabel}</span>
            <span className="text-[10px] text-muted-foreground">Duration</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 py-2.5 px-1">
            <Navigation2 className="h-3.5 w-3.5 text-[var(--terra)]" />
            <span className="text-xs font-bold">{etaLabel}</span>
            <span className="text-[10px] text-muted-foreground">ETA</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-muted-foreground">Route progress</span>
            <span className="text-[10px] font-medium text-foreground">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--slate,#64748b)] rounded-full transition-all duration-1000"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
