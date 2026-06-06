import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listBills, createBill, updateBill, payBill, deleteBill } from "@/lib/bills.functions";
import { listCategories } from "@/lib/categories.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, Trash2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { brl, fmtDate, parseAmount } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/bills")({
  component: BillsPage,
});

function BillsPage() {
  const fetchBills = useServerFn(listBills);
  const qc = useQueryClient();
  const { data: bills = [], isLoading } = useQuery({ queryKey: ["bills"], queryFn: () => fetchBills() });
  const [editing, setEditing] = useState<any | null>(null);

  const pay = useServerFn(payBill);
  const del = useServerFn(deleteBill);
  const payMut = useMutation({
    mutationFn: (id: string) => pay({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Conta paga"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Removida"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Contas</h1>
        <BillSheet />
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {isLoading ? (
            <div className="p-5 text-sm text-muted-foreground">Carregando…</div>
          ) : bills.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Cadastre suas contas recorrentes</div>
          ) : (
            bills.map((b: any) => {
              const days = Math.round((new Date(b.next_due_on + "T00:00:00").getTime() - Date.now()) / 86400000);
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{b.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(b.next_due_on)} ·{" "}
                      <span className={cn(days < 0 && "text-destructive font-medium", days >= 0 && days <= 3 && "text-warning font-medium")}>
                        {days < 0 ? `${Math.abs(days)}d atrasada` : days === 0 ? "hoje" : `em ${days}d`}
                      </span>{" "}· {b.category?.name ?? "—"}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{brl(b.amount)}</div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => payMut.mutate(b.id)} aria-label="Pagar">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(b)} aria-label="Editar">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { if (confirm("Remover?")) delMut.mutate(b.id); }} aria-label="Remover">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <BillSheet
        editing={editing}
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
      />
    </div>
  );
}

function BillSheet({
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

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly" | "yearly">("monthly");
  const [day, setDay] = useState(10);
  const [nextDue, setNextDue] = useState(() => {
    const d = new Date(); d.setDate(10);
    if (d < new Date()) d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDescription(editing.description ?? "");
      setAmount(String(editing.amount).replace(".", ","));
      setCategoryId(editing.category?.id ?? editing.category_id ?? null);
      setFrequency(editing.frequency);
      setDay(editing.due_day);
      setNextDue(editing.next_due_on);
    } else {
      setDescription(""); setAmount(""); setCategoryId(null);
      setFrequency("monthly"); setDay(10);
      const d = new Date(); d.setDate(10);
      if (d < new Date()) d.setMonth(d.getMonth() + 1);
      setNextDue(d.toISOString().slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const qc = useQueryClient();
  const fetchCats = useServerFn(listCategories);
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: () => fetchCats(), enabled: open });
  const create = useServerFn(createBill);
  const update = useServerFn(updateBill);
  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        description,
        amount: parseAmount(amount),
        category_id: categoryId,
        frequency,
        due_day: day,
        next_due_on: nextDue,
      };
      if (editing) return update({ data: { id: editing.id, ...payload } });
      return create({ data: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "Atualizada" : "Conta cadastrada");
      qc.invalidateQueries();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <SheetTrigger asChild>
          <Button size="sm"><Plus className="mr-1 h-4 w-4" />Nova</Button>
        </SheetTrigger>
      )}
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left"><SheetTitle>{editing ? "Editar conta" : "Nova conta recorrente"}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4">
          <div><Label>Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Aluguel" /></div>
          <div><Label>Valor</Label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoryId ?? ""} onValueChange={(v) => setCategoryId(v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {cats.filter((c: any) => c.kind === "expense").map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Frequência</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Dia</Label><Input type="number" min={1} max={31} value={day} onChange={(e) => setDay(Number(e.target.value) || 1)} /></div>
          </div>
          <div><Label>Próximo vencimento</Label><Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></div>
          <Button className="w-full h-12" disabled={mut.isPending || !description || !amount} onClick={() => mut.mutate()}>
            {editing ? "Salvar alterações" : "Salvar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
