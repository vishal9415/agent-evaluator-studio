import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  AudioLines,
  CheckCircle2,
  Coins,
  Cpu,
  Mic2,
  ShieldCheck,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveRealtimeTest } from "@/components/voice-reliability/LiveRealtimeTest";
import { LocalVoiceTest } from "@/components/voice-reliability/LocalVoiceTest";
import { LiveAudioDiagnostics } from "@/components/voice-reliability/LiveAudioDiagnostics";
import { DesignPartnerWorkbench } from "@/components/voice-reliability/DesignPartnerWorkbench";

export const Route = createFileRoute("/_authenticated/voice-reliability")({
  head: () => ({
    meta: [
      { title: "Live Voice Reliability Studio — PromptLab" },
      { name: "description", content: "Inspect microphone audio quality, request browser noise suppression and measure live input signals before agent integration." },
    ],
  }),
  component: VoiceReliabilityPage,
});

function VoiceReliabilityPage() {
  return (
    <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <header className="relative isolate overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-7 text-white shadow-xl shadow-slate-950/10 sm:px-8 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-1/3 h-px w-2/5 bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"><AudioLines className="h-4 w-4" /> Voice test workspace <span className="text-slate-600">/</span> Lab 02</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Live Voice Reliability Studio</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
              Start with the microphone signal: inspect input level, clipping hints and browser audio-processing settings. Then run a hosted or local agent conversation and inspect the events each pipeline exposes.
            </p>
          </div>
          <div className="flex w-fit shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-3 text-xs text-slate-200 backdrop-blur-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200"><Mic2 className="h-4 w-4" /></span>
            <span><span className="block font-medium">Microphone protected</span><span className="mt-0.5 block text-[10px] text-slate-400">Starts only after your action</span></span>
            <CheckCircle2 className="ml-2 h-4 w-4 text-emerald-300" />
          </div>
        </div>
        <div className="relative mt-7 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[11px] text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-sky-300" /> Hosted WebRTC</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[11px] text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Local Ollama</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[11px] text-slate-300"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Session-aware diagnostics</span>
        </div>
      </header>

      <LiveAudioDiagnostics />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <section className="min-w-0 space-y-4" aria-label="Voice test controls">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Choose a pipeline</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Start a controlled test</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Use the same test intent where possible. Keep hosted and local timings separate because their audio and inference paths differ.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground"><Activity className="h-3.5 w-3.5 text-brand" /> 2 execution paths</span>
          </div>

          <Tabs defaultValue="openai" className="space-y-4">
            <TabsList className="grid h-auto min-h-12 w-full max-w-xl grid-cols-2 gap-1 rounded-2xl border border-border/80 bg-card p-1.5 shadow-sm">
              <TabsTrigger value="openai" className="min-h-10 rounded-xl text-xs font-medium data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-sm"><Mic2 className="mr-2 h-4 w-4" /> OpenAI Realtime</TabsTrigger>
              <TabsTrigger value="local" className="min-h-10 rounded-xl text-xs font-medium data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-sm"><Cpu className="mr-2 h-4 w-4" /> Local Ollama</TabsTrigger>
            </TabsList>
            <TabsContent value="openai" className="mt-0 space-y-4"><LiveRealtimeTest /></TabsContent>
            <TabsContent value="local" className="mt-0 space-y-4"><LocalVoiceTest /></TabsContent>
          </Tabs>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24" aria-label="Voice testing guide">
          <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand"><CheckCircle2 className="h-4 w-4" /></span>
              <div><h2 className="text-sm font-semibold">Run checklist</h2><p className="mt-0.5 text-xs text-muted-foreground">Keep each test comparable</p></div>
            </div>
            <ol className="mt-5 space-y-4">
              {[
                ["01", "Confirm your setup", "Select the mode, model and voice settings."],
                ["02", "Run a short conversation", "Use a repeatable phrase and wait for the response to finish."],
                ["03", "Review the timeline", "Look at event ordering and browser-observed gaps."],
              ].map(([number, title, description]) => (
                <li key={number} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 font-mono text-[10px] font-semibold text-muted-foreground">{number}</span>
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-foreground">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300"><Activity className="h-4 w-4" /></span>
              <h2 className="text-sm font-semibold">Read the signals carefully</h2>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">The gap between a detected speech stop and a response-created event is a browser-observed interval. It is not provider processing latency, carrier buffer delay, or time-to-audible response.</p>
            <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200"><AlertTriangle className="h-3.5 w-3.5" /> Not an acoustic benchmark</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Treat the timeline as diagnostic evidence, not a validated carrier or acoustic measurement.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><ShieldCheck className="h-4 w-4" /></span>
              <h2 className="text-sm font-semibold">Cost & data notes</h2>
            </div>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-2.5"><Coins className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><p className="text-xs leading-5 text-muted-foreground"><span className="font-medium text-foreground">Hosted mode:</span> OpenAI Realtime uses provider access and may incur separate API charges.</p></div>
              <div className="flex items-start gap-2.5"><Cpu className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><p className="text-xs leading-5 text-muted-foreground"><span className="font-medium text-foreground">Local mode:</span> Ollama avoids per-token model API fees, but browser speech recognition may process audio online.</p></div>
              <div className="flex items-start gap-2.5"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><p className="text-xs leading-5 text-muted-foreground">OpenAI session history stores basic event metadata only. Raw audio and transcript text are not persisted. Local transcripts stay in page memory.</p></div>
            </div>
          </section>
        </aside>
      </div>
      <DesignPartnerWorkbench />

    </main>
  );
}
