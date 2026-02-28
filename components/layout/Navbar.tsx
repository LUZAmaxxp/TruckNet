"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Truck, Map, MessageSquare, AlertTriangle, LayoutDashboard, LogOut, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LiveConnectionBadge } from "@/components/layout/LiveConnectionBadge";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: Map },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/stress", label: "Stress", icon: AlertTriangle },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Fetch avatar when session is available
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
    ? session.user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4 px-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold shrink-0">
          <Truck className="h-5 w-5" />
          <span className="hidden sm:inline">TruckConnect</span>
        </Link>

        {/* Nav links — hidden on mobile (handled by BottomNav) */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === href
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Avatar + connection badge + sign out */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Live connection badge */}
          <LiveConnectionBadge />

          {/* Avatar — click to go to /profile */}
          <Link href="/profile" title="My Profile">
            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center hover:ring-2 hover:ring-primary transition-all cursor-pointer">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={session?.user?.name ?? "Avatar"}
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-muted-foreground">{initials}</span>
              )}
            </div>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
