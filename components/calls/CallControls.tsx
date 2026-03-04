"use client";

import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallControlsProps {
  /** Voice-only mode — hides camera toggle */
  audioOnly?: boolean;
  isMicMuted: boolean;
  isCameraOff: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
  className?: string;
}

/**
 * CallControls
 *
 * Bottom control bar for active calls.
 * Renders: mute, camera toggle (video only), end call.
 * All buttons are at minimum 48×48 px for mobile accessibility.
 */
export function CallControls({
  audioOnly = false,
  isMicMuted,
  isCameraOff,
  onToggleMic,
  onToggleCamera,
  onEndCall,
  className,
}: CallControlsProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-6 px-8 py-6 rounded-t-2xl",
        className
      )}
      style={{
        background: "rgba(247,245,241,0.92)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      {/* Mute/Unmute mic */}
      <ControlButton
        onClick={onToggleMic}
        active={isMicMuted}
        activeLabel="Unmute"
        inactiveLabel="Mute"
        activeIcon={<MicOff className="w-6 h-6" />}
        inactiveIcon={<Mic className="w-6 h-6" />}
        destructive={isMicMuted}
      />

      {/* Camera toggle — video calls only */}
      {!audioOnly && (
        <ControlButton
          onClick={onToggleCamera}
          active={isCameraOff}
          activeLabel="Camera on"
          inactiveLabel="Camera off"
          activeIcon={<VideoOff className="w-6 h-6" />}
          inactiveIcon={<Video className="w-6 h-6" />}
          destructive={isCameraOff}
        />
      )}

      {/* End call */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          onClick={onEndCall}
          className="w-14 h-14 rounded-full active:scale-95 transition-all flex items-center justify-center shadow-md"
          style={{ background: "var(--terra)", color: "white" }}
          aria-label="End call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
        <span className="font-mono text-[10px]" style={{ color: "var(--subtle)" }}>End</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

interface ControlButtonProps {
  onClick: () => void;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  destructive?: boolean;
}

function ControlButton({
  onClick,
  active,
  activeLabel,
  inactiveLabel,
  activeIcon,
  inactiveIcon,
  destructive,
}: ControlButtonProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md",
          active && destructive
            ? undefined
            : undefined
        )}
        aria-label={active ? activeLabel : inactiveLabel}
        style={
          active && destructive
            ? { background: "var(--terra-lt)", color: "var(--terra)" }
            : { background: "var(--base)", border: "1px solid var(--hairline)", color: "var(--ink)" }
        }
      >
        {active ? activeIcon : inactiveIcon}
      </button>
      <span className="font-mono text-[10px]" style={{ color: "var(--subtle)" }}>
        {active ? activeLabel : inactiveLabel}
      </span>
    </div>
  );
}
