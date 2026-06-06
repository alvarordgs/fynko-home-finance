import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listGoals, createGoal, updateGoal, updateGoalProgress, deleteGoal } from "@/lib/goals.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { brl, parseAmount } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/goals")({
  component: GoalsPage,
});

function GoalsPage() {
  const fetchGoals = useServerFn(listGoals);
  const qc = useQueryClient();
  const { data: goals = [], isLoading } = useQuery({ queryKey: ["goals"], queryFn: () => fetchGoals() });
  const [editing, setEditing] = useState<any | null>(null);

  const upd = useServerFn(updateGoalProgress);
  const del = useServerFn(deleteGoal);
  const updMut = useMutation({
    mutationFn: (p: { id: string; current_amount: number }) => upd({ data: p }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Atualizado"); },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries(); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Metas</h1>
        <GoalSheet />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : goals.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Crie sua primeira meta — Reserva, viagem, entrada de imóvel…
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {goals.map((g: any) => {
            const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
            return (
              <Card key={g.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-semibold">{g.name}</div>
                      {g.deadline && <div className="text-xs text-muted-foreground">até {new Date(g.deadline).toLocaleDateString("pt-BR")}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(g)} aria-label="Editar">
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { if (confirm("Remover?")) delMut.mutate(g.id); }} aria-label="Remover">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="tabular-nums">{brl(g.current_amount)} <span className="text-muted-foreground">/ {brl(g.target_amount)}</span></span>
                    <span className="font-medium tabular-nums">{pct.toFixed(0)}%</span>
                  </div>
                  <UpdateGoal goal={g} onUpdate={(v) => updMut.mutate({ id: g.id, current_amount: v })} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <GoalSheet
        editing={editing}
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
      />
    </div>
  );
}

function UpdateGoal({ goal, onUpdate }: { goal: any; onUpdate: (v: number) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Input inputMode="decimal" placeholder="Adicionar ao progresso" value={v} onChange={(e) => setV(e.target.value)} className="h-9" />
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const add = parseAmount(v);
          if (add <= 0) return;
          onUpdate(Number(goal.current_amount) + add);
          setV("");
        }}
      >
        +
      </Button>
    </div>
  );
}

function GoalSheet({
  editing,
  open: openProp,
  onOpenChange,
}: {
  editing?: any | null;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (o: boolean) => { if (isControlled) onOpenChange?.(o); else setInternalOpen(o); };

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name ?? "");
      setTarget(String(editing.target_amount).replace(".", ","));
      setCurrent(String(editing.current_amount ?? 0).replace(".", ","));
      setDeadline(editing.deadline ?? "");
    } else {
      setName(""); setTarget(""); setCurrent(""); setDeadline("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const qc = useQueryClient();
  const create = useServerFn(createGoal);
  const update = useServerFn(updateGoal);
  const mut = useMutation({
    mutationFn: () => {
      if (editing) {
        return update({ data: {
          id: editing.id,
          name,
          target_amount: parseAmount(target),
          current_amount: parseAmount(current),
          deadline: deadline || null,
        } });
      }
      return create({ data: { name, target_amount: parseAmount(target), deadline: deadline || null } });
    },
    onSuccess: () => {
      qc.invalidateQueries(); setOpen(false);
      toast.success(editing ? "Meta atualizada" : "Meta criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <SheetTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Nova</Button></SheetTrigger>
      )}
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left"><SheetTitle>{editing ? "Editar meta" : "Nova meta"}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reserva de emergência" /></div>
          <div><Label>Valor alvo</Label><Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10000,00" /></div>
          {editing && (
            <div><Label>Valor atual</Label><Input inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="0,00" /></div>
          )}
          <div><Label>Prazo (opcional)</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
          <Button className="w-full h-12" disabled={mut.isPending || !name || !target} onClick={() => mut.mutate()}>
            {editing ? "Salvar alterações" : "Criar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
