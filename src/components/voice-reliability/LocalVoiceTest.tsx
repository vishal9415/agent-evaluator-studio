import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Mic, MicOff, RefreshCw, Server, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PROMPT } from "@/lib/playground-constants";
import { listLocalVoiceModels, localVoiceChat } from "@/lib/local-voice.functions";

type LocalModel = "ollama/llama3.2:3b" | "ollama/qwen3:4b";
type ChatMessage = { role: "user" | "assistant"; content: string; id: number };
type LocalEvent = { id: number; elapsedMs: number; type: string; detail: string };
type RecognitionAlternativeLike = { transcript: string };
type RecognitionResultLike = ArrayLike<RecognitionAlternativeLike> & { isFinal: boolean };
type RecognitionEventLike = { results: ArrayLike<RecognitionResultLike> };
type RecognitionErrorLike = { error: string };
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => RecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

const MODEL_OPTIONS: Array<{ value: LocalModel; label: string }> = [
  { value: "ollama/llama3.2:3b", label: "Llama 3.2 3B" },
  { value: "ollama/qwen3:4b", label: "Qwen3 4B" },
];

const STATUS_LABELS: Record<string, string> = {
  idle: "Ready",
  listening: "Listening for speech",
  thinking: "Generating a local response",
  speaking: "Speaking response",
};

