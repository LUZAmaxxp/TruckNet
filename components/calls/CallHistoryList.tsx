"use client";

import { PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react";
import { cn } from "@/lib/utils";
import { CallButton } from "@/components/calls/CallButton";

export interface CallHistoryEntry {
  id: string;
  roomName: string;
  callType: "voice" | "video";
  status: "completed" | "missed" | "declined" | "ongoing";
  durationSeconds: number | null;
  createdAt: string;
  callerId: string | null;
  calleeId: string | null;
  callerName: string | null;
  calleeName: string | null;
}

interface CallHistoryListProps {
  calls: CallHistoryEntry[];
  /** The current user's ID — used to determine call direction */
  currentUserId: string;
  /** Friend's ID for re-dial buttons */
  friendId: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString();
}

/**
 * CallHistoryList
 *
 * Renders a list of past calls with direction arrow, duration, and quick re-dial buttons.
 * Intended to be embedded in a message thread alongside text/voice messages.
 */
export function CallHistoryList({ calls, currentUserId, friendId }: CallHistoryListProps) {
  if (calls.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 py-2">
      <p className="text-xs text-muted-foreground px-1">Call history</p>
      {calls.map((call) => {
        const isOutgoing = call.callerId === currentUserId;
        const missed = call.status === "missed" || call.status === "declined";

        return (
          <div
            key={call.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            {/* Direction icon */}
            <div
              className={cn(
                "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
                missed
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              )}
            >
              {missed ? (
                <PhoneMissed className="w-4 h-4" />
              ) : isOutgoing ? (
                <PhoneOutgoing className="w-4 h-4" />
              ) : (
                <PhoneIncoming className="w-4 h-4" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {isOutgoing ? "Outgoing" : "Incoming"}{" "}
                {call.callType === "video" ? "video" : "voice"} call
              </p>
              <p className="text-xs text-muted-foreground">
                {formatTime(call.createdAt)}
                {call.durationSeconds ? ` · ${formatDuration(call.durationSeconds)}` : ""}
              </p>
            </div>

            {/* Re-dial */}
            <CallButton
              friendId={friendId}
              variant={call.callType}
              className="flex-shrink-0 w-9 h-9"
            />
          </div>
        );
      })}
    </div>
  );
}
