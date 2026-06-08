import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Minimal, premium form primitives used across the app.
 * Names kept (PillInput/PillButton/PillLabel) for backwards compatibility,
 * but the look is now clean and fintech-grade: solid surface inputs,
 * subtle borders, no gradients or glow.
 */

export const PillInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }
>(({ icon, className, ...props }, ref) => {
  return (
    <div className="relative">
      <input
        ref={ref}
        {...props}
        className={cn(
          "h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm text-foreground",
          "placeholder:text-muted-foreground/60 outline-none transition",
          "focus:border-primary focus:ring-2 focus:ring-primary/30",
          icon && "pl-11",
          className,
        )}
      />
      {icon && (
        <div className="pointer-events-none absolute left-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </div>
      )}
    </div>
  );
});
PillInput.displayName = "PillInput";

type PillButtonProps = React.ComponentProps<typeof Button> & {
  pillVariant?: "gradient" | "outline" | "ghost";
};

export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ className, pillVariant = "gradient", ...props }, ref) => {
    return (
      <Button
        ref={ref}
        {...props}
        className={cn(
          "h-12 w-full rounded-xl text-sm font-medium transition",
          pillVariant === "gradient" &&
            "border-0 bg-primary text-primary-foreground hover:bg-primary/90",
          pillVariant === "outline" &&
            "border border-border-strong bg-transparent text-foreground hover:bg-card hover:text-foreground",
          pillVariant === "ghost" &&
            "border-0 bg-transparent text-muted-foreground hover:bg-card hover:text-foreground",
          className,
        )}
      />
    );
  },
);
PillButton.displayName = "PillButton";

export const PillLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("mb-1.5 text-xs font-medium text-muted-foreground", className)}>
    {children}
  </div>
);
