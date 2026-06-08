import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

type Mode = "welcome" | "login" | "signup";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.74-6-6.1S8.7 6 12 6c1.88 0 3.14.8 3.86 1.5L18.6 4.9C16.86 3.3 14.66 2.3 12 2.3 6.86 2.3 2.7 6.46 2.7 11.6c0 5.14 4.16 9.3 9.3 9.3 5.36 0 8.92-3.78 8.92-9.1 0-.62-.06-1.08-.14-1.6H12z"/>
      <path fill="#34A853" d="M3.6 7.5l3.2 2.36C7.6 7.86 9.62 6.4 12 6.4c1.7 0 2.86.74 3.5 1.36l2.62-2.56C16.5 3.6 14.4 2.6 12 2.6 8.1 2.6 4.78 4.84 3.6 7.5z" opacity="0"/>
      <path fill="#FBBC05" d="M0 0h24v24H0z" opacity="0"/>
    </svg>
  );
}

function FynkoMark() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border-strong bg-card">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 4h12v3H10v4h7v3h-7v6H6V4z" fill="#A78BFA"/>
      </svg>
    </div>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("welcome");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/app" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { display_name: name } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu email se solicitado.");
    navigate({ to: "/app" });
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { setLoading(false); return toast.error("Falha no login com Google"); }
    if (result.redirected) return;
    navigate({ to: "/app" });
  }

  async function handleReset() {
    if (!email) return toast.error("Informe seu email primeiro");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) return toast.error(error.message);
    toast.success("Email de recuperação enviado");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[400px]">
        {/* Brand */}
        <div className="mb-10 flex flex-col items-center text-center">
          <FynkoMark />
          <h1 className="mt-5 text-[28px] font-semibold tracking-tight text-foreground">Fynko</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Finanças para casais</p>
        </div>

        {mode === "welcome" && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Organizem suas finanças juntos
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                Acompanhem receitas, despesas e metas em um único lugar.
              </p>
            </div>

            <div className="space-y-3">
              <Button onClick={() => setMode("login")} className="h-12 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90">
                Entrar
              </Button>
              <Button
                onClick={() => setMode("signup")}
                variant="outline"
                className="h-12 w-full rounded-xl border-border-strong bg-transparent text-base font-medium text-foreground hover:bg-card hover:text-foreground"
              >
                Criar conta
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center"><span className="bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground">ou</span></div>
              </div>

              <Button
                onClick={handleGoogle}
                disabled={loading}
                variant="outline"
                className="h-12 w-full gap-2.5 rounded-xl border-border-strong bg-transparent text-base font-medium text-foreground hover:bg-card hover:text-foreground"
              >
                <GoogleIcon className="h-4 w-4" />
                Continuar com Google
              </Button>
            </div>
          </div>
        )}

        {mode === "login" && (
          <FormShell title="Entrar" subtitle="Bem-vindo de volta ao Fynko." onBack={() => setMode("welcome")}>
            <form onSubmit={handleLogin} className="space-y-4">
              <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={setEmail} placeholder="voce@email.com" />
              <Field id="password" label="Senha" type="password" autoComplete="current-password" required value={password} onChange={setPassword} placeholder="Sua senha" />

              <div className="flex justify-end">
                <button type="button" onClick={handleReset} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                  Esqueci minha senha
                </button>
              </div>

              <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90">
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <Button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                variant="outline"
                className="h-12 w-full gap-2.5 rounded-xl border-border-strong bg-transparent text-base font-medium text-foreground hover:bg-card hover:text-foreground"
              >
                <GoogleIcon className="h-4 w-4" />
                Continuar com Google
              </Button>
            </form>
            <FooterSwap label="Não tem conta?" action="Cadastre-se" onClick={() => setMode("signup")} />
          </FormShell>
        )}

        {mode === "signup" && (
          <FormShell title="Criar conta" subtitle="Comece a organizar suas finanças em minutos." onBack={() => setMode("welcome")}>
            <form onSubmit={handleSignup} className="space-y-4">
              <Field id="name" label="Nome" type="text" autoComplete="name" required value={name} onChange={setName} placeholder="Seu nome" />
              <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={setEmail} placeholder="voce@email.com" />
              <Field id="password" label="Senha" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" />

              <Button type="submit" disabled={loading} className="mt-2 h-12 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90">
                {loading ? "Criando..." : "Criar conta"}
              </Button>
              <Button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                variant="outline"
                className="h-12 w-full gap-2.5 rounded-xl border-border-strong bg-transparent text-base font-medium text-foreground hover:bg-card hover:text-foreground"
              >
                <GoogleIcon className="h-4 w-4" />
                Continuar com Google
              </Button>
            </form>
            <FooterSwap label="Já tem conta?" action="Entrar" onClick={() => setMode("login")} />
          </FormShell>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground/70">
          Ao continuar, você concorda com os Termos e a Política de Privacidade.
        </p>
      </div>
    </div>
  );
}

function FormShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:border-border-strong hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 pt-0.5">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  ...props
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-xl border-border bg-surface px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
        {...props}
      />
    </div>
  );
}

function FooterSwap({
  label,
  action,
  onClick,
}: {
  label: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="pt-2 text-center text-sm text-muted-foreground">
      {label}{" "}
      <button type="button" onClick={onClick} className="font-medium text-foreground underline-offset-4 hover:underline">
        {action}
      </button>
    </div>
  );
}
