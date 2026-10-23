import { createFileRoute } from "@tanstack/react-router";
import { AudioLines } from "lucide-react";
import { LiveRealtimeTest } from "@/components/voice-reliability/LiveRealtimeTest";

export const Route = createFileRoute("/_authenticated/voice-reliability")({
  head: () => ({
    meta: [
      { title: "Voice Reliability Lab — PromptLab" },
      { name: "description", content: "Run a live OpenAI Realtime voice session and inspect browser-observed conversation events." },
    ],
  }),
  component: VoiceReliabilityPage,
});

function VoiceReliabilityPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
      <header className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><AudioLines className="h-4 w-4" /> PromptLab · Voice Reliability</p>
        <h1 className="text-3xl font-semibold tracking-tight">Live voice test</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Validate the browser-to-agent path before adding repeatable acoustic benchmarks. This initial integration records provider events and local browser receive timestamps; it does not claim carrier-level measurements or persist call history.
        </p>
      </header>
      <LiveRealtimeTest />
    </main>
  );
}
