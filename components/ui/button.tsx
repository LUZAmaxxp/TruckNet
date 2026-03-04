import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap",
    "font-body font-semibold tracking-tight leading-none",
    "rounded-sm",
    "transition-all duration-[0.18s] ease-[ease]",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(28,58,94,0.5)] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        /* ── Warm Maritime Design System ── */
        primary:
          "bg-navy text-white shadow-[0_1px_3px_rgba(28,58,94,0.3),0_4px_12px_rgba(28,58,94,0.2)] hover:bg-navy-md hover:shadow-md",
        soft:
          "bg-navy-lt text-navy-md hover:bg-[#DDE8F4]",
        ghost:
          "bg-transparent text-ink-2 border border-hairline hover:bg-[#EFECE6]",
        danger:
          "bg-terra text-white shadow-[0_2px_8px_rgba(184,80,57,0.3)] hover:bg-terra-md",
        success:
          "bg-sage text-white shadow-[0_2px_8px_rgba(58,107,82,0.3)] hover:opacity-90",
        /* ── Backward-compatible aliases ── */
        default:
          "bg-navy text-white shadow-[0_1px_3px_rgba(28,58,94,0.3),0_4px_12px_rgba(28,58,94,0.2)] hover:bg-navy-md hover:shadow-md",
        destructive:
          "bg-terra text-white shadow-[0_2px_8px_rgba(184,80,57,0.3)] hover:bg-terra-md",
        outline:
          "border border-hairline bg-transparent text-ink-2 hover:bg-[#EFECE6]",
        secondary:
          "bg-navy-lt text-navy-md hover:bg-[#DDE8F4]",
        link:
          "text-navy underline-offset-4 hover:underline",
      },
      size: {
        default:   "py-[9px] px-[18px] text-[13px]",
        sm:        "py-[6px] px-[14px] text-[12px]",
        lg:        "py-[11px] px-[20px] text-[14px]",
        icon:      "h-[34px] w-[34px]",
        "icon-lg": "h-[42px] w-[42px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
