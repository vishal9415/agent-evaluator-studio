import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Mic, MicOff, RefreshCw, Server, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { listLocalVoiceModels } from "@/lib/local-voice.functions";

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

const DEFAULT_VOICE_PROMPT = `You are a warm, concise real-estate lead qualification agent.

Capture these details accurately: city/locality, property type, bedrooms, maximum budget with currency, and purchase timeline.
- Use one or two short, natural sentences per turn.
- Ask only one useful follow-up question at a time.
- Briefly confirm critical details without repeatedly restating the entire conversation.
- A clear yes/no answer confirms the immediately preceding question. Do not ask for the same detail again.
- Preserve the caller's latest explicit correction. Never revert to an earlier budget, location, bedroom count or date.
- Never infer details the caller has not supplied. If a critical value is unclear, ask the caller to repeat that value only.
- Do not claim property availability has been verified.`;

const STATUS_LABELS: Record<string, string> = {
  idle: "Ready",
  listening: "Listening for speech",
  thinking: "Generating a local response",
  speaking: "Speaking response",
};

export function LocalVoiceTest() {
  const checkModels = useServerFn(listLocalVoiceModels);
  const [instructions, setInstructions] = useState(DEFAULT_VOICE_PROMPT);
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
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [speechRate, setSpeechRate] = useState(1);
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
  const speechQueueRef = useRef<string[]>([]);
  const speechStreamCompleteRef = useRef(false);
  const speakNextRef = useRef<(() => void) | null>(null);

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
        setError("Ollama is not reachable from the PromptLab server at 127.0.0.1:11434. This works by default in local development when PromptLab and Ollama run on the same machine. A hosted deployment needs a trusted, privately reachable OLLAMA_BASE_URL; do not expose Ollama directly to the public internet.");
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

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices().slice().sort((a, b) => {
        const priority = (voice: SpeechSynthesisVoice) =>
          /^en-IN$/i.test(voice.lang) ? 0 :
          /^en-(GB|AU)$/i.test(voice.lang) ? 1 :
          /^en-US$/i.test(voice.lang) ? 2 :
          /^en/i.test(voice.lang) ? 3 : 4;
        return priority(a) - priority(b) || a.name.localeCompare(b.name);
      });
      setAvailableVoices(voices);
      setSelectedVoiceURI((current) => {
        if (current && voices.some((voice) => voice.voiceURI === current)) return current;
        return voices.find((voice) => /^en-IN$/i.test(voice.lang))?.voiceURI
          ?? voices.find((voice) => /^en-(GB|AU)$/i.test(voice.lang))?.voiceURI
          ?? voices.find((voice) => /^en-US$/i.test(voice.lang))?.voiceURI
          ?? voices.find((voice) => /^en/i.test(voice.lang))?.voiceURI
          ?? voices[0]?.voiceURI
          ?? "";
      });
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

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

  speakNextRef.current = () => {
    if (speakingRef.current) return;
    const nextText = speechQueueRef.current.shift();
    if (!nextText) {
      if (speechStreamCompleteRef.current) {
        processingRef.current = false;
        setStatus(voiceActiveRef.current ? "listening" : "idle");
        scheduleRecognitionRestart();
      }
      return;
    }
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(nextText);
    const voice = availableVoices.find((candidate) => candidate.voiceURI === selectedVoiceURI)
      ?? availableVoices.find((candidate) => /^en-IN$/i.test(candidate.lang))
      ?? availableVoices.find((candidate) => /^en/i.test(candidate.lang));
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "en-IN";
    }
    utterance.rate = speechRate;
    utterance.pitch = 1;
    speakingRef.current = true;
    setStatus("speaking");
    utterance.onend = () => {
      speakingRef.current = false;
      pushEvent("browser.speech_chunk_finished", "A spoken response segment finished");
      if (speechQueueRef.current.length > 0) {
        speakNextRef.current?.();
      } else if (speechStreamCompleteRef.current) {
        processingRef.current = false;
        setStatus(voiceActiveRef.current ? "listening" : "idle");
        scheduleRecognitionRestart();
      } else {
        setStatus("thinking");
      }
    };
    utterance.onerror = () => {
      speakingRef.current = false;
      if (voiceActiveRef.current) setError("Speech playback failed; the written reply remains available.");
      if (speechQueueRef.current.length > 0) speakNextRef.current?.();
      else if (speechStreamCompleteRef.current) {
        processingRef.current = false;
        setStatus(voiceActiveRef.current ? "listening" : "idle");
        scheduleRecognitionRestart();
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  const queueSpeech = (phrase: string) => {
    const cleaned = phrase.replace(/[*_#]/g, "").replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    speechQueueRef.current.push(cleaned);
    speakNextRef.current?.();
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
    speechQueueRef.current = [];
    speechStreamCompleteRef.current = false;
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
    let firstTokenLatencyMs: number | null = null;
    let speechBuffer = "";
    speechQueueRef.current = [];
    speechStreamCompleteRef.current = false;
    const callerMessage: ChatMessage = { id: ++sequenceRef.current, role: "user", content: text };
    const recent = [...messages, callerMessage].slice(-8);
    setMessages((previous) => [...previous, callerMessage].slice(-20));
    setError("");
    setStatus("thinking");
    pushEvent(fromVoice ? "speech.transcription_received" : "text.message_sent", fromVoice
      ? "Browser delivered a final speech-recognition result"
      : "Text sent to the local voice agent");

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Your session expired. Sign in again before using the local voice agent.");
      }
      const response = await fetch("/api/local-voice-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + sessionData.session.access_token,
        },
        body: JSON.stringify({
          model,
          instructions,
          messages: recent.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!response.ok) {
        let message = "Local voice request failed with HTTP " + response.status;
        try {
          const payload = await response.json() as { error?: string };
          if (payload.error) message = payload.error;
        } catch { /* use status message */ }
        throw new Error(message);
      }
      if (!response.body) throw new Error("Streaming is not available in this browser.");

      const assistantId = ++sequenceRef.current;
      setMessages((previous) => [...previous, { id: assistantId, role: "assistant", content: "" }].slice(-20));
      let reply = "";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let carry = "";
      let streamDone = false;

      const addText = (delta: string) => {
        if (!delta) return;
        if (firstTokenLatencyMs === null) {
          firstTokenLatencyMs = Math.round(performance.now() - started);
          setLastLatencyMs(firstTokenLatencyMs);
          pushEvent("ollama.first_token", "First response token received in " + firstTokenLatencyMs + " ms");
        }
        reply += delta;
        setMessages((previous) => previous.map((message) =>
          message.id === assistantId ? { ...message, content: reply } : message,
        ));
        if (fromVoice && voiceActiveRef.current && "speechSynthesis" in window) {
          speechBuffer += delta;
          const sentenceEnd = /[.!?](?:\s+|$)/g;
          let end = 0;
          let match: RegExpExecArray | null;
          while ((match = sentenceEnd.exec(speechBuffer)) !== null) {
            const finish = sentenceEnd.lastIndex;
            const phrase = speechBuffer.slice(end, match.index + 1).trim();
            if (phrase) queueSpeech(phrase);
            end = finish;
          }
          if (end > 0) speechBuffer = speechBuffer.slice(end).trimStart();
          if (speechBuffer.length > 150) {
            const splitAt = Math.max(speechBuffer.lastIndexOf(", ", 135), speechBuffer.lastIndexOf(" ", 135));
            if (splitAt > 50) {
              queueSpeech(speechBuffer.slice(0, splitAt));
              speechBuffer = speechBuffer.slice(splitAt).trimStart();
            }
          }
        }
      };

      while (!streamDone) {
        const { value, done } = await reader.read();
        carry += decoder.decode(value, { stream: !done });
        const lines = carry.split("\n");
        carry = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let chunk: { message?: { content?: string }; done?: boolean; error?: string };
          try {
            chunk = JSON.parse(trimmed) as typeof chunk;
          } catch {
            continue;
          }
          if (chunk.error) throw new Error(chunk.error);
          if (typeof chunk.message?.content === "string") addText(chunk.message.content);
        }
        if (done) {
          if (carry.trim()) {
            try {
              const finalChunk = JSON.parse(carry) as { message?: { content?: string }; error?: string };
              if (finalChunk.error) throw new Error(finalChunk.error);
              if (typeof finalChunk.message?.content === "string") addText(finalChunk.message.content);
            } catch (cause) {
              if (cause instanceof Error && cause.message !== "Unexpected end of JSON input") throw cause;
            }
          }
          streamDone = true;
        }
      }

      if (!reply.trim()) throw new Error("Ollama returned an empty response. Try again or select another local model.");
      const fullLatency = Math.round(performance.now() - started);
      setLastLatencyMs(firstTokenLatencyMs ?? fullLatency);
      pushEvent("ollama.response_received", "Full response generated in " + fullLatency + " ms");

      if (fromVoice && voiceActiveRef.current && "speechSynthesis" in window) {
        if (speechBuffer.trim()) queueSpeech(speechBuffer);
        speechStreamCompleteRef.current = true;
        speakNextRef.current?.();
      } else {
        speechStreamCompleteRef.current = true;
        processingRef.current = false;
        setStatus(voiceActiveRef.current ? "listening" : "idle");
        scheduleRecognitionRestart();
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Local voice request failed.";
      setError(message);
      pushEvent("ollama.request_failed", message);
      speechStreamCompleteRef.current = true;
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
            A no-paid-model-API path inside Voice Reliability Lab: browser speech recognition → an Ollama model reachable by the PromptLab server → browser/system speech output. It uses a different pipeline from OpenAI Realtime and its results should be measured separately. The default endpoint works when PromptLab and Ollama run on the same machine, such as local development.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Local model, browser-managed speech</p>
            <p className="mt-1 text-muted-foreground">
              PromptLab sends text to the Ollama endpoint configured for its server. A hosted PromptLab deployment will not automatically connect to Ollama on your personal Mac. Microphone transcription uses your browser's speech-recognition service, which may process audio online; do not assume the voice path is fully offline. Speech output uses browser/system voices. Local-mode transcripts and events are not saved to session history.
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

          <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="space-y-1.5 text-sm font-medium">Spoken voice
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"
                value={selectedVoiceURI}
                onChange={(event) => setSelectedVoiceURI(event.target.value)}
                disabled={voiceActive}
              >
                {availableVoices.length === 0 ? <option value="">Use system default voice</option> : availableVoices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}{voice.default ? " · system default" : ""}</option>
                ))}
              </select>
              <span className="block text-xs font-normal text-muted-foreground">Voice quality depends on voices installed in macOS and exposed by Chrome. An English India voice is preferred when available.</span>
            </label>
            <label className="space-y-2 text-sm font-medium">Speaking rate <span className="text-muted-foreground tabular-nums">{speechRate.toFixed(2)}×</span>
              <input
                type="range"
                className="block w-full accent-emerald-600"
                min="0.85"
                max="1.15"
                step="0.05"
                value={speechRate}
                onChange={(event) => setSpeechRate(Number(event.target.value))}
                disabled={voiceActive}
              />
              <span className="block text-xs font-normal text-muted-foreground">Adjust pace for clarity and shorter playback time.</span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {voiceActive ? (
              <Button type="button" variant="destructive" onClick={stopVoice}><MicOff className="mr-2 h-4 w-4" /> Stop microphone</Button>
            ) : (
              <Button type="button" onClick={startVoice} disabled={!installedModels.includes(model) || status === "thinking" || status === "speaking"}><Mic className="mr-2 h-4 w-4" /> Start voice conversation</Button>
            )}
            <span className="rounded-md bg-muted px-3 py-2 text-sm">Status: <strong>{STATUS_LABELS[status]}</strong></span>
            {lastLatencyMs !== null && <span className="text-sm text-muted-foreground">Time to first token: <strong className="text-foreground tabular-nums">{lastLatencyMs} ms</strong></span>}
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
