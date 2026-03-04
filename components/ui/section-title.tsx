import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number;
}

export function SectionTitle({
  children,
  count,
  className,
  ...props
}: SectionTitleProps) {
  return (
    <div
      className={cn("mb-[14px] flex items-center gap-2", className)}
      {...props}
    >
      <span
        className="font-display text-[13px] font-semibold leading-none tracking-[-0.01em]"
        style={{ color: "var(--ink-2)" }}
      >
        {children}
      </span>
      {count !== undefined && (
        <span
          className="inline-flex items-center rounded-[10px] px-[7px] py-[2px] font-mono text-[10px]"
          style={{
            background: "var(--hairline-2)",
            color: "var(--muted)",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}
