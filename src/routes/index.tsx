import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

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
        <section className="grid gap-4 pb-24 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.t} className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
