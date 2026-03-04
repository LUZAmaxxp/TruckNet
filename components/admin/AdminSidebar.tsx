"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, AlertTriangle, PhoneCall, TruckIcon, MessageSquare } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/drivers", label: "Drivers", icon: Users, exact: false },
  { href: "/admin/sos", label: "SOS Alerts", icon: AlertTriangle, exact: false },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare, exact: false },
  { href: "/admin/calls", label: "Call History", icon: PhoneCall, exact: false },
];

/**
 * AdminSidebar — fixed left navigation for the admin layout.
 * Shows a pulsing red badge on the SOS Alerts link when active alerts exist.
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const { on } = useSocket();
  const [activeSosBadge, setActiveSosBadge] = useState(0);

  // Fetch initial active SOS count
  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d: { activeSosAlerts?: number }) => {
        if (typeof d.activeSosAlerts === "number") {
          setActiveSosBadge(d.activeSosAlerts);
        }
      })
      .catch(() => undefined);
  }, []);

  // Increment badge when a new SOS comes in via Ably
  useEffect(() => {
    const handler = () => setActiveSosBadge((n) => n + 1);
    const unsub = on("stress_signal_alert", handler);
    return unsub;
  }, [on]);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-gray-800 bg-gray-900">
      {/* Branding */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-800">
        <TruckIcon className="h-5 w-5 text-blue-400" />
        <span className="font-bold text-white tracking-tight">TruckNet</span>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {label === "SOS Alerts" && activeSosBadge > 0 && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white animate-pulse">
                  {activeSosBadge > 99 ? "99+" : activeSosBadge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
