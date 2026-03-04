"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, MessageSquare, Users, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home",     icon: LayoutDashboard, emergency: false },
  { href: "/map",       label: "Map",      icon: Map,             emergency: false },
  { href: "/messages",  label: "Messages", icon: MessageSquare,    emergency: false },
  { href: "/friends",   label: "Friends",  icon: Users,           emergency: false },
  { href: "/stress",    label: "SOS",      icon: AlertTriangle,   emergency: true },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        height: 64,
        background: "rgba(247,245,241,0.92)",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <div className="grid h-full grid-cols-5">
        {navItems.map(({ href, label, icon: Icon, emergency }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors duration-[0.18s]",
                active
                  ? emergency
                    ? "text-terra"
                    : "text-navy"
                  : "text-subtle hover:text-ink-2"
              )}
            >
              <div
                className={cn(
                  "relative flex h-7 w-9 items-center justify-center rounded-xl transition-colors",
                  active && !emergency && "bg-navy-lt",
                  active && emergency && "bg-terra-lt",
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", active && "stroke-[2.5]")} />
                {/* SOS pulse dot */}
                {emergency && (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full animate-sos-beat"
                    style={{ background: "var(--terra)" }}
                  />
                )}
              </div>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


