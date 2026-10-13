import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Gauge, Mic, MessageSquare, ShieldCheck, Sparkles, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManualChat } from "@/components/playground/ManualChat";
import { DEFAULT_BEGIN_MESSAGE, DEFAULT_PROMPT, MODELS } from "@/lib/playground-constants";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PromptLab — Test and harden AI agent prompts" },
      { name: "description", content: "Test chat and voice agents, auto-evaluate prompts against generated scenarios, and apply proven guardrails." },
      { property: "og:title", content: "PromptLab — Test and harden AI agent prompts" },
      { property: "og:description", content: "Agent playground, auto-eval, prompt coach and a guardrails library in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

const features = [
  { Icon: Mic, t: "Agent Playground", d: "Talk to your agent by chat or live voice. Stages, begin messages, interruptions and full call history." },
  { Icon: Gauge, t: "Auto-eval", d: "Generate 5–50 realistic scenarios and get an effectiveness score plus hallucination risk." },
  { Icon: Wand2, t: "Prompt Coach", d: "Reads your whole prompt, understands the goal, and suggests fixes you apply in one click." },
  { Icon: ShieldCheck, t: "Guardrails Library", d: "50+ ready-to-paste guardrails, or generate a tailored set from your use case." },
];

const steps = [
  ["01", "Paste your prompt", "Add a begin message, system prompt and optional stages."],
  ["02", "Test it", "Chat or call your agent, or let us run dozens of scenarios."],
  ["03", "Fix and ship", "Apply suggested changes and guardrails, then re-test."],
];

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-brand-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            PromptLab
          </span>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><a href="#features">Features</a></Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><a href="#try">Try it</a></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/auth">Log in</Link></Button>
            <Button asChild size="sm"><Link to="/auth">Sign up</Link></Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden" style={{ backgroundImage: "var(--gradient-hero)" }}>
          <div className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center md:pt-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> For chat and voice agent builders
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
              Ship conversational agents that <span className="text-brand">don't hallucinate.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Test, score and harden your agent prompts against real-world scenarios before they reach a single customer.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="gap-2"><Link to="/auth">Get started free <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline"><a href="#try">Try without signup</a></Button>
            </div>

            <div className="mx-auto mt-16 max-w-5xl rounded-2xl border border-border bg-card p-2 text-left" style={{ boxShadow: "var(--shadow-elegant)" }}>
              <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="ml-3 font-mono text-[11px] text-muted-foreground">Auto-eval report · support-agent-v3</span>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-5">
                <div className="space-y-3 md:col-span-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">System prompt</p>
                  <div className="rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                    You are a friendly support agent for Acme Cloud. Only answer from the knowledge base. If unsure, offer to escalate…
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {["Voice", "3 stages", "Gemini 3 Flash"].map((t) => (
                      <span key={t} className="rounded-full bg-muted px-2 py-1">{t}</span>
                    ))}
                  </div>
                  <div className="rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm">
                    <p className="flex items-center gap-1.5 font-medium"><Wand2 className="h-3.5 w-3.5 text-brand" /> Suggested fix</p>
                    <p className="mt-1 text-muted-foreground">“If a feature isn't in the knowledge base, say you don't know and offer to escalate.”</p>
                  </div>
                </div>
                <div className="space-y-4 md:col-span-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[["Effectiveness", "86%"], ["Hallucination", "Low · 8%"], ["Scenarios", "50/50"]].map(([k, v]) => (
                      <div key={k} className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">{k}</p>
                        <p className="mt-1 text-lg font-semibold md:text-xl">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[86%] rounded-full bg-brand" />
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      [true, "Customer asks for refund after 40 days"],
                      [true, "Caller interrupts mid-answer"],
                      [true, "User tries to change the agent's role"],
                      [false, "Asks for a feature that doesn't exist — agent invented it"],
                    ].map(([ok, t]) => (
                      <div key={String(t)} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                        <span className="truncate">{t}</span>
                        {ok ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-brand"><Check className="h-3.5 w-3.5" /> Pass</span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-destructive"><X className="h-3.5 w-3.5" /> Fail</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Everything you need to trust your agent</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">From the first draft to production — one place to test, measure and improve.</p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ Icon, t, d }) => (
              <div key={t} className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-brand/40">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand"><Icon className="h-4 w-4" /></span>
                <h3 className="mt-4 font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-20 md:grid-cols-3">
            {steps.map(([n, t, d]) => (
              <div key={n}>
                <span className="font-mono text-sm text-brand">{n}</span>
                <h3 className="mt-2 text-lg font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="try" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              <MessageSquare className="h-3.5 w-3.5" /> Live demo
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Try it now — no signup</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Chat with a sample support agent. Sign up to use your own prompt, voice and auto-eval.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-3xl rounded-2xl" style={{ boxShadow: "var(--shadow-elegant)" }}>
            <ClientOnly fallback={<div className="h-96 rounded-xl border border-border" />}>
              <ManualChat systemPrompt={DEFAULT_PROMPT} model={MODELS[0].value} agentType="Chat" beginMessage={DEFAULT_BEGIN_MESSAGE} />
            </ClientOnly>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="rounded-2xl bg-primary px-8 py-14 text-center text-primary-foreground">
            <h2 className="text-3xl font-semibold tracking-tight">Stop guessing. Start measuring.</h2>
            <p className="mx-auto mt-3 max-w-md opacity-80">Run your first evaluation in under two minutes.</p>
            <Button asChild size="lg" variant="secondary" className="mt-8 gap-2">
              <Link to="/auth">Get started free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>© 2026 PromptLab</span>
          <Link to="/auth" className="hover:text-foreground">Log in</Link>
        </div>
      </footer>
    </div>
  );
}
