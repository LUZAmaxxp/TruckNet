"use client";

import { MicOff, Loader2 } from "lucide-react";
import { useLiveKitRoom } from "@/hooks/useLiveKitRoom";
import { CallControls } from "@/components/calls/CallControls";

export interface VoiceCallRoomProps {
  token: string;
  liveKitUrl: string;
  roomName: string;
  onEnd: () => void;
}

export default function VoiceCallRoom({
  token,
  liveKitUrl,
  roomName,
  onEnd,
}: VoiceCallRoomProps) {
  const {
    isConnected,
    isReconnecting,
    connectionError,
    retryCount,
    toggleMic,
    isMicMuted,
  } = useLiveKitRoom({
    liveKitUrl,
    token,
    roomName,
    audioOnly: true,
    onDisconnected: onEnd,
  });

  const statusText = connectionError
    ? connectionError
    : isReconnecting
    ? "Reconnecting…"
    : !isConnected
    ? retryCount > 0
      ? `Retrying (${retryCount}/3)…`
      : "Connecting…"
    : "Connected";

  const statusColor = connectionError
    ? "var(--terra)"
    : isReconnecting
    ? "var(--honey)"
    : "var(--muted)"

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--base)" }}>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        {/* Avatar with ring-expand animation */}
        <div className="relative flex items-center justify-center">
          <div className="animate-ring-expand absolute w-[164px] h-[164px] rounded-full border-2" style={{ borderColor: "rgba(28,58,94,0.15)" }} />
          <div className="animate-ring-expand-delay-1 absolute w-[164px] h-[164px] rounded-full border-2" style={{ borderColor: "rgba(28,58,94,0.10)" }} />
          <div className="animate-ring-expand-delay-2 absolute w-[164px] h-[164px] rounded-full border-2" style={{ borderColor: "rgba(28,58,94,0.06)" }} />
          <div
            className="relative w-28 h-28 rounded-full flex items-center justify-center border-4 shadow-lg"
            style={{ background: "var(--navy-lt)", borderColor: "var(--navy-pale)" }}
          >
            <span className="font-display text-5xl font-bold" style={{ color: "var(--navy)" }}>👤</span>
          </div>
        </div>

        <div className="text-center">
          <p className="font-mono text-[11px] mb-1" style={{ color: statusColor }}>{statusText}</p>
          <h1 className="font-display text-[24px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>Voice Call</h1>
        </div>

        {isMicMuted && (
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-[20px] font-body text-[13px] font-medium"
            style={{ background: "var(--terra-lt)", color: "var(--terra)" }}
          >
            <MicOff className="w-4 h-4" />
            Microphone muted
          </div>
        )}
      </div>

      {/* Connecting / reconnecting overlay */}
      {(!isConnected || isReconnecting) && !connectionError && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: "rgba(247,245,241,0.85)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--navy)" }} />
            <p className="font-mono text-[11px]" style={{ color: "var(--subtle)" }}>{statusText}</p>
          </div>
        </div>
      )}

      {/* Hard failure overlay */}
      {connectionError && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: "rgba(247,245,241,0.92)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="flex flex-col items-center gap-4 px-8 py-6 text-center"
            style={{ background: "var(--surface)", borderRadius: "var(--radius-xl)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-lg)" }}
          >
            <p className="font-body text-[14px] font-medium" style={{ color: "var(--terra)" }}>{connectionError}</p>
            <button
              onClick={onEnd}
              className="px-5 py-[9px] font-body text-[13px] font-semibold rounded-[8px] transition-colors"
              style={{ background: "var(--terra)", color: "white" }}
            >
              Go back
            </button>
          </div>
        </div>
      )}

      <CallControls
        audioOnly
        isMicMuted={isMicMuted}
        isCameraOff
        onToggleMic={() => void toggleMic()}
        onToggleCamera={() => undefined}
        onEndCall={onEnd}
        className="relative z-20"
      />
    </div>
  );
}
