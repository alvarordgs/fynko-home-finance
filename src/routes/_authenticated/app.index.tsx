import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/dashboard.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { brl, brlCompact, fmtDate } from "@/lib/format";
import { ArrowUpRight, ArrowDownRight, Plus, Minus, TrendingUp, AlertCircle, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { NewTransactionSheet } from "@/components/transactions/NewTransactionSheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { household, members, profile } = Route.useRouteContext() as any;
  const fetchDashboard = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
    staleTime: 30_000,
  });

  if (isLoading || !data) return <DashboardSkeleton />;

  const healthMap = {
    healthy: { label: "Saudável", color: "text-success", bg: "bg-success/10", icon: CheckCircle2 },
    attention: { label: "Atenção", color: "text-warning", bg: "bg-warning/10", icon: AlertTriangle },
    critical: { label: "Crítica", color: "text-destructive", bg: "bg-destructive/10", icon: AlertCircle },
  } as const;
  const H = healthMap[data.health];

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{household?.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {profile?.display_name?.split(" ")[0] ?? ""}</h1>
        </div>
        <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", H.bg, H.color)}>
          <H.icon className="h-3.5 w-3.5" />
          {H.label}
        </div>
      </header>

      {/* Free money — main card */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-[oklch(0.55_0.2_290)] text-primary-foreground shadow-xl shadow-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
            <Sparkles className="h-3.5 w-3.5" />
            Dinheiro livre
          </div>
          <div className="mt-2 text-4xl font-bold tracking-tight tabular-nums">{brl(data.freeMoney)}</div>
          <div className="mt-1 text-sm opacity-80">Disponível considerando contas e recebimentos</div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs">
            <div>
              <div className="opacity-70">Saldo</div>
              <div className="mt-0.5 font-semibold tabular-nums">{brlCompact(data.currentBalance)}</div>
            </div>
            <div>
              <div className="opacity-70">Contas</div>
              <div className="mt-0.5 font-semibold tabular-nums">−{brlCompact(data.pendingTotal)}</div>
            </div>
            <div>
              <div className="opacity-70">A receber</div>
              <div className="mt-0.5 font-semibold tabular-nums">+{brlCompact(data.receivableTotal)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <NewTransactionSheet
          members={members}
          myUserId={profile.id}
          defaultKind="expense"
          trigger={
            <Button variant="outline" className="h-14 justify-start gap-3 rounded-xl border-dashed">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Minus className="h-4 w-4" />
              </div>
              <span className="font-medium">Despesa</span>
            </Button>
          }
        />
        <NewTransactionSheet
          members={members}
          myUserId={profile.id}
          defaultKind="income"
          trigger={
            <Button variant="outline" className="h-14 justify-start gap-3 rounded-xl border-dashed">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                <Plus className="h-4 w-4" />
              </div>
              <span className="font-medium">Receita</span>
            </Button>
          }
        />
      </div>

      {/* Balance between members */}
      {members.length === 2 && (
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Acerto entre vocês</div>
            {data.balanceBetween.kind === "even" ? (
              <div className="mt-2 text-base font-medium">Tudo certo entre vocês ✨</div>
            ) : data.balanceBetween.kind === "receive" ? (
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{data.balanceBetween.otherName} te deve</div>
                  <div className="text-2xl font-semibold text-success tabular-nums">{brl(data.balanceBetween.amount)}</div>
                </div>
                <ArrowDownRight className="h-8 w-8 text-success" />
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Você deve a {data.balanceBetween.otherName}</div>
                  <div className="text-2xl font-semibold text-destructive tabular-nums">{brl(data.balanceBetween.amount)}</div>
                </div>
                <ArrowUpRight className="h-8 w-8 text-destructive" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upcoming bills */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-medium">Próximos vencimentos</h2>
          <span className="text-xs text-muted-foreground">{data.upcoming.length} contas</span>
        </div>
        <Card>
          <CardContent className="divide-y p-0">
            {data.upcoming.length === 0 ? (
              <div className="p-5 text-sm text-muted-foreground">Nenhuma conta cadastrada</div>
            ) : (
              data.upcoming.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm font-medium">{b.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(b.next_due_on)} ·{" "}
                      <span className={cn(b.days < 0 && "text-destructive font-medium", b.days >= 0 && b.days <= 3 && "text-warning font-medium")}>
                        {b.days < 0 ? `${Math.abs(b.days)}d atrasada` : b.days === 0 ? "hoje" : `em ${b.days}d`}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{brl(b.amount)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Month summary */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-medium">Este mês</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Receitas</div>
            <div className="mt-1 text-lg font-semibold text-success tabular-nums">{brl(data.month.income)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Despesas</div>
            <div className="mt-1 text-lg font-semibold text-destructive tabular-nums">{brl(data.month.expense)}</div>
          </CardContent></Card>
          <Card className="col-span-2"><CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Economia</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{brl(data.month.savings)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Taxa</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{data.month.savingsRate.toFixed(0)}%</div>
            </div>
          </CardContent></Card>
        </div>
      </section>

      {/* Category breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-medium">Gastos por categoria</h2>
          </div>
          <Card>
            <CardContent className="space-y-3 p-5">
              {data.categoryBreakdown.slice(0, 6).map((c) => {
                const max = data.categoryBreakdown[0].total;
                const pct = (c.total / max) * 100;
                return (
                  <div key={c.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{c.name}</span>
                      <span className="tabular-nums text-muted-foreground">{brl(c.total)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14" /><Skeleton className="h-14" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
