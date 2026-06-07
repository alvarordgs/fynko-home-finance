import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Wallet, User, Lock, Mail, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

type Mode = "welcome" | "login" | "signup";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      {/* Ambient gradient halos */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-180px] right-[-120px] h-[420px] w-[420px] rounded-full bg-accent/40 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-card/80 shadow-2xl shadow-primary/20 backdrop-blur-xl">
          {/* Top hero panel */}
          <div className="relative px-8 pt-10 pb-20">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_0%,oklch(0.32_0.12_295)_0%,oklch(0.16_0.014_285)_70%)]" />
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
                <Wallet className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Fynko</h1>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Finanças do casal
                </p>
              </div>
            </div>
          </div>

          {/* Curved lower sheet */}
          <div className="relative -mt-12 rounded-t-[2rem] bg-[var(--gradient-primary)] px-7 pt-7 pb-8 shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.5)]">
            {mode === "welcome" && (
              <div className="space-y-4 py-4 text-center text-primary-foreground">
                <h2 className="text-xl font-semibold">Bem-vindo</h2>
                <p className="text-sm opacity-80">
                  Acompanhe receitas, despesas e metas a dois — em um só lugar.
                </p>
                <div className="space-y-3 pt-3">
                  <PillButton onClick={() => setMode("login")}>Entrar</PillButton>
                  <PillButton variant="outline" onClick={() => setMode("signup")}>
                    Criar conta
                  </PillButton>
                </div>
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={loading}
                    className="text-xs font-medium uppercase tracking-wider text-primary-foreground/80 underline-offset-4 hover:underline"
                  >
                    Continuar com Google
                  </button>
                </div>
              </div>
            )}

            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <SheetHeader title="Entrar" onBack={() => setMode("welcome")} />
                <IconInput
                  icon={<Mail className="h-4 w-4" />}
                  type="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <IconInput
                  icon={<Lock className="h-4 w-4" />}
                  type="password"
                  placeholder="Senha"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-primary-foreground/80 hover:text-primary-foreground"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <PillButton type="submit" disabled={loading}>Entrar</PillButton>
                <PillButton type="button" variant="outline" onClick={handleGoogle} disabled={loading}>
                  Continuar com Google
                </PillButton>
                <FooterSwap
                  label="Não tem conta?"
                  action="Cadastre-se"
                  onClick={() => setMode("signup")}
                />
              </form>
            )}

            {mode === "signup" && (
              <form onSubmit={handleSignup} className="space-y-4">
                <SheetHeader title="Criar conta" onBack={() => setMode("welcome")} />
                <IconInput
                  icon={<User className="h-4 w-4" />}
                  type="text"
                  placeholder="Seu nome"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <IconInput
                  icon={<Mail className="h-4 w-4" />}
                  type="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <IconInput
                  icon={<Lock className="h-4 w-4" />}
                  type="password"
                  placeholder="Senha (mín. 6)"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <PillButton type="submit" disabled={loading}>Criar conta</PillButton>
                <PillButton type="button" variant="outline" onClick={handleGoogle} disabled={loading}>
                  Continuar com Google
                </PillButton>
                <FooterSwap
                  label="Já tem conta?"
                  action="Entrar"
                  onClick={() => setMode("login")}
                />
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SheetHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-2 flex items-center gap-3 text-primary-foreground">
      <button
        type="button"
        onClick={onBack}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
        aria-label="Voltar"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}

function IconInput({
  icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }) {
  return (
    <div className="relative">
      <input
        {...props}
        className="h-12 w-full rounded-full border border-white/15 bg-card/85 px-5 pr-14 text-sm text-foreground placeholder:text-muted-foreground shadow-inner shadow-black/30 outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/30"
      />
      <div className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
        {icon}
      </div>
    </div>
  );
}

function PillButton({
  variant = "solid",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "outline" }) {
  return (
    <Button
      {...props}
      className={cn(
        "h-12 w-full rounded-full text-sm font-semibold tracking-wide transition active:scale-[0.98]",
        variant === "solid"
          ? "bg-card text-foreground shadow-lg shadow-black/30 hover:bg-card/90"
          : "border border-white/40 bg-white/0 text-primary-foreground hover:bg-white/10",
        className,
      )}
    />
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
    <div className="pt-1 text-center text-sm text-primary-foreground/85">
      {label}{" "}
      <button
        type="button"
        onClick={onClick}
        className="font-semibold text-primary-foreground underline-offset-4 hover:underline"
      >
        {action}
      </button>
    </div>
  );
}
