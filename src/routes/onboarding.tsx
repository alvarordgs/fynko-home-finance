import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createHousehold, joinHousehold } from "@/lib/households.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Home, Users, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createHousehold);
  const join = useServerFn(joinHousehold);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const createMut = useMutation({
    mutationFn: (n: string) => create({ data: { name: n } }),
    onSuccess: () => { qc.invalidateQueries(); navigate({ to: "/app" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const joinMut = useMutation({
    mutationFn: (c: string) => join({ data: { inviteCode: c } }),
    onSuccess: () => { qc.invalidateQueries(); navigate({ to: "/app" }); toast.success("Você entrou no lar"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent/30 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo ao Fynko</h1>
            <p className="text-sm text-muted-foreground">Configure o lar para começar</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <Card>
          <Tabs defaultValue="create">
            <CardHeader className="pb-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create"><Home className="mr-2 h-4 w-4" />Criar</TabsTrigger>
                <TabsTrigger value="join"><Users className="mr-2 h-4 w-4" />Entrar</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="create">
              <CardContent className="space-y-4">
                <CardDescription>Crie um lar e convide seu parceiro depois com o código.</CardDescription>
                <div className="space-y-2">
                  <Label htmlFor="hn">Nome do lar</Label>
                  <Input id="hn" placeholder="Casa do Álvaro & Maria" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <Button className="w-full" disabled={!name || createMut.isPending} onClick={() => createMut.mutate(name)}>
                  Criar lar
                </Button>
              </CardContent>
            </TabsContent>

            <TabsContent value="join">
              <CardContent className="space-y-4">
                <CardDescription>Peça o código do convite ao seu parceiro.</CardDescription>
                <div className="space-y-2">
                  <Label htmlFor="ic">Código</Label>
                  <Input id="ic" placeholder="A1B2C3D4" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono uppercase tracking-widest" />
                </div>
                <Button className="w-full" disabled={!code || joinMut.isPending} onClick={() => joinMut.mutate(code)}>
                  Entrar no lar
                </Button>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
