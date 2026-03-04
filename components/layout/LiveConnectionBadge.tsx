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
      className={cn(
        "inline-flex items-center gap-[6px] rounded-[20px] px-[10px] py-[4px] text-[11px] font-semibold transition-colors duration-300",
        isOnline
          ? "bg-sage-lt text-sage"
          : "bg-terra-lt text-terra"
      )}
    >
      <span
        className={cn(
          "inline-block h-[5px] w-[5px] rounded-full bg-current flex-shrink-0",
          isOnline ? "animate-live-pulse" : "animate-sos-beat"
        )}
      />
      <span className="hidden sm:inline">
        {isOnline ? "Live" : "Offline"}
      </span>
    </span>
  );
}
