import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-input select-none";

    const variantStyles = {
      primary:
        "bg-primary text-white hover:opacity-90 shadow-soft active:scale-[0.99]",
      secondary:
        "bg-secondary text-white hover:opacity-90 shadow-soft active:scale-[0.99]",
      // Destructive uses the muted Error tone (#E2635F/#E77E7A), never harsh red per design.md
      destructive:
        "bg-error text-white hover:opacity-90 shadow-soft active:scale-[0.99]",
      outline:
        "border border-border bg-surface text-text-primary hover:bg-background active:scale-[0.99]",
      ghost:
        "text-text-primary hover:bg-border/30 active:scale-[0.99]",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
