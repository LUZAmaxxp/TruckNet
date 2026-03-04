import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        // Layout
        "flex w-full",
        // Appearance
        "rounded-sm border-[1.5px] border-hairline bg-base",
        "px-[14px] py-[11px]",
        // Typography
        "font-body text-[14px] text-ink placeholder:text-subtle",
        // Transition
        "transition-[border-color,box-shadow] duration-200",
        // Focus
        "focus-visible:outline-none",
        "focus-visible:border-[rgba(28,58,94,0.4)]",
        "focus-visible:bg-surface",
        "focus-visible:shadow-[0_0_0_3px_rgba(28,58,94,0.07)]",
        // File input reset
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
