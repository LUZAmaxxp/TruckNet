"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCallState } from "@/hooks/useCallState";

interface CallRoomPageProps {
  params: { roomName: string };
}

// ---------------------------------------------------------------------------
// Lazy-loaded call rooms — defers the LiveKit SDK (~400 KB) and
// @livekit/components-styles from the initial page bundle.
// ---------------------------------------------------------------------------
const VoiceCallRoom = dynamic(
  () => import("@/components/calls/VoiceCallRoom"),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

const VideoCallRoom = dynamic(
  () => import("@/components/calls/VideoCallRoom"),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

// ---------------------------------------------------------------------------
// Helper: read token / liveKitUrl from either React state or sessionStorage
// (guards against the React async-state / router.push race).
// ---------------------------------------------------------------------------
function useCallCredentials() {
  const { activeCall } = useCallState();

  const fromSession = (() => {
    if (typeof window === "undefined") return { token: undefined, liveKitUrl: undefined };
    try {
      const raw = sessionStorage.getItem("trucknet_active_call");
      if (!raw) return { token: undefined, liveKitUrl: undefined };
      const parsed = JSON.parse(raw) as { token?: string; liveKitUrl?: string };
      return { token: parsed.token, liveKitUrl: parsed.liveKitUrl };
    } catch {
      return { token: undefined, liveKitUrl: undefined };
    }
  })();

  return {
    token: activeCall?.token ?? fromSession.token,
    liveKitUrl: activeCall?.liveKitUrl ?? fromSession.liveKitUrl ?? "",
  };
}

// ---------------------------------------------------------------------------
// Page entry point
// ---------------------------------------------------------------------------
function CallRoomPageInner({ params }: CallRoomPageProps) {
  const { roomName } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const callType = (searchParams.get("type") as "voice" | "video") ?? "voice";

  const { endCall } = useCallState();
  const { token, liveKitUrl } = useCallCredentials();

  // Guard: if no token after a short settle delay, go back.
  useEffect(() => {
    if (token) return;
    const t = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem("trucknet_active_call");
        const stored = raw ? (JSON.parse(raw) as { token?: string }).token : null;
        if (!stored) router.push("/messages");
      } catch {
        router.push("/messages");
      }
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!token) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleEnd = () => void endCall();

  if (callType === "video") {
    return <VideoCallRoom token={token} liveKitUrl={liveKitUrl} roomName={roomName} onEnd={handleEnd} />;
  }

  return <VoiceCallRoom token={token} liveKitUrl={liveKitUrl} roomName={roomName} onEnd={handleEnd} />;
}

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
  </div>
);

export default function CallRoomPage(props: CallRoomPageProps) {
  return (
    <Suspense fallback={<Spinner />}>
      <CallRoomPageInner {...props} />
    </Suspense>
  );
}
