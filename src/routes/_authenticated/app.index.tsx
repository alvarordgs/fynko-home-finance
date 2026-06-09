import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getDashboard } from "@/lib/dashboard.functions";
import { payBill } from "@/lib/bills.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { brl, brlCompact, fmtDate } from "@/lib/format";
import {
  ArrowUpRight, ArrowDownRight, Plus, Minus, AlertCircle, CheckCircle2,
  AlertTriangle, Sparkles, TrendingUp, TrendingDown, RefreshCw, Check,
} from "lucide-react";
import { NewTransactionSheet } from "@/components/transactions/NewTransactionSheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { household, members, profile } = Route.useRouteContext() as any;
  const fetchDashboard = useServerFn(getDashboard);
  const qc = useQueryClient();
  const { data, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
    staleTime: 30_000,
  });

  const pay = useServerFn(payBill);
  const payMut = useMutation({
    mutationFn: (id: string) => pay({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Conta marcada como paga"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <DashboardSkeleton />;

  const healthMap = {
    healthy: { label: "Saudável", color: "text-success", bg: "bg-success/10", icon: CheckCircle2 },
    attention: { label: "Atenção", color: "text-warning", bg: "bg-warning/10", icon: AlertTriangle },
    critical: { label: "Crítica", color: "text-destructive", bg: "bg-destructive/10", icon: AlertCircle },
  } as const;
  const H = healthMap[data.health];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{household?.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {profile?.display_name?.split(" ")[0] ?? ""}</h1>
        </div>
        <SyncBadge updatedAt={dataUpdatedAt} isFetching={isFetching} onRefresh={() => refetch()} />
      </header>

      {/* LEVEL 1 — Dinheiro Livre */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-[oklch(0.55_0.2_290)] text-primary-foreground shadow-xl shadow-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
            <Sparkles className="h-3.5 w-3.5" />
            Dinheiro livre
          </div>
          <div className="mt-2 text-4xl font-bold tracking-tight tabular-nums">{brl(data.freeMoney)}</div>
          <div className="mt-1.5 text-sm leading-snug opacity-85">
            Você pode usar este valor sem comprometer suas próximas contas.
          </div>
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

      {/* LEVEL 2 — Próximos 30 dias + Saúde */}
      <section className="space-y-3">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">Próximos 30 dias</h2>
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Stat label="Saldo atual" value={brl(data.currentBalance)} />
              <Stat label="A receber" value={`+${brl(data.receivableTotal)}`} valueClass="text-success" />
              <Stat label="Próximos vencimentos" value={`−${brl(data.pendingTotal)}`} valueClass="text-destructive" />
              <Stat label="Saldo previsto" value={brl(data.projected30)} emphasize />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", H.bg, H.color)}>
              <H.icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className={cn("text-sm font-medium", H.color)}>Situação {H.label.toLowerCase()}</div>
              <div className="text-xs text-muted-foreground">{data.healthMessage}</div>
            </div>
          </CardContent>
        </Card>
      </section>

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

      {/* LEVEL 3 — Próximos vencimentos (with quick "Pagar") */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-medium">Próximos vencimentos</h2>
          <span className="text-xs text-muted-foreground">{data.upcoming.length} contas</span>
        </div>
        <Card>
          <CardContent className="divide-y p-0">
            {data.upcoming.length === 0 ? (
              <EmptyState
                emoji="📅"
                title="Nenhuma conta próxima"
                desc="Cadastre suas contas recorrentes para acompanhar vencimentos."
              />
            ) : (
              data.upcoming.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{b.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(b.next_due_on)} ·{" "}
                      <span className={cn(b.days < 0 && "text-destructive font-medium", b.days >= 0 && b.days <= 3 && "text-warning font-medium")}>
                        {b.days < 0 ? `${Math.abs(b.days)}d atrasada` : b.days === 0 ? "hoje" : `em ${b.days}d`}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{brl(b.amount)}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 rounded-lg border-success/30 px-2.5 text-success hover:bg-success/10 hover:text-success"
                    disabled={payMut.isPending}
                    onClick={() => payMut.mutate(b.id)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Pagar</span>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* LEVEL 3 — Resumo mensal */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-medium">Este mês</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MonthCard label="Receitas" value={data.month.income} delta={data.monthDeltas.income} valueClass="text-success" positiveIsGood />
          <MonthCard label="Despesas" value={data.month.expense} delta={data.monthDeltas.expense} valueClass="text-destructive" positiveIsGood={false} />
          <Card className="col-span-2">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-xs text-muted-foreground">Economia</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{brl(data.month.savings)}</div>
                <DeltaPill delta={data.monthDeltas.savings} positiveIsGood />
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Taxa</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{data.month.savingsRate.toFixed(0)}%</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* LEVEL 4 — Gastos por categoria com % */}
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
                const share = data.month.expense > 0 ? (c.total / data.month.expense) * 100 : 0;
                return (
                  <div key={c.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{c.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {brl(c.total)} <span className="ml-1 text-xs">· {share.toFixed(0)}%</span>
                      </span>
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

function Stat({ label, value, valueClass, emphasize }: { label: string; value: string; valueClass?: string; emphasize?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 tabular-nums", emphasize ? "text-base font-semibold" : "text-sm font-medium", valueClass)}>
        {value}
      </div>
    </div>
  );
}

function MonthCard({ label, value, delta, valueClass, positiveIsGood }: {
  label: string; value: number; delta: number | null; valueClass?: string; positiveIsGood: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-lg font-semibold tabular-nums", valueClass)}>{brl(value)}</div>
        <DeltaPill delta={delta} positiveIsGood={positiveIsGood} />
      </CardContent>
    </Card>
  );
}

function DeltaPill({ delta, positiveIsGood }: { delta: number | null; positiveIsGood: boolean }) {
  if (delta === null) return <div className="mt-1 text-[11px] text-muted-foreground">sem comparação</div>;
  if (Math.abs(delta) < 0.5) return <div className="mt-1 text-[11px] text-muted-foreground">estável vs. mês anterior</div>;
  const up = delta > 0;
  const good = positiveIsGood ? up : !up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className={cn("mt-1 inline-flex items-center gap-1 text-[11px] font-medium", good ? "text-success" : "text-destructive")}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(0)}% vs. mês anterior
    </div>
  );
}

function SyncBadge({ updatedAt, isFetching, onRefresh }: { updatedAt: number; isFetching: boolean; onRefresh: () => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const diff = Date.now() - updatedAt;
  const label = isFetching
    ? "Atualizando…"
    : diff < 60_000
      ? "Atualizado agora"
      : diff < 3_600_000
        ? `há ${Math.floor(diff / 60_000)} min`
        : `há ${Math.floor(diff / 3_600_000)} h`;
  return (
    <button
      type="button"
      onClick={onRefresh}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
    >
      <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
      {label}
    </button>
  );
}

function EmptyState({ emoji, title, desc, action }: { emoji: string; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="text-3xl">{emoji}</div>
      <div className="mt-3 text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 max-w-xs text-xs text-muted-foreground">{desc}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14" /><Skeleton className="h-14" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
