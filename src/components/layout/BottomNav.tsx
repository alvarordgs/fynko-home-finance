import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, ArrowLeftRight, CalendarClock, Target, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const items: NavItem[] = [
  { to: "/app", label: "Início", icon: LayoutDashboard, exact: true },
  { to: "/app/transactions", label: "Movimentos", icon: ArrowLeftRight },
  { to: "/app/bills", label: "Contas", icon: CalendarClock },
  { to: "/app/goals", label: "Metas", icon: Target },
  { to: "/app/settings", label: "Ajustes", icon: Settings },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/90 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to as any}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active ? "stroke-[2.2]" : "stroke-[1.75]")} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SideNav() {
  const { pathname } = useLocation();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar p-4 lg:block">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong bg-card">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 4h12v3H10v4h7v3h-7v6H6V4z" fill="#A78BFA" />
          </svg>
        </div>
        <span className="text-[15px] font-semibold tracking-tight">Fynko</span>
      </div>
      <nav className="space-y-0.5">
        {items.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to as any}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-card text-foreground font-medium"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "stroke-[2.2]" : "stroke-[1.75]")} />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
