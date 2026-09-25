"use client";

import * as React from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(({ className, disabled, ...props }, ref) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative w-full">
      <input
        type={showPassword ? "text" : "password"}
        className={cn(
          "flex h-10 w-full rounded-input border border-border bg-surface pl-3 pr-10 py-2 text-sm text-text-primary placeholder:text-text-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-soft [&::-ms-reveal]:hidden [&::-ms-clear]:hidden",
          className
        )}
        ref={ref}
        disabled={disabled}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        disabled={disabled}
        className="absolute right-0 top-0 h-full w-10 min-w-[40px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors focus:outline-none disabled:opacity-50 rounded-r-input hover:bg-background/50 active:bg-background"
        aria-label={showPassword ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeOff className="w-4 h-4" />
        ) : (
          <Eye className="w-4 h-4" />
        )}
      </button>
    </div>
  );
});

PasswordInput.displayName = "PasswordInput";
