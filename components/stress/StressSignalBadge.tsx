"use client";

import { AlertTriangle, MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StressSignalData {
  id: string;
  userId: string;
  senderName?: string;
  latitude: number;
  longitude: number;
  createdAt: string | Date;
  distanceKm?: number | null;
}

interface StressSignalBadgeProps {
  signal: StressSignalData;
  /** Whether this is an incoming real-time alert (shows red pulse animation). */
  isAlert?: boolean;
}

export function StressSignalBadge({ signal, isAlert }: StressSignalBadgeProps) {
  const createdAt = new Date(signal.createdAt);
  const minutesAgo = Math.round((Date.now() - createdAt.getTime()) / 60_000);
  const timeLabel = minutesAgo < 1 ? "just now" : `${minutesAgo}m ago`;

  const distanceLabel =
    signal.distanceKm != null
      ? signal.distanceKm < 1
        ? `${Math.round(signal.distanceKm * 1000)} m away`
        : `${signal.distanceKm.toFixed(1)} km away`
      : null;

  return (
    <Card
      className={cn(
        "w-full border-destructive/40",
        isAlert && "animate-pulse border-destructive"
      )}
    >
      <CardContent className="flex items-start gap-3 py-3 px-4">
        {/* Icon */}
        <div
          className={cn(
            "mt-0.5 shrink-0 rounded-full p-1.5",
            isAlert ? "bg-destructive/20" : "bg-muted"
          )}
        >
          <AlertTriangle
            className={cn("h-4 w-4", isAlert ? "text-destructive" : "text-muted-foreground")}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {signal.senderName ?? `Driver ${signal.userId.slice(0, 8)}`}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {signal.latitude.toFixed(4)}, {signal.longitude.toFixed(4)}
            </span>
            {distanceLabel && (
              <span className="text-xs text-muted-foreground">{distanceLabel}</span>
            )}
          </div>
        </div>

        {/* Time + status */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeLabel}
          </span>
          {isAlert ? (
            <Badge variant="destructive" className="text-xs">LIVE</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">Active</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
