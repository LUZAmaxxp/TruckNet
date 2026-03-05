"use client";

import { AlertTriangle, MapPin, Clock, Video, MessageSquare, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const router = useRouter();
  const [calling, setCalling] = useState(false);

  const createdAt = new Date(signal.createdAt);
  const minutesAgo = Math.round((Date.now() - createdAt.getTime()) / 60_000);
  const timeLabel = minutesAgo < 1 ? "just now" : `${minutesAgo}m ago`;

  const distanceLabel =
    signal.distanceKm != null
      ? signal.distanceKm < 1
        ? `${Math.round(signal.distanceKm * 1000)} m away`
        : `${signal.distanceKm.toFixed(1)} km away`
      : null;

  const handleVideoCall = async () => {
    setCalling(true);
    try {
      const res = await fetch("/api/calls/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calleeId: signal.userId, type: "video" }),
      });
      const json = (await res.json()) as { error?: string; roomName?: string; token?: string; liveKitUrl?: string };
      if (!res.ok || !json.roomName) {
        toast.error(json.error ?? "Failed to start video call");
        return;
      }
      sessionStorage.setItem(
        "trucknet_active_call",
        JSON.stringify({ roomName: json.roomName, type: "video", token: json.token, liveKitUrl: json.liveKitUrl, role: "caller" })
      );
      router.push(`/calls/${json.roomName}?type=video`);
    } catch {
      toast.error("Could not start video call. Please try again.");
    } finally {
      setCalling(false);
    }
  };

  const handleMessage = () => {
    router.push(`/messages?with=${signal.userId}`);
  };

  const handleViewOnMap = () => {
    router.push(`/map?focus=${signal.userId}`);
  };

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

          {/* Action buttons */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <button
              onClick={() => void handleVideoCall()}
              disabled={calling}
              title="Video call this driver"
              className="flex items-center gap-1 rounded-[8px] px-2.5 py-1 font-body text-[12px] font-semibold transition-colors disabled:opacity-50"
              style={{ background: "var(--navy-lt)", color: "var(--navy)" }}
            >
              {calling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Video className="h-3 w-3" />}
              Call
            </button>
            <button
              onClick={handleMessage}
              title="Message this driver"
              className="flex items-center gap-1 rounded-[8px] px-2.5 py-1 font-body text-[12px] font-semibold transition-colors"
              style={{ background: "var(--slate-lt)", color: "var(--slate)" }}
            >
              <MessageSquare className="h-3 w-3" />
              Message
            </button>
            <button
              onClick={handleViewOnMap}
              title="View driver on map"
              className="flex items-center gap-1 rounded-[8px] px-2.5 py-1 font-body text-[12px] font-semibold transition-colors"
              style={{ background: "var(--base)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
            >
              <MapPin className="h-3 w-3" />
              Location
            </button>
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

