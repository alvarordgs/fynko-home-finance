import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
          "h-12 w-full rounded-full border border-white/10 bg-card/80 px-5 text-sm text-foreground placeholder:text-muted-foreground shadow-inner shadow-black/20 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/40",
          icon && "pr-14",
          className,
        )}
      />
      {icon && (
        <div className="pointer-events-none absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
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
          "h-12 w-full rounded-full text-sm font-semibold tracking-wide transition active:scale-[0.98]",
          pillVariant === "gradient" &&
            "border-0 bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110",
          pillVariant === "outline" &&
            "border border-primary/50 bg-transparent text-foreground hover:bg-primary/10",
          pillVariant === "ghost" &&
            "border-0 bg-card/80 text-foreground hover:bg-card",
          className,
        )}
      />
    );
  },
);
PillButton.displayName = "PillButton";

export const PillLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("mb-1.5 px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground", className)}>
    {children}
  </div>
);
