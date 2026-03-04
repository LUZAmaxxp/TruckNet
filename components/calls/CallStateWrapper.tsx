"use client";

import { CallStateProvider, useCallState } from "@/hooks/useCallState";
import { IncomingCallModal } from "@/components/calls/IncomingCallModal";
import { ActiveCallBadge } from "@/components/calls/ActiveCallBadge";

/**
 * Inner component: reads call state from context to render modal + badge.
 * Must be a child of CallStateProvider.
 */
function CallUI({ children }: { children: React.ReactNode }) {
  const { incomingCall, acceptCall, declineCall } = useCallState();

  return (
    <>
      {children}
      {/* Floating badge shown when user navigates away from call screen */}
      <ActiveCallBadge />
      {/* Full-screen incoming call overlay */}
      {incomingCall && (
        <IncomingCallModal
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar}
          callType={incomingCall.type}
          roomName={incomingCall.roomName}
          onAccept={() => void acceptCall()}
          onDecline={() => void declineCall()}
        />
      )}
    </>
  );
}

/**
 * CallStateWrapper
 *
 * Client component that provides global call state to the protected layout.
 * Renders IncomingCallModal on 'call_incoming' Ably events and the
 * ActiveCallBadge when a call is active but the user is on another page.
 *
 * Usage:
 *   <CallStateWrapper>{children}</CallStateWrapper>
 */
export function CallStateWrapper({ children }: { children: React.ReactNode }) {
  return (
    <CallStateProvider>
      <CallUI>{children}</CallUI>
    </CallStateProvider>
  );
}
