"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { SocketProvider } from "@/hooks/useSocket";

interface ProvidersProps {
  children: React.ReactNode;
  session?: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session}>
      {/* SocketProvider must be inside SessionProvider so useSession() works */}
      <SocketProvider>
        {children}
      </SocketProvider>
    </SessionProvider>
  );
}
