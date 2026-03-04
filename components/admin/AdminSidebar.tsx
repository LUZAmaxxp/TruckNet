"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { LayoutDashboard, Users, AlertTriangle, PhoneCall, TruckIcon, MessageSquare, LogOut } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin",          label: "Overview",     icon: LayoutDashboard, exact: true },
  { href: "/admin/drivers",  label: "Drivers",      icon: Users,           exact: false },
  { href: "/admin/sos",      label: "SOS Alerts",   icon: AlertTriangle,   exact: false },
  { href: "/admin/messages", label: "Messages",     icon: MessageSquare,   exact: false },
  { href: "/admin/calls",    label: "Call History", icon: PhoneCall,       exact: false },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { on } = useSocket();
  const [activeSosBadge, setActiveSosBadge] = useState(0);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d: { activeSosAlerts?: number }) => {
        if (typeof d.activeSosAlerts === "number") setActiveSosBadge(d.activeSosAlerts);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handler = () => setActiveSosBadge((n) => n + 1);
    const unsub = on("stress_signal_alert", handler);
    return unsub;
  }, [on]);

  return (
    <aside
      className="flex h-full w-56 shrink-0 flex-col"
      style={{
        background: "var(--surface)",
        borderRight: "1px solid var(--hairline)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Branding */}
      <div
        className="flex items-center gap-2 px-4 py-[18px]"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[14px] shrink-0"
          style={{
            background: "var(--navy)",
            boxShadow: "0 2px 8px rgba(28,58,94,0.3)",
          }}
        >
          🚛
        </div>
        <span
          className="font-display text-[15px] font-bold tracking-[-0.02em]"
          style={{ color: "var(--navy)" }}
        >
          TruckNet
        </span>
        <span
          className="ml-auto inline-flex items-center rounded-[10px] px-[7px] py-[2px] font-mono text-[9px] font-semibold uppercase tracking-[0.06em]"
          style={{ background: "var(--navy-lt)", color: "var(--navy-md)" }}
        >
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-[12px] px-3 py-[9px] text-[13px] font-medium transition-all duration-[0.18s]",
                active
                  ? "bg-navy-lt text-navy font-semibold"
                  : "text-[var(--muted)] hover:bg-base hover:text-ink-2"
              )}
            >
              {/* Active indicator — left bar */}
              {active && (
                <span
                  className="absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-full"
                  style={{ background: "var(--navy)" }}
                />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {/* SOS badge */}
              {label === "SOS Alerts" && activeSosBadge > 0 && (
                <span
                  className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full font-mono text-[10px] font-bold animate-sos-beat px-1"
                  style={{
                    background: "var(--terra-lt)",
                    color: "var(--terra)",
                  }}
                >
                  {activeSosBadge > 99 ? "99+" : activeSosBadge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom sign-out */}
      <div
        className="px-2 py-3"
        style={{ borderTop: "1px solid var(--hairline)" }}
      >
        <button
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-[12px] px-3 py-[9px] text-[13px] font-medium",
            "text-[var(--muted)] hover:bg-base hover:text-terra transition-colors duration-[0.18s]"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}