export function LocalVoiceTest() {
  const checkModels = useServerFn(listLocalVoiceModels);
  const runLocalChat = useServerFn(localVoiceChat);
  const [instructions, setInstructions] = useState(DEFAULT_PROMPT);
  const [model, setModel] = useState<LocalModel>("ollama/llama3.2:3b");
  const [installedModels, setInstalledModels] = useState<LocalModel[]>([]);
  const [ollamaReachable, setOllamaReachable] = useState<boolean | null>(null);
  const [checkingModels, setCheckingModels] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [voiceActive, setVoiceActive] = useState(false);
  const [error, setError] = useState("");
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const recognizerRef = useRef<RecognitionLike | null>(null);
  const startRecognizerRef = useRef<(() => void) | null>(null);
  const sendMessageRef = useRef<((text: string, fromVoice: boolean) => Promise<void>) | null>(null);
  const voiceActiveRef = useRef(false);
  const processingRef = useRef(false);
  const speakingRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const sequenceRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);

  const refreshModels = useCallback(async () => {
    setCheckingModels(true);
    try {
      const result = await checkModels();
      setOllamaReachable(result.reachable);
      const allowed = result.installedModels.filter(
        (id) => MODEL_OPTIONS.some((option) => option.value === id),
      ) as LocalModel[];
      setInstalledModels(allowed);
      setModel((current) => allowed.includes(current) ? current : (allowed[0] ?? current));
      if (result.reachable && allowed.length === 0) {
        setError("Ollama is running, but neither supported model is installed. In Terminal, run: ollama pull llama3.2:3b");
      } else if (!result.reachable) {
        setError("PromptLab could not reach Ollama at 127.0.0.1:11434. Open Ollama and verify the command ollama list works in Terminal.");
      } else {
        setError("");
      }
    } catch {
      setOllamaReachable(false);
      setError("Could not check local models. Confirm Ollama is running, then refresh the model list.");
    } finally {
      setCheckingModels(false);
    }
  }, [checkModels]);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  const pushEvent = (type: string, detail: string) => {
    const now = performance.now();
    const start = startedAtRef.current ?? now;
    setEvents((previous) => [
      ...previous.slice(-39),
      { id: ++sequenceRef.current, elapsedMs: Math.round(now - start), type, detail },
    ]);
  };

  const scheduleRecognitionRestart = () => {
    if (!voiceActiveRef.current || processingRef.current || speakingRef.current) return;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = window.setTimeout(() => startRecognizerRef.current?.(), 400);
  };

  startRecognizerRef.current = () => {
    const recognizer = recognizerRef.current;
    if (!recognizer || !voiceActiveRef.current || processingRef.current || speakingRef.current) return;
    try {
      recognizer.start();
      setStatus("listening");
    } catch {
      scheduleRecognitionRestart();
    }
  };

  const stopVoice = () => {
    voiceActiveRef.current = false;
    setVoiceActive(false);
    processingRef.current = false;
    speakingRef.current = false;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    try { recognizerRef.current?.abort(); } catch { /* recognizer already stopped */ }
    recognizerRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setStatus("idle");
    pushEvent("local_voice.stopped", "Microphone listening and speech playback stopped");
  };

  const sendMessage = async (rawText: string, fromVoice: boolean) => {
    const text = rawText.trim();
    if (!text || processingRef.current) return;
    if (!installedModels.includes(model)) {
      setError("Select an installed local model first. Refresh the model list if you just downloaded one.");
      return;
    }
    processingRef.current = true;
    const started = performance.now();
    const callerMessage: ChatMessage = { id: ++sequenceRef.current, role: "user", content: text };
    const recent = [...messages, callerMessage].slice(-18);
    setMessages((previous) => [...previous, callerMessage].slice(-20));
    setError("");
    setStatus("thinking");
    pushEvent(fromVoice ? "speech.transcription_received" : "text.message_sent", fromVoice
      ? "Browser delivered a final speech-recognition result"
      : "Text sent to the local voice agent");

    try {
      const result = await runLocalChat({
        data: {
          model,
          instructions,
          messages: recent.map(({ role, content }) => ({ role, content })),
        },
      });
      const reply = result.content.trim();
      const assistantMessage: ChatMessage = { id: ++sequenceRef.current, role: "assistant", content: reply };
      setMessages((previous) => [...previous, assistantMessage].slice(-20));
      const latency = Math.round(performance.now() - started);
      setLastLatencyMs(latency);
      pushEvent("ollama.response_received", "Local model response returned in " + latency + " ms");

      if (fromVoice && voiceActiveRef.current && "speechSynthesis" in window) {
        speakingRef.current = true;
        setStatus("speaking");
        const utterance = new SpeechSynthesisUtterance(reply);
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find((candidate) => candidate.lang.toLowerCase() === "en-in")
          ?? voices.find((candidate) => candidate.lang.toLowerCase().startsWith("en"));
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.onend = () => {
          speakingRef.current = false;
          processingRef.current = false;
          pushEvent("browser.speech_output_finished", "System/browser speech synthesis finished");
          scheduleRecognitionRestart();
        };
        utterance.onerror = () => {
          speakingRef.current = false;
          processingRef.current = false;
          if (voiceActiveRef.current) setError("Speech playback failed; the text reply is still available below.");
          scheduleRecognitionRestart();
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } else {
        processingRef.current = false;
        setStatus(voiceActiveRef.current ? "listening" : "idle");
        scheduleRecognitionRestart();
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Local voice request failed.";
      setError(message);
      pushEvent("ollama.request_failed", message);
      processingRef.current = false;
      setStatus(voiceActiveRef.current ? "listening" : "idle");
      scheduleRecognitionRestart();
    }
  };
  sendMessageRef.current = sendMessage;

  const startVoice = () => {
    setError("");
    const speechWindow = window as SpeechWindow;
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setError("This browser does not expose speech recognition. Try an up-to-date version of Chrome, or use the text box below.");
      return;
    }
    if (!installedModels.includes(model)) {
      setError("No selected local model is installed. Refresh the model list or install Llama 3.2 3B in Terminal.");
      return;
    }
    try {
      const recognition = new Constructor();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        const transcript = lastResult?.[0]?.transcript?.trim();
        if (!transcript || lastResult?.isFinal === false) return;
        if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
        pushEvent("microphone.transcription_final", "Browser speech recognizer returned final text");
        void sendMessageRef.current?.(transcript, true);
      };
      recognition.onerror = (event) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          setError("Browser speech recognition error: " + event.error + ". You can continue using text chat below.");
          pushEvent("browser.speech_recognition_error", event.error);
        }
      };
      recognition.onend = () => scheduleRecognitionRestart();
      recognizerRef.current = recognition;
      voiceActiveRef.current = true;
      setVoiceActive(true);
      startedAtRef.current = performance.now();
      pushEvent("local_voice.started", "Browser microphone and recognition activated after user action");
      startRecognizerRef.current?.();
    } catch {
      voiceActiveRef.current = false;
      setVoiceActive(false);
      setError("Could not start speech recognition. Check browser microphone permissions and try again.");
    }
  };

  const submitText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || processingRef.current) return;
    setDraft("");
    void sendMessage(text, false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> Local voice mode · Ollama</CardTitle>
          <CardDescription>
            A no-paid-model-API path inside Voice Reliability Lab: browser speech recognition → local Ollama model → browser/system speech output. It uses a different pipeline from OpenAI Realtime and its results should be measured separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Local model, browser-managed speech</p>
            <p className="mt-1 text-muted-foreground">
              PromptLab sends text to Ollama on the computer running this app. Microphone transcription uses your browser's speech-recognition service, which may process audio online; do not assume it is fully offline. Speech output uses browser/system voices. PromptLab does not save this local-mode transcript or its event timeline to session history.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="space-y-1.5 text-sm font-medium">Local model
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 font-normal"
                value={model}
                onChange={(event) => setModel(event.target.value as LocalModel)}
                disabled={voiceActive || status === "thinking" || status === "speaking"}
              >
                {MODEL_OPTIONS.map((option) => {
                  const installed = installedModels.includes(option.value);
                  return <option key={option.value} value={option.value} disabled={!installed}>
                    {option.label}{installed ? " · installed" : " · not installed"}
                  </option>;
                })}
              </select>
              <span className="block text-xs font-normal text-muted-foreground">
                {checkingModels ? "Checking Ollama…" : ollamaReachable === true ? "Ollama service reachable on this machine." : ollamaReachable === false ? "Ollama not reachable. Open Ollama and refresh." : "Checking local model service…"}
              </span>
            </label>
            <Button type="button" variant="outline" onClick={() => void refreshModels()} disabled={checkingModels || voiceActive}>
              <RefreshCw className={"mr-2 h-4 w-4 " + (checkingModels ? "animate-spin" : "")} /> Refresh models
            </Button>
          </div>

          <label className="block space-y-1.5 text-sm font-medium">Agent instructions
            <Textarea className="min-h-28 font-mono text-xs" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={5000} disabled={voiceActive || status === "thinking" || status === "speaking"} />
            <span className="block text-xs font-normal text-muted-foreground">{instructions.length}/5000 characters. These instructions are used for local-mode replies only.</span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            {voiceActive ? (
              <Button type="button" variant="destructive" onClick={stopVoice}><MicOff className="mr-2 h-4 w-4" /> Stop microphone</Button>
            ) : (
              <Button type="button" onClick={startVoice} disabled={!installedModels.includes(model) || status === "thinking" || status === "speaking"}><Mic className="mr-2 h-4 w-4" /> Start voice conversation</Button>
            )}
            <span className="rounded-md bg-muted px-3 py-2 text-sm">Status: <strong>{STATUS_LABELS[status]}</strong></span>
            {lastLatencyMs !== null && <span className="text-sm text-muted-foreground">Local model round trip: <strong className="text-foreground tabular-nums">{lastLatencyMs} ms</strong></span>}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Volume2 className="h-5 w-5" /> Local conversation</CardTitle>
          <CardDescription>Use voice above or type a message below. Conversation remains in page memory until you clear it or leave this page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No local turns yet. Start the voice conversation or send a typed message.</p>
          ) : messages.map((message) => (
            <div key={message.id} className={"rounded-lg border p-3 " + (message.role === "assistant" ? "bg-muted/50" : "")}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{message.role === "user" ? "Caller" : "Local agent"}</p>
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            </div>
          ))}
          <form className="flex gap-2" onSubmit={submitText}>
            <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a test message…" maxLength={4000} disabled={!installedModels.includes(model) || status === "thinking" || status === "speaking"} />
            <Button type="submit" disabled={!draft.trim() || !installedModels.includes(model) || status === "thinking" || status === "speaking"}>Send</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { setMessages([]); setEvents([]); setLastLatencyMs(null); setError(""); }} disabled={messages.length === 0 || voiceActive || status === "thinking" || status === "speaking"}>Clear local conversation</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Local-mode event timeline</CardTitle>
          <CardDescription>In-memory browser observations only. These do not measure carrier latency or match OpenAI provider event semantics.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? <p className="text-sm text-muted-foreground">Events will appear here after you send a local turn.</p> : (
            <div className="max-h-72 space-y-2 overflow-auto">
              {events.map((event) => (
                <div key={event.id} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 border-b border-border/60 pb-2 text-xs last:border-0">
                  <span className="font-mono tabular-nums text-muted-foreground">+{event.elapsedMs} ms</span>
                  <div className="min-w-0"><p className="break-all font-medium">{event.type}</p><p className="mt-0.5 text-muted-foreground">{event.detail}</p></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
