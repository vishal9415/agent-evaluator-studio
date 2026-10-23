import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PromptLab" },
      { name: "description", content: "Sign in or create an account to test and harden your AI agent prompts." },
      { property: "og:title", content: "Sign in — PromptLab" },
      { property: "og:description", content: "Access the agent playground and guardrails library." },
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
  const [busy, setBusy] = useState(false);

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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);

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
          toast.success("Account created. Check your email to confirm it, then sign in.");
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Toaster />
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-6"
      >
        <div className="space-y-2 text-center">
          <Link to="/" className="text-sm font-semibold text-muted-foreground">PromptLab</Link>
          <h1 className="text-2xl font-semibold text-foreground">
            {mode === "signin" ? "Sign in to PromptLab" : "Create your PromptLab account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin"
              ? "Continue testing and improving your AI agents."
              : "Create a development account to start testing your agents."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New to PromptLab?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={() => setMode((current) => current === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}
