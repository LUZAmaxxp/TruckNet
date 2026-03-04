"use client";

import { Phone, Video } from "lucide-react";
import { useCallState } from "@/hooks/useCallState";
import { cn } from "@/lib/utils";

interface CallButtonProps {
  /** UUID of the friend to call */
  friendId: string;
  /** Voice or video call */
  variant: "voice" | "video";
  className?: string;
}

/**
 * CallButton
 *
 * Renders a voice or video call initiation button.
 * Disabled while already on an active call.
 * Shows as a small icon button — intended for use in message thread headers.
 */
export function CallButton({ friendId, variant, className }: CallButtonProps) {
  const { initiateCall, activeCall } = useCallState();

  const isOnCall = !!activeCall;

  const handleClick = () => {
    void initiateCall(friendId, variant);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isOnCall}
      title={isOnCall ? "Already on a call" : variant === "voice" ? "Voice call" : "Video call"}
      className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full transition-all",
        "bg-primary/10 hover:bg-primary/20 text-primary",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "active:scale-95",
        className
      )}
      aria-label={variant === "voice" ? "Start voice call" : "Start video call"}
    >
      {variant === "voice" ? (
        <Phone className="w-4 h-4" />
      ) : (
        <Video className="w-4 h-4" />
      )}
    </button>
  );
}
