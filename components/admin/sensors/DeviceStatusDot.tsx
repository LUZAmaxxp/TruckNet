"use client";

import { cn } from "@/lib/utils";

interface DeviceStatusDotProps {
  status: "online" | "offline" | "unknown";
  size?: "sm" | "md";
}

export function DeviceStatusDot({ status, size = "md" }: DeviceStatusDotProps) {
  const px = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  return (
    <span
      title={status}
      className={cn(
        "inline-block shrink-0 rounded-full",
        px,
        status === "online"  && "animate-live-pulse",
      )}
      style={{
        background:
          status === "online"  ? "var(--sage)"    :
          status === "offline" ? "var(--muted)"   :
                                 "var(--hairline)",
      }}
    />
  );
}
