"use client";

// @livekit/components-styles is imported HERE (not in the page) so that the
// ~50 KB CSS bundle is only downloaded when the user opens a video call.
import "@livekit/components-styles";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";

export interface VideoCallRoomProps {
  token: string;
  liveKitUrl: string;
  roomName: string;
  onEnd: () => void;
}

export default function VideoCallRoom({
  token,
  liveKitUrl,
  onEnd,
}: VideoCallRoomProps) {
  return (
    <LiveKitRoom
      serverUrl={liveKitUrl}
      token={token}
      connect
      audio
      video
      onDisconnected={onEnd}
      // data-lk-theme enables LiveKit CSS variables — required for
      // VideoConference layout and the built-in hang-up ControlBar.
      data-lk-theme="default"
      style={{ height: "100dvh", position: "fixed", inset: 0, zIndex: 50 }}
    >
      {/*
        VideoConference must be a direct child of LiveKitRoom with no
        overflow-hidden wrapper, otherwise the ControlBar (hang-up button)
        is clipped off-screen.
      */}
      <VideoConference />
    </LiveKitRoom>
  );
}
