import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-[5px] px-[10px] py-[3px] rounded-[20px] text-[11px] font-semibold transition-colors leading-none",
  {
    variants: {
      variant: {
        /* ── Warm Maritime semantic badges ── */
        online:      "bg-sage-lt text-sage",
        offline:     "bg-hairline-2 text-muted",
        sos:         "bg-terra-lt text-terra",
        call:        "bg-slate-lt text-slate",
        idle:        "bg-honey-lt text-honey",
        navy:        "bg-navy-lt text-navy-md",
        /* ── Backward-compatible aliases ── */
        default:     "bg-navy text-white",
        secondary:   "bg-navy-lt text-navy-md",
        destructive: "bg-terra-lt text-terra",
        outline:     "border border-hairline text-ink-2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Show status dot before children */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  const autoDot = dot ?? (variant === "online" || variant === "sos" || variant === "call");
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {autoDot && (
        <span
          className={cn(
            "inline-block h-[5px] w-[5px] rounded-full bg-current flex-shrink-0",
            variant === "sos" && "animate-sos-beat",
            variant === "online" && "animate-live-pulse",
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
