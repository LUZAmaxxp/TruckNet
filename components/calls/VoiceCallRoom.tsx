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
    ? "text-destructive"
    : isReconnecting
    ? "text-yellow-400"
    : "text-zinc-400";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        <div className="w-28 h-28 rounded-full bg-zinc-800 flex items-center justify-center border-4 border-zinc-700 shadow-2xl">
          <span className="text-5xl">👤</span>
        </div>

        <div className="text-center">
          <p className={`text-sm mb-1 ${statusColor}`}>{statusText}</p>
          <h1 className="text-2xl font-semibold">Voice Call</h1>
        </div>

        {isMicMuted && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/20 text-destructive text-sm">
            <MicOff className="w-4 h-4" />
            Microphone muted
          </div>
        )}
      </div>

      {/* Connecting / reconnecting overlay */}
      {(!isConnected || isReconnecting) && !connectionError && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 z-10">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-zinc-300">{statusText}</p>
          </div>
        </div>
      )}

      {/* Hard failure overlay */}
      {connectionError && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 z-10">
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <p className="text-destructive text-base font-medium">{connectionError}</p>
            <button
              onClick={onEnd}
              className="px-6 py-2 bg-destructive text-white rounded-lg text-sm font-medium"
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
