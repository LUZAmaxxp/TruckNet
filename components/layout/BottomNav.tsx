"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, MessageSquare, Users, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home",     icon: LayoutDashboard },
  { href: "/map",       label: "Map",      icon: Map },
  { href: "/messages",  label: "Messages", icon: MessageSquare },
  { href: "/friends",   label: "Friends",  icon: Users },
  { href: "/stress",    label: "SOS",      icon: AlertTriangle, emergency: true },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur border-t border-border">
      <div className="grid grid-cols-5 h-16">
        {navItems.map(({ href, label, icon: Icon, emergency }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                active
                  ? emergency
                    ? "text-destructive"
                    : "text-primary"
                  : emergency
                    ? "text-destructive/60 hover:text-destructive"
                    : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center rounded-xl w-9 h-7 transition-colors",
                active && !emergency && "bg-primary/10",
                active && emergency && "bg-destructive/10",
              )}>
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                {/* Pulsing dot for emergency */}
                {emergency && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
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
