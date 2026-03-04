import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-4", className)}
      {...props}
    >
      <div>
        {eyebrow && (
          <div className="mb-2 flex items-center gap-3">
            {/* Horizontal rule before eyebrow */}
            <span
              className="inline-block h-[1.5px] w-4 rounded-full"
              style={{ background: "var(--navy-md)" }}
            />
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--navy-md)" }}
            >
              {eyebrow}
            </span>
          </div>
        )}
        <h1
          className="font-display text-[26px] font-bold leading-tight tracking-[-0.03em] text-ink"
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[14px] font-normal text-muted">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
