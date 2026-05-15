"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Map, MessageSquare, AlertTriangle, LayoutDashboard, LogOut, Users, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LiveConnectionBadge } from "@/components/layout/LiveConnectionBadge";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map",       label: "Map",       icon: Map },
  { href: "/messages",  label: "Messages",  icon: MessageSquare },
  { href: "/friends",   label: "Friends",   icon: Users },
  { href: "/stress",    label: "Stress",    icon: AlertTriangle },
  { href: "/profile",   label: "My Truck",  icon: Cpu },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { profileImageUrl?: string | null } | null) => {
        if (data?.profileImageUrl) setAvatarUrl(data.profileImageUrl);
      })
      .catch(() => {});
  }, [session?.user?.id]);

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        height: 56,
        background: "rgba(247,245,241,0.88)",
        backdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid var(--hairline)",
        boxShadow: "var(--shadow-nav)",
      }}
    >
      <div className="container flex h-14 items-center gap-4 px-4">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2"
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[14px]"
            style={{
              background: "var(--navy)",
              boxShadow: "0 2px 8px rgba(28,58,94,0.3)",
            }}
          >
            🚛
          </div>
          <span
            className="hidden font-display text-[15px] font-bold tracking-[-0.02em] sm:inline"
            style={{ color: "var(--navy)" }}
          >
            TruckConnect
          </span>
        </Link>

        {/* Nav links — hidden on mobile */}
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-sm px-[14px] text-[13px] font-medium transition-all duration-[0.18s]",
                  active
                    ? "bg-navy-lt text-navy font-semibold"
                    : "text-[var(--muted)] hover:bg-hairline-2 hover:text-ink-2"
                )}
              >
                <Icon className="h-[15px] w-[15px]" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LiveConnectionBadge />

          {/* Avatar */}
          <Link href="/profile" title="My Profile">
            <div
              className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full transition-all hover:ring-2 hover:ring-[rgba(28,58,94,0.3)]"
              style={{
                background: "var(--navy-lt)",
                border: "1.5px solid var(--hairline)",
              }}
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={session?.user?.name ?? "Avatar"}
                  fill
                  className="object-cover"
                />
              ) : (
                <span
                  className="font-display text-[11px] font-bold"
                  style={{ color: "var(--navy)" }}
                >
                  {initials}
                </span>
              )}
            </div>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}


