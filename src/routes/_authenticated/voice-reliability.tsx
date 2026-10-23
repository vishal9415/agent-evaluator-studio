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
    <main className="mx-auto max-w-[1800px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
      <header className="relative mb-5 overflow-hidden rounded-[28px] bg-[#102b25] px-5 py-6 text-white shadow-[0_24px_70px_-35px_rgba(16,43,37,0.65)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        <div className="pointer-events-none absolute -right-14 -top-20 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/80"><AudioLines className="h-3.5 w-3.5" /> Voice agent test bench</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-[42px]">Voice Reliability Lab<span className="text-emerald-300">.</span></h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 sm:text-base sm:leading-7">Test conversation flow, inspect observable events, and uncover rough edges before a real customer hits them. Choose the voice pipeline that fits your test.</p>
          </div>
          <span className="relative inline-flex w-fit shrink-0 items-center gap-2 rounded-xl border border-emerald-200/20 bg-white/[0.06] px-3.5 py-2.5 text-xs font-medium text-emerald-50/80"><ShieldCheck className="h-4 w-4 text-emerald-200" /> Microphone starts only after you click</span>
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-2 border-t border-white/10 pt-5 sm:grid-cols-3 sm:gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">Test modes</p><p className="mt-2 text-xl font-semibold sm:text-2xl">02</p><p className="mt-1 text-[11px] text-white/45">Hosted + local model</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">Connection</p><p className="mt-2 text-base font-semibold sm:text-lg">On demand</p><p className="mt-1 text-[11px] text-white/45">Starts from your action</p></div>
          <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 sm:col-span-1 sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">Evidence</p><p className="mt-2 text-base font-semibold sm:text-lg">Events & timing</p><p className="mt-1 text-[11px] text-white/45">Not carrier-level metrics</p></div>
        </div>
      </header>

      <div className="mb-5 grid gap-3 xl:grid-cols-2">
        <section className="group relative overflow-hidden rounded-[22px] border border-[#dce8e1] bg-white p-5 shadow-[0_12px_40px_-30px_rgba(16,43,37,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-30px_rgba(16,43,37,0.42)] sm:p-6">
          <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-sky-100/70 blur-2xl transition-colors group-hover:bg-sky-100" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100"><Mic2 className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold tracking-tight text-[#17352d]">OpenAI Realtime</h2><span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700">Hosted</span></div>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Provider-managed voice interaction over WebRTC. Best for testing a hosted speech-to-speech path with the provider events available to this app.</p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800"><Coins className="h-3.5 w-3.5" /> OpenAI usage may incur separate charges</p>
            </div>
          </div>
        </section>
        <section className="group relative overflow-hidden rounded-[22px] border border-[#dce8e1] bg-white p-5 shadow-[0_12px_40px_-30px_rgba(16,43,37,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-30px_rgba(16,43,37,0.42)] sm:p-6">
          <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-emerald-100/70 blur-2xl transition-colors group-hover:bg-emerald-100" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"><Cpu className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold tracking-tight text-[#17352d]">Local Ollama</h2><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">No token API fee</span></div>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Uses a language model served by Ollama on the machine hosting PromptLab, with browser speech tools for microphone input and spoken replies.</p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> Browser transcription may use an online service</p>
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-[24px] border border-[#e0e9e3] bg-white shadow-[0_12px_40px_-30px_rgba(16,43,37,0.35)]" aria-label="Choose voice testing mode">
        <div className="border-b border-[#e5eee8] bg-[#f8faf9] px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4c8069]">Test console</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-[#17352d] sm:text-xl">Choose a test mode</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Switch pipelines here; their results measure different things and should not be directly compared.</p></div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dce8e1] bg-white px-3 py-2 text-[11px] font-medium text-[#476457]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ready when you are</span>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <Tabs defaultValue="openai" className="space-y-5">
            <TabsList className="grid h-auto w-full max-w-2xl grid-cols-2 gap-1 rounded-2xl border border-[#e0e9e3] bg-[#f2f6f3] p-1.5">
              <TabsTrigger value="openai" className="min-h-11 rounded-xl text-xs font-semibold data-[state=active]:bg-[#153b30] data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-sm"><Mic2 className="mr-2 h-4 w-4" /> OpenAI Realtime</TabsTrigger>
              <TabsTrigger value="local" className="min-h-11 rounded-xl text-xs font-semibold data-[state=active]:bg-[#153b30] data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-sm"><Cpu className="mr-2 h-4 w-4" /> Local Ollama</TabsTrigger>
            </TabsList>
            <TabsContent value="openai" className="space-y-4"><LiveRealtimeTest /></TabsContent>
            <TabsContent value="local" className="space-y-4"><LocalVoiceTest /></TabsContent>
          </Tabs>
        </div>
      </section>

      <p className="mt-5 flex items-start gap-2 rounded-2xl border border-[#dce8e1] bg-white px-4 py-3.5 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#347558]" /> Only basic event metadata is saved for OpenAI sessions; raw audio and transcript text are not persisted to session history. Local-mode transcripts and its event timeline stay in page memory. Voice timing observations are not carrier-level or acoustic benchmark results.</p>
    </main>
  );
}
