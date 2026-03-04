"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import type { Session } from "next-auth";
import { LiveConnectionBadge } from "@/components/layout/LiveConnectionBadge";

interface AdminHeaderProps {
  session: Session;
}

/**
 * AdminHeader — top bar for the admin layout.
 * Shows branding, Ably connection status, admin user info, and logout.
 */
export function AdminHeader({ session }: AdminHeaderProps) {
  const name = session.user?.name ?? "Admin";
  const avatarUrl = (session.user as { image?: string | null }).image ?? null;
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-200">Fleet Dashboard</span>
        <LiveConnectionBadge />
      </div>

      <div className="flex items-center gap-3">
        {/* Admin avatar + name */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 overflow-hidden rounded-full bg-blue-600 text-[11px] font-bold text-white flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <span className="text-sm text-gray-300 hidden sm:block">{name}</span>
          <span className="rounded-full bg-blue-600/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-400">
            Admin
          </span>
        </div>

        <button
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </header>
  );
}
