"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import type { Session } from "next-auth";
import { LiveConnectionBadge } from "@/components/layout/LiveConnectionBadge";

interface AdminHeaderProps {
  session: Session;
  title?: string;
}

export function AdminHeader({ session, title = "Fleet Dashboard" }: AdminHeaderProps) {
  const name = session.user?.name ?? "Admin";
  const avatarUrl = (session.user as { image?: string | null }).image ?? null;
  const initials = name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between px-7"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--hairline)",
        boxShadow: "var(--shadow-nav)",
      }}
    >
      {/* Page title */}
      <h1
        className="font-display text-[18px] font-bold leading-none tracking-[-0.02em]"
        style={{ color: "var(--ink)" }}
      >
        {title}
      </h1>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <LiveConnectionBadge />

        {/* Admin avatar + name */}
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full"
            style={{ background: "var(--navy-lt)", border: "1.5px solid var(--hairline)" }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              <span
                className="font-display text-[11px] font-bold"
                style={{ color: "var(--navy)" }}
              >
                {initials}
              </span>
            )}
          </div>
          <span
            className="hidden text-[13px] font-medium sm:block"
            style={{ color: "var(--ink-2)" }}
          >
            {name}
          </span>
        </div>

        <button
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-sm border border-hairline bg-transparent text-muted transition-colors hover:bg-base-2 hover:text-terra"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}


