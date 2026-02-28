"use client";

import { MapPin, MessageSquare, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NearbyDriverEntry } from "@/sockets/types";

interface DriverCardProps {
  driver: NearbyDriverEntry & { distanceKm?: number; name?: string };
  onSendMessage?: (driverId: string) => void;
  onSendStress?: () => void;
}

export function DriverCard({ driver, onSendMessage, onSendStress }: DriverCardProps) {
  const distanceLabel = driver.distanceKm != null
    ? driver.distanceKm < 1
      ? `${Math.round(driver.distanceKm * 1000)} m`
      : `${driver.distanceKm.toFixed(1)} km`
    : null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base truncate">
            {driver.name ?? `Driver ${driver.userId.slice(0, 8)}`}
          </CardTitle>
          {distanceLabel && (
            <Badge variant="secondary" className="shrink-0">
              <MapPin className="h-3 w-3 mr-1" />
              {distanceLabel}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          {driver.latitude.toFixed(5)}, {driver.longitude.toFixed(5)}
        </p>
        <div className="flex gap-2">
          {onSendMessage && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onSendMessage(driver.userId)}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Message
            </Button>
          )}
          {onSendStress && (
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={onSendStress}
            >
              <AlertTriangle className="h-4 w-4 mr-1" />
              Alert
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
