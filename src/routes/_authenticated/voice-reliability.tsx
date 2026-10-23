import { createFileRoute } from "@tanstack/react-router";
import { AudioLines } from "lucide-react";
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
    <main className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
      <header className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><AudioLines className="h-4 w-4" /> PromptLab · Voice Reliability</p>
        <h1 className="text-3xl font-semibold tracking-tight">Voice Reliability Lab</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Test the hosted OpenAI Realtime path or try a local Ollama model in the same workspace. These modes use different audio and inference pipelines, so compare their measurements separately.
        </p>
      </header>
      <Tabs defaultValue="openai" className="space-y-4">
        <TabsList className="grid w-full max-w-xl grid-cols-2">
          <TabsTrigger value="openai">OpenAI Realtime</TabsTrigger>
          <TabsTrigger value="local">Local Ollama · Free model</TabsTrigger>
        </TabsList>
        <TabsContent value="openai" className="space-y-4">
          <LiveRealtimeTest />
        </TabsContent>
        <TabsContent value="local" className="space-y-4">
          <LocalVoiceTest />
        </TabsContent>
      </Tabs>
    </main>
  );
}
