import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyHousehold, updateProfile } from "@/lib/households.functions";
import { createSettlement, listSettlements } from "@/lib/settlements.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { brl, parseAmount, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { LogOut, Copy, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const fetchHH = useServerFn(getMyHousehold);
  const { data: hh } = useQuery({ queryKey: ["household"], queryFn: () => fetchHH() });
  const qc = useQueryClient();
  const upd = useServerFn(updateProfile);
  const updMut = useMutation({
    mutationFn: (n: string) => upd({ data: { display_name: n } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Perfil atualizado"); },
  });
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);

  const other = hh?.members.find((m: any) => m.user_id !== hh?.profile?.id);
  const settle = useServerFn(createSettlement);
  const fetchSet = useServerFn(listSettlements);
  const { data: settlements = [] } = useQuery({ queryKey: ["settlements"], queryFn: () => fetchSet() });
  const [amount, setAmount] = useState("");
  const settleMut = useMutation({
    mutationFn: () => settle({ data: {
      to_user_id: other!.user_id,
      amount: parseAmount(amount),
      occurred_on: new Date().toISOString().slice(0, 10),
    } }),
    onSuccess: () => { qc.invalidateQueries(); setAmount(""); toast.success("Acerto registrado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  function copyCode() {
    if (!hh?.household?.invite_code) return;
    navigator.clipboard.writeText(hh.household.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Perfil</div>
          <div className="space-y-2">
            <Label>Nome de exibição</Label>
            <div className="flex gap-2">
              <Input defaultValue={hh?.profile?.display_name ?? ""} onChange={(e) => setName(e.target.value)} />
              <Button onClick={() => name && updMut.mutate(name)} disabled={updMut.isPending}>Salvar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Lar</div>
          <div>
            <div className="text-base font-semibold">{hh?.household?.name}</div>
            <div className="text-xs text-muted-foreground">{hh?.members.length}/2 membros</div>
          </div>
          {hh?.members.length === 1 && (
            <div>
              <Label className="text-xs">Código de convite</Label>
              <button
                onClick={copyCode}
                className="mt-1 flex w-full items-center justify-between rounded-lg border border-dashed bg-muted/30 p-3 hover:bg-muted/50"
              >
                <code className="font-mono text-lg font-semibold tracking-widest">{hh?.household?.invite_code}</code>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">Compartilhe esse código para seu parceiro entrar no lar.</p>
            </div>
          )}
          <div className="divide-y rounded-lg border">
            {hh?.members.map((m: any) => (
              <div key={m.user_id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{m.display_name}</span>
                <span className="text-xs uppercase text-muted-foreground">{m.role}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {other && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Registrar acerto</div>
            <p className="text-sm text-muted-foreground">Você pagou (Pix, dinheiro) {other.display_name}.</p>
            <div className="flex gap-2">
              <Input inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Button onClick={() => settleMut.mutate()} disabled={!amount || settleMut.isPending}>Registrar</Button>
            </div>
            {settlements.length > 0 && (
              <div className="space-y-1 pt-2">
                <div className="text-xs text-muted-foreground">Últimos acertos</div>
                {settlements.slice(0, 5).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{fmtDate(s.occurred_on)}</span>
                    <span className="tabular-nums">{brl(s.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button variant="outline" className="w-full" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" /> Sair
      </Button>
    </div>
  );
}
