"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function LiveConnectionBadge() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <span
      title={isOnline ? "Connected" : "Offline"}
      className="flex items-center gap-1.5 text-xs font-medium"
    >
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full transition-colors",
          isOnline
            ? "bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.4)]"
            : "bg-red-500 animate-pulse"
        )}
      />
      <span className={cn(
        "hidden sm:inline transition-colors",
        isOnline ? "text-green-600 dark:text-green-400" : "text-red-500"
      )}>
        {isOnline ? "Live" : "Offline"}
      </span>
    </span>
  );
}
