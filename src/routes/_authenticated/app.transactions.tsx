import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTransactions, deleteTransaction } from "@/lib/transactions.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { brl, fmtDate } from "@/lib/format";
import { Plus, Trash2, Pencil } from "lucide-react";
import { NewTransactionSheet } from "@/components/transactions/NewTransactionSheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/transactions")({
  component: TxPage,
});

function TxPage() {
  const { members, profile } = Route.useRouteContext() as any;
  const [kind, setKind] = useState<"all" | "expense" | "income">("all");
  const [editing, setEditing] = useState<any | null>(null);
  const fetchTx = useServerFn(listTransactions);
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["transactions", kind],
    queryFn: () => fetchTx({ data: { kind, limit: 100 } }),
  });

  const del = useServerFn(deleteTransaction);
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Removido"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Movimentos</h1>
        <NewTransactionSheet
          members={members}
          myUserId={profile.id}
          trigger={<Button size="sm"><Plus className="mr-1 h-4 w-4" />Novo</Button>}
        />
      </div>

      <Tabs value={kind} onValueChange={(v) => setKind(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="expense">Despesas</TabsTrigger>
          <TabsTrigger value="income">Receitas</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="divide-y p-0">
          {isLoading ? (
            <div className="p-5 text-sm text-muted-foreground">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Sem movimentos ainda</div>
          ) : (
            rows.map((t: any) => (
              <div key={t.id} className="group flex items-center gap-3 px-4 py-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-medium"
                  style={{ backgroundColor: (t.category?.color ?? "#94A3B8") + "20", color: t.category?.color ?? "#94A3B8" }}
                >
                  {t.category?.name?.[0] ?? "•"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.description || t.category?.name || "Sem descrição"}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.category?.name ?? "Sem categoria"} · {fmtDate(t.occurred_on)}
                  </div>
                </div>
                <div className={cn("text-sm font-semibold tabular-nums", t.kind === "income" ? "text-success" : "text-foreground")}>
                  {t.kind === "income" ? "+" : "−"}
                  {brl(t.amount)}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 opacity-60 group-hover:opacity-100"
                  onClick={() => setEditing(t)}
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 opacity-60 group-hover:opacity-100"
                  onClick={() => { if (confirm("Remover?")) delMut.mutate(t.id); }}
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <NewTransactionSheet
        members={members}
        myUserId={profile.id}
        editing={editing}
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
      />
    </div>
  );
}
