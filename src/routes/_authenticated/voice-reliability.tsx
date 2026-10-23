import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, AudioLines, Coins, Cpu, Mic2, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveRealtimeTest } from "@/components/voice-reliability/LiveRealtimeTest";
import { LocalVoiceTest } from "@/components/voice-reliability/LocalVoiceTest";

export const Route = createFileRoute("/_authenticated/voice-reliability")({
  head: () => ({
    meta: [
      { title: "Voice Reliability Lab — PromptLab" },
      { name: "description", content: "Compare hosted OpenAI Realtime with local Ollama-assisted voice testing." },
    ],
  }),
  component: VoiceReliabilityPage,
});

function VoiceReliabilityPage() {
  return (
    <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand"><AudioLines className="h-3.5 w-3.5" /> Voice test workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Voice Reliability Lab</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            Test a hosted realtime voice agent or try a local language model using your browser's speech tools. Each mode exposes different events, so treat their timing and quality results separately.
          </p>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-brand" /> Microphone starts only after you click</span>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300"><Mic2 className="h-5 w-5" /></div>
          <div className="min-w-0"><h2 className="text-sm font-semibold">OpenAI Realtime</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Provider-managed speech and response over WebRTC. Requires OpenAI access and may incur API charges.</p><p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"><Coins className="h-3.5 w-3.5" /> Provider billing applies separately</p></div>
        </section>
        <section className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><Cpu className="h-5 w-5" /></div>
          <div className="min-w-0"><h2 className="text-sm font-semibold">Local Ollama</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Runs language generation using an installed local model on the machine hosting PromptLab, without per-token model API fees.</p><p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Browser speech recognition may process audio online</p></div>
        </section>
      </div>

      <section className="space-y-4" aria-label="Choose voice testing mode">
        <div><h2 className="text-base font-semibold">Choose a test mode</h2><p className="mt-1 text-sm text-muted-foreground">Switch modes without leaving this workspace.</p></div>
        <Tabs defaultValue="openai" className="space-y-4">
          <TabsList className="grid h-auto w-full max-w-2xl grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1">
            <TabsTrigger value="openai" className="min-h-10 rounded-lg text-xs sm:text-sm">OpenAI Realtime</TabsTrigger>
            <TabsTrigger value="local" className="min-h-10 rounded-lg text-xs sm:text-sm">Local Ollama · Free model</TabsTrigger>
          </TabsList>
          <TabsContent value="openai" className="space-y-4">
            <LiveRealtimeTest />
          </TabsContent>
          <TabsContent value="local" className="space-y-4">
            <LocalVoiceTest />
          </TabsContent>
        </Tabs>
      </section>

      <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/25 px-4 py-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /> Only basic event metadata is saved for OpenAI sessions; raw audio and transcript text are not persisted to session history. Local-mode transcripts and its event timeline stay in page memory. Voice timing observations are not carrier-level or acoustic benchmark results.</p>
    </main>
  );
}
