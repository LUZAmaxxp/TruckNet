"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";
import type { CallIncomingAlert, CallDeclinedAlert, CallEndedAlert } from "@/sockets/types";

// ---------------------------------------------------------------------------
// sessionStorage helpers — survive the React async-state / router.push race
// ---------------------------------------------------------------------------
const SESSION_KEY = "trucknet_active_call";

function saveCallToSession(call: ActiveCall): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(call));
  } catch { /* ignore */ }
}

function loadCallFromSession(): ActiveCall | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveCall;
    // JSON.parse converts Date objects to ISO strings — coerce back to Date.
    if (parsed.startedAt) {
      parsed.startedAt = new Date(parsed.startedAt as unknown as string);
    }
    return parsed;
  } catch { return null; }
}

function clearCallFromSession(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CallType = "voice" | "video";

export interface ActiveCall {
  roomName: string;
  type: CallType;
  /** LiveKit server WebSocket URL (server-provided) */
  liveKitUrl: string;
  /** Signed JWT scoped to this room */
  token?: string;
  /** Caller or callee role */
  role: "caller" | "callee";
  /** Wall-clock time when the call session started (callee joined) */
  startedAt?: Date;
}

export interface IncomingCall extends CallIncomingAlert {}

interface CallStateContextValue {
  /** The currently active call, or null if idle */
  activeCall: ActiveCall | null;
  /** Incoming call ringing, waiting for accept/decline */
  incomingCall: IncomingCall | null;
  /** Initiate an outgoing call to a friend */
  initiateCall: (calleeId: string, type: CallType) => Promise<void>;
  /** Accept the current incoming call */
  acceptCall: () => Promise<void>;
  /** Decline the current incoming call */
  declineCall: () => Promise<void>;
  /** End the currently active call */
  endCall: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CallStateContext = createContext<CallStateContextValue | null>(null);

export function useCallState(): CallStateContextValue {
  const ctx = useContext(CallStateContext);
  if (!ctx) throw new Error("useCallState must be used inside <CallStateProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CallStateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { on } = useSocket();

  // Restore from sessionStorage so the call page always has state even if
  // the Provider re-mounts due to React's async render / navigation race.
  const [activeCall, setActiveCallState] = useState<ActiveCall | null>(() => {
    if (typeof window === "undefined") return null;
    return loadCallFromSession();
  });
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  // Wrap setActiveCall to keep sessionStorage in sync
  const setActiveCall = useCallback((call: ActiveCall | null) => {
    setActiveCallState(call);
    if (call) saveCallToSession(call);
    else clearCallFromSession();
  }, []);

  // Keep a ref to activeCall for use inside stable callbacks
  const activeCallRef = useRef<ActiveCall | null>(null);
  activeCallRef.current = activeCall;

  // ── Ably event listeners ─────────────────────────────────────────────

  useEffect(() => {
    const unsubIncoming = on("call_incoming", (payload: CallIncomingAlert) => {
      // Ignore if already on a call
      if (activeCallRef.current) {
        // Auto-decline on behalf of the user
        void fetch(`/api/calls/${payload.roomName}/decline`, { method: "PATCH" });
        return;
      }
      setIncomingCall(payload);
    });

    const unsubDeclined = on("call_declined", (_payload: CallDeclinedAlert) => {
      setActiveCall(null);
      toast.info("Call was declined");
    });

    const unsubEnded = on("call_ended", (payload: CallEndedAlert) => {
      setActiveCall(null);
      const mins = payload.duration ? Math.floor(payload.duration / 60) : 0;
      const secs = payload.duration ? payload.duration % 60 : 0;
      toast.info(
        payload.duration
          ? `Call ended — ${mins}m ${secs}s`
          : "Call ended"
      );
      router.push("/messages");
    });

    return () => {
      unsubIncoming();
      unsubDeclined();
      unsubEnded();
    };
  }, [on, router]);

  // ── Actions ──────────────────────────────────────────────────────────

  const initiateCall = useCallback(
    async (calleeId: string, type: CallType) => {
      try {
        const res = await fetch("/api/calls/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calleeId, type }),
        });

        if (!res.ok) {
          const { error } = (await res.json()) as { error: string };
          toast.error(error ?? "Failed to start call");
          return;
        }

        const { roomName, token, liveKitUrl } = (await res.json()) as {
          roomName: string;
          token: string;
          liveKitUrl: string;
        };

        const call: ActiveCall = { roomName, type, token, liveKitUrl, role: "caller" };
        // Save synchronously BEFORE navigation so the call page finds state
        // even if the Provider re-renders before React commits the useState update.
        saveCallToSession(call);
        setActiveCall(call);
        router.push(`/calls/${roomName}?type=${type}`);
      } catch {
        toast.error("Failed to start call. Please try again.");
      }
    },
    [router]
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    const { roomName, type, liveKitUrl, calleeToken } = incomingCall;

    try {
      // Use the token that was pre-generated by the initiate route and
      // delivered via Ably — no additional round-trip needed.
      let token = calleeToken;

      // Fallback: if for any reason the pre-generated token is missing,
      // fetch it from the token API.
      if (!token) {
        const res = await fetch(`/api/calls/token/${roomName}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Token fetch failed");
        }
        const data = (await res.json()) as { token: string; liveKitUrl: string };
        token = data.token;
      }

      setActiveCall({
        roomName,
        type,
        token,
        liveKitUrl,
        role: "callee",
        startedAt: new Date(),
      });
      setIncomingCall(null);
      router.push(`/calls/${roomName}?type=${type}`);
    } catch (error) {
      console.error("[acceptCall] Failed to join call:", error);
      // Clean up the room server-side so the caller isn\'t left hanging
      await fetch(`/api/calls/${roomName}`, { method: "DELETE" }).catch(() => {});
      toast.error("Failed to join the call");
      setIncomingCall(null);
    }
  }, [incomingCall, router]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;
    const { roomName } = incomingCall;
    setIncomingCall(null);

    try {
      await fetch(`/api/calls/${roomName}/decline`, { method: "PATCH" });
    } catch {
      // Best-effort
    }
  }, [incomingCall]);

  const endCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) return;

    setActiveCall(null);
    try {
      await fetch(`/api/calls/${call.roomName}`, { method: "DELETE" });
    } catch {
      // Best-effort
    }
    router.push("/messages");
  }, [router]);

  return (
    <CallStateContext.Provider
      value={{ activeCall, incomingCall, initiateCall, acceptCall, declineCall, endCall }}
    >
      {children}
    </CallStateContext.Provider>
  );
}
