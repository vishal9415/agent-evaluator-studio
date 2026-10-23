import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, AudioLines, CheckCircle2, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PromptLab" },
      { name: "description", content: "Sign in or create an account to test and improve your conversational AI agents." },
      { property: "og:title", content: "Sign in — PromptLab" },
      { property: "og:description", content: "Access the PromptLab evaluation studio and guardrails library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive && data.session) void navigate({ to: "/playground" });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive && session) void navigate({ to: "/playground" });
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setConfirmationMessage("");

    try {
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { emailRedirectTo: window.location.origin + "/auth" },
            });

      if (result.error) throw result.error;

      if (mode === "signup") {
        if (result.data.session) {
          toast.success("Account created.");
          await navigate({ to: "/playground" });
        } else {
          const message = "Your account was created. Check your inbox for the confirmation email, then return here to sign in.";
          setConfirmationMessage(message);
          toast.success("Check your email to confirm your account.");
          setMode("signin");
          setPassword("");
        }
      } else {
        await navigate({ to: "/playground" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode((current) => current === "signin" ? "signup" : "signin");
    setPassword("");
    setShowPassword(false);
    setConfirmationMessage("");
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)]">
      <Toaster />
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#0b1311] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="pointer-events-none absolute -right-24 top-16 h-96 w-96 rounded-full bg-emerald-300/10 blur-[100px]" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-teal-400/10 blur-[90px]" aria-hidden="true" />
        <div className="landing-grid absolute inset-0 opacity-20" aria-hidden="true" />
        <Link to="/" className="relative z-10 flex w-fit items-center gap-3" aria-label="PromptLab home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-300 text-[#102019]"><AudioLines className="h-5 w-5" /></span>
          <span><span className="block text-lg font-semibold tracking-tight">PromptLab</span><span className="block text-[10px] tracking-[0.16em] text-white/45">AGENT EVALUATION STUDIO</span></span>
        </Link>

        <div className="relative z-10 my-14 max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-200/[0.07] px-3 py-1.5 text-xs font-medium text-emerald-100"><Sparkles className="h-3.5 w-3.5" /> Test before you ship</p>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-[-0.045em] xl:text-5xl">Better prompts need more than a gut check.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/60">Challenge your conversational AI, compare behavior across versions, and make review findings easier to act on.</p>
          <div className="mt-9 space-y-4 border-t border-white/10 pt-6">
            {[
              ["Pressure-test", "Probe edge cases, prompt injection, and knowledge boundaries."],
              ["Compare", "Review prompt changes against the same scenarios."],
              ["Learn", "Turn failures into a more useful next iteration."],
            ].map(([title, description]) => <div key={title} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /><div><p className="text-sm font-medium text-white">{title}</p><p className="mt-1 text-sm leading-5 text-white/45">{description}</p></div></div>)}
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5 text-xs text-white/45">
          <ShieldCheck className="h-4 w-4 text-emerald-200" />
          <span>Evaluation findings support review; they are not safety guarantees.</span>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:justify-end lg:px-10">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold lg:hidden"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground"><AudioLines className="h-4 w-4" /></span>PromptLab</Link>
          <Link to="/" className="hidden items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:inline-flex"><ArrowLeft className="h-4 w-4" /> Back to home</Link>
          <Link to="/" className="text-xs text-muted-foreground transition-colors hover:text-foreground lg:hidden">Home</Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 pt-4 sm:px-8 lg:px-10 lg:pb-16">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{mode === "signin" ? "Welcome back" : "Create your workspace access"}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{mode === "signin" ? "Sign in to PromptLab" : "Start testing your agents"}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{mode === "signin" ? "Pick up where you left off in your evaluation studio." : "Create an account to evaluate prompts, explore guardrails, and review results."}</p>
            </div>

            {confirmationMessage && <div role="status" className="mb-5 flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm leading-6"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{confirmationMessage}</span></div>}

            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" name="email" type="email" placeholder="you@company.com" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} className="h-11 bg-card" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3"><Label htmlFor="password">Password</Label><span className="text-[11px] text-muted-foreground">{mode === "signup" ? "At least 6 characters" : "Your account password"}</span></div>
                <div className="relative">
                  <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} className="h-11 bg-card pr-12" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={busy} className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </div>

              <Button type="submit" className="h-11 w-full bg-brand font-semibold text-brand-foreground hover:bg-brand/90" disabled={busy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}{!busy && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>

              <div className="flex items-center gap-3 py-1"><span className="h-px flex-1 bg-border" /><span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Account access</span><span className="h-px flex-1 bg-border" /></div>
              <p className="text-center text-sm text-muted-foreground">{mode === "signin" ? "New to PromptLab?" : "Already have an account?"}{" "}<button type="button" className="font-semibold text-foreground underline decoration-brand/60 underline-offset-4 transition-colors hover:decoration-brand disabled:opacity-50" disabled={busy} onClick={switchMode}>{mode === "signin" ? "Create an account" : "Sign in instead"}</button></p>
            </form>

            <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">Use a unique password for your account. Don't enter production customer data into the public demo.</p>
          </div>
        </div>

        <footer className="px-5 py-5 text-center text-[11px] text-muted-foreground sm:px-8">© 2026 PromptLab <span className="mx-2">·</span> Test before you ship.</footer>
      </main>
    </div>
  );
}
