import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listCategories } from "@/lib/categories.functions";
import { createTransaction } from "@/lib/transactions.functions";
import { toast } from "sonner";
import { Plus, Minus, TrendingUp } from "lucide-react";
import { parseAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Member { user_id: string; display_name: string }

export function NewTransactionSheet({
  members,
  myUserId,
  defaultKind = "expense",
  trigger,
}: {
  members: Member[];
  myUserId: string;
  defaultKind?: "income" | "expense";
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"income" | "expense">(defaultKind);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paidBy, setPaidBy] = useState<string>(myUserId);
  const [splitMode, setSplitMode] = useState<"50_50" | "100_me" | "custom">("50_50");
  const [myShare, setMyShare] = useState(50);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const qc = useQueryClient();
  const fetchCategories = useServerFn(listCategories);
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories(),
    enabled: open,
  });

  const create = useServerFn(createTransaction);
  const mut = useMutation({
    mutationFn: () => {
      const a = parseAmount(amount);
      if (a <= 0) throw new Error("Valor inválido");
      const splits =
        kind === "expense" && members.length === 2
          ? splitMode === "100_me"
            ? [{ user_id: paidBy, share_percent: 100 }]
            : splitMode === "50_50"
              ? members.map((m) => ({ user_id: m.user_id, share_percent: 50 }))
              : [
                  { user_id: myUserId, share_percent: myShare },
                  { user_id: members.find((m) => m.user_id !== myUserId)!.user_id, share_percent: 100 - myShare },
                ]
          : undefined;
      return create({
        data: {
          kind,
          amount: a,
          category_id: categoryId,
          description,
          occurred_on: date,
          paid_by_user_id: kind === "expense" ? paidBy : null,
          splits,
        },
      });
    },
    onSuccess: () => {
      toast.success(kind === "expense" ? "Despesa registrada" : "Receita registrada");
      qc.invalidateQueries();
      setOpen(false);
      setAmount(""); setDescription(""); setCategoryId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredCats = categories.filter((c: any) => c.kind === kind);
  const hasTwoMembers = members.length === 2;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Novo movimento</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <Tabs value={kind} onValueChange={(v) => setKind(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expense"><Minus className="mr-1 h-4 w-4" />Despesa</TabsTrigger>
              <TabsTrigger value="income"><TrendingUp className="mr-1 h-4 w-4" />Receita</TabsTrigger>
            </TabsList>
          </Tabs>

          <div>
            <Label htmlFor="amt" className="text-xs text-muted-foreground">Valor</Label>
            <Input
              id="amt"
              inputMode="decimal"
              autoFocus
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-14 text-3xl font-semibold tracking-tight"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {filteredCats.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    categoryId === c.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent",
                  )}
                  style={categoryId === c.id ? undefined : { borderColor: c.color + "55" }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="desc" className="text-xs text-muted-foreground">Descrição</Label>
            <Input id="desc" placeholder="Ex: Aluguel" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {kind === "expense" && hasTwoMembers && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Pago por</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {members.map((m) => (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => setPaidBy(m.user_id)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm transition",
                        paidBy === m.user_id ? "border-primary bg-primary/10 font-medium" : "hover:bg-accent",
                      )}
                    >
                      {m.display_name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Rateio</Label>
                <div className="mt-1 flex gap-2">
                  {[
                    { v: "50_50", l: "50 / 50" },
                    { v: "100_me", l: "100% quem pagou" },
                    { v: "custom", l: "Personalizado" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setSplitMode(o.v as any)}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-2 text-xs transition",
                        splitMode === o.v ? "border-primary bg-primary/10 font-medium" : "hover:bg-accent",
                      )}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
                {splitMode === "custom" && (
                  <div className="mt-3 flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={myShare}
                      onChange={(e) => setMyShare(Math.max(1, Math.min(99, Number(e.target.value) || 0)))}
                      className="w-20"
                    />
                    <span className="text-xs text-muted-foreground">% meu / {100 - myShare}% do parceiro</span>
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <Label htmlFor="dt" className="text-xs text-muted-foreground">Data</Label>
            <Input id="dt" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <Button className="w-full h-12 text-base" disabled={mut.isPending || !amount} onClick={() => mut.mutate()}>
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
