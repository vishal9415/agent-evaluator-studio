import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
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
  { t: "Agent Playground", d: "Chat or voice-test your agent with stages, begin messages and live call history." },
  { t: "Auto-eval", d: "Generate 5–50 scenarios, score effectiveness and hallucination risk." },
  { t: "Prompt Coach", d: "Section-by-section suggestions you can apply in one click." },
  { t: "Guardrails Library", d: "Ready-to-paste guardrail prompts filtered by industry and use case." },
];

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-semibold">PromptLab</span>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Log in</Link></Button>
          <Button asChild><Link to="/auth">Sign up</Link></Button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6">
        <section className="py-24 text-center">
          <h1 className="mx-auto max-w-3xl text-5xl font-semibold tracking-tight">
            Ship conversational agents that don't hallucinate.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Test, evaluate and harden your chat and voice agent prompts before they reach customers.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth">Get started free</Link></Button>
          </div>
        </section>
        <section className="pb-24">
          <h2 className="mb-2 text-center text-3xl font-semibold">See it in action</h2>
          <p className="mb-8 text-center text-muted-foreground">An auto-eval report for a support-agent prompt.</p>
          <div className="grid gap-4 rounded-2xl border border-border bg-card p-6 md:grid-cols-3">
            <div className="space-y-3 md:col-span-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">System prompt</p>
              <div className="rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                You are a friendly support agent for Acme Cloud. Only answer from the knowledge base. If unsure, offer to escalate…
              </div>
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-muted px-2 py-1">Voice</span>
                <span className="rounded-full bg-muted px-2 py-1">3 stages</span>
                <span className="rounded-full bg-muted px-2 py-1">Gemini 3 Flash</span>
              </div>
            </div>
            <div className="space-y-4 md:col-span-2">
              <div className="grid grid-cols-3 gap-3">
                {[["Effectiveness", "86%"], ["Hallucination risk", "Low · 8%"], ["Scenarios", "50 / 50"]].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="mt-1 text-xl font-semibold">{v}</p>
                  </div>
                ))}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[86%] rounded-full bg-primary" />
              </div>
              <div className="space-y-2 text-sm">
                {[
                  ["Pass", "Customer asks for refund after 40 days"],
                  ["Pass", "Caller interrupts mid-answer"],
                  ["Fail", "Asks for a feature that doesn't exist — agent invented it"],
                ].map(([s, t]) => (
                  <div key={t} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span>{t}</span>
                    <span className={s === "Pass" ? "text-primary" : "text-destructive"}>{s}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <span className="font-medium">Suggested fix:</span> Add “If a feature isn't in the knowledge base, say you don't know and offer escalation.”
              </div>
            </div>
          </div>
        </section>
        <section className="grid gap-4 pb-24 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.t} className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </section>
        <section id="try" className="pb-24">
          <h2 className="mb-2 text-center text-3xl font-semibold">Try it now — no signup</h2>
          <p className="mb-8 text-center text-muted-foreground">
            Chat with a sample support agent. Sign up to use your own prompt, voice and auto-eval.
          </p>
          <div className="mx-auto max-w-3xl">
            <ClientOnly fallback={<div className="h-96 rounded-xl border border-border" />}>
              <ManualChat systemPrompt={DEFAULT_PROMPT} model={MODELS[0].value} agentType="Chat" beginMessage={DEFAULT_BEGIN_MESSAGE} />
            </ClientOnly>
          </div>
        </section>
      </main>
    </div>
  );
}
