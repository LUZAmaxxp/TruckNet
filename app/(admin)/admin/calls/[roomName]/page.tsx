"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface AdminCallRoomPageProps {
  params: { roomName: string };
}

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

// Read token from sessionStorage (written by admin call initiator)
function useAdminCallCredentials() {
  if (typeof window === "undefined") return { token: undefined, liveKitUrl: "" };
  try {
    const raw = sessionStorage.getItem("trucknet_active_call");
    if (!raw) return { token: undefined, liveKitUrl: "" };
    const parsed = JSON.parse(raw) as { token?: string; liveKitUrl?: string };
    return { token: parsed.token, liveKitUrl: parsed.liveKitUrl ?? "" };
  } catch {
    return { token: undefined, liveKitUrl: "" };
  }
}

function AdminCallRoomPageInner({ params }: AdminCallRoomPageProps) {
  const { roomName } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const callType = (searchParams.get("type") as "voice" | "video") ?? "voice";

  const { token, liveKitUrl } = useAdminCallCredentials();

  // Guard: if no token after a short settle delay, return to admin
  useEffect(() => {
    if (token) return;
    const t = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem("trucknet_active_call");
        const stored = raw ? (JSON.parse(raw) as { token?: string }).token : null;
        if (!stored) router.push("/admin");
      } catch {
        router.push("/admin");
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

  const handleEnd = async () => {
    try {
      sessionStorage.removeItem("trucknet_active_call");
      await fetch(`/api/calls/${roomName}`, { method: "DELETE" });
    } catch {
      // best-effort
    }
    router.push("/admin");
  };

  if (callType === "video") {
    return (
      <VideoCallRoom
        token={token}
        liveKitUrl={liveKitUrl}
        roomName={roomName}
        onEnd={() => void handleEnd()}
      />
    );
  }

  return (
    <VoiceCallRoom
      token={token}
      liveKitUrl={liveKitUrl}
      roomName={roomName}
      onEnd={() => void handleEnd()}
    />
  );
}

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
  </div>
);

export default function AdminCallRoomPage(props: AdminCallRoomPageProps) {
  return (
    <Suspense fallback={<Spinner />}>
      <AdminCallRoomPageInner {...props} />
    </Suspense>
  );
}
