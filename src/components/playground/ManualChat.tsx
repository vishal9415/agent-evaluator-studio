import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, PhoneOff, Send, Volume2, VolumeX, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { chatCompletion, synthesizeSpeech } from "@/lib/playground.functions";
import { fillVariables, transitionToolName, type Stage } from "@/lib/playground-constants";
import { CallHistory } from "@/components/playground/CallHistory";
import { useCallHistory } from "@/lib/call-history";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  systemPrompt: string;
  model: string;
  agentType: string;
  beginMessage?: string;
  stages?: Stage[];
  variables?: Record<string, string>;
}


type AnyWindow = Window & {
  webkitSpeechRecognition?: new () => any;
  SpeechRecognition?: new () => any;
};

// Curated ElevenLabs voices (natural, human-like)
const ELEVEN_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", desc: "Warm female, conversational" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", desc: "Friendly female" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", desc: "British female, calm" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", desc: "Mature female, narration" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", desc: "Young female, expressive" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", desc: "Soft female" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", desc: "Mature male, British" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", desc: "American male, confident" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", desc: "Australian male, casual" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", desc: "Young male, energetic" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris", desc: "Conversational male" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", desc: "Deep male, narration" },
];

const ELEVEN_MODELS = [
  { id: "eleven_turbo_v2_5", name: "Turbo v2.5 (low latency)" },
  { id: "eleven_multilingual_v2", name: "Multilingual v2 (highest quality)" },
  { id: "eleven_turbo_v2", name: "Turbo v2 (fast)" },
];

const RECOG_LANGS = [
  { v: "en-IN", label: "English (India)" },
  { v: "en-US", label: "English (US)" },
  { v: "en-GB", label: "English (UK)" },
  { v: "hi-IN", label: "Hindi (India)" },
  { v: "es-ES", label: "Spanish" },
  { v: "fr-FR", label: "French" },
  { v: "de-DE", label: "German" },
];

export function ManualChat({
  systemPrompt,
  model,
  agentType,
  beginMessage = "",
  stages = [],
  variables = {},
}: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [stageId, setStageId] = useState<string | null>(stages[0]?.id ?? null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState(agentType === "voice");
  const [listening, setListening] = useState(false);
  const [speakOutput, setSpeakOutput] = useState(agentType === "voice");
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  // ElevenLabs voice settings
  const [voiceId, setVoiceId] = useState(ELEVEN_VOICES[0].id);
  const [ttsModel, setTtsModel] = useState(ELEVEN_MODELS[0].id);
  const [speed, setSpeed] = useState(1.0);
  const [stability, setStability] = useState(0.4);
  const [similarity, setSimilarity] = useState(0.8);
  const [style, setStyle] = useState(0.3);
  const [speakerBoost, setSpeakerBoost] = useState(true);

  // VAD / recognition settings
  const [recogLang, setRecogLang] = useState("en-US");
  const [muteWhileSpeaking, setMuteWhileSpeaking] = useState(true);
  const [interim, setInterim] = useState(true);
  const [silenceMs, setSilenceMs] = useState(1200);
  const [minSpeechChars, setMinSpeechChars] = useState(2);
  const [autoSend, setAutoSend] = useState(true);

  // Interruption (barge-in)
  const [bargeIn, setBargeIn] = useState(true);
  const [bargeThreshold, setBargeThreshold] = useState(0.06);

  const [ttsFallback, setTtsFallback] = useState(false);

  const chat = useServerFn(chatCompletion);
  const tts = useServerFn(synthesizeSpeech);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimer = useRef<number | null>(null);
  const lastTranscript = useRef<string>("");
  const sessionRef = useRef(false);
  const micMuted = useRef(false);
  const agentSpeakingRef = useRef(false);
  const speechEpochRef = useRef(0);
  const suppressRecognitionUntilRef = useRef(0);
  const bargeInRef = useRef(bargeIn);
  const bargeThresholdRef = useRef(bargeThreshold);

  // Mic energy monitor (used for interruption detection)
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const { calls, activeId, startCall, addEvent, endCall, clearHistory } = useCallHistory();
  const callIdRef = useRef<string | null>(null);

  useEffect(() => {
    bargeInRef.current = bargeIn;
    bargeThresholdRef.current = bargeThreshold;
  }, [bargeIn, bargeThreshold]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setVoice(agentType === "voice");
    setSpeakOutput(agentType === "voice");
  }, [agentType]);

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    const opener = fillVariables(beginMessage ?? "", variables).trim();
    if (!opener) return;
    seeded.current = true;
    setMessages([{ role: "assistant", content: opener }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beginMessage]);

  const ensureCall = useCallback(
    (mode: "voice" | "chat") => {
      if (callIdRef.current) return callIdRef.current;
      const id = startCall(mode, model);
      callIdRef.current = id;
      return id;
    },
    [startCall, model],
  );

  const log = useCallback(
    (kind: "user" | "agent" | "stage" | "system", text: string) => {
      addEvent(callIdRef.current, kind, text);
    },
    [addEvent],
  );

  const resumeRecognition = useCallback((delay = 650) => {
    suppressRecognitionUntilRef.current = Date.now() + delay;
    window.setTimeout(() => {
      if (!sessionRef.current || agentSpeakingRef.current || !recRef.current) return;
      try { recRef.current.start(); } catch { /* already started */ }
    }, delay);
  }, []);

  const stopAgentSpeech = useCallback((reason?: "interrupted") => {
    speechEpochRef.current += 1;
    const currentAudio = audioRef.current;
    audioRef.current = null;
    if (currentAudio) {
      try {
        currentAudio.onended = null;
        currentAudio.onerror = null;
        currentAudio.onpause = null;
        currentAudio.pause();
        currentAudio.removeAttribute("src");
        currentAudio.load();
      } catch {
        /* noop */
      }
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    agentSpeakingRef.current = false;
    micMuted.current = false;
    lastTranscript.current = "";
    setInput("");
    setAgentSpeaking(false);
    if (sessionRef.current) resumeRecognition();
    if (reason === "interrupted") addEvent(callIdRef.current, "system", "Caller interrupted — agent stopped speaking");
  }, [addEvent, resumeRecognition]);

  // Continuous mic level monitor: detects the caller talking over the agent.
  const startMicMonitor = useCallback(async () => {
    if (typeof window === "undefined" || audioCtxRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = stream;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let loud = 0;

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        if (agentSpeakingRef.current && bargeInRef.current && rms > bargeThresholdRef.current) {
          loud += 1;
          if (loud >= 3) {
            loud = 0;
            stopAgentSpeech("interrupted");
          }
        } else if (rms <= bargeThresholdRef.current) {
          loud = 0;
        }
        rafRef.current = window.requestAnimationFrame(tick);
      };
      rafRef.current = window.requestAnimationFrame(tick);
    } catch {
      /* monitoring is optional — recognition still works */
    }
  }, [stopAgentSpeech]);

  const stopMicMonitor = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const speakBrowser = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const speechEpoch = ++speechEpochRef.current;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = recogLang || "en-US";
    u.rate = speed;
    const voices = window.speechSynthesis.getVoices();
    const base = u.lang.split("-")[0];
    const preferred =
      voices.find((v) => /female|samantha|zira|google.*female|aditi|raveena/i.test(v.name) && v.lang.startsWith(base)) ||
      voices.find((v) => v.lang === u.lang) ||
      voices.find((v) => v.lang.startsWith(base));
    if (preferred) u.voice = preferred;
    agentSpeakingRef.current = true;
    setAgentSpeaking(true);
    micMuted.current = true;
    try { recRef.current?.abort(); } catch { /* recognition may already be stopped */ }
    const done = () => {
      if (speechEpoch !== speechEpochRef.current) return;
      agentSpeakingRef.current = false;
      micMuted.current = false;
      lastTranscript.current = "";
      setAgentSpeaking(false);
      resumeRecognition();
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  }, [recogLang, speed, resumeRecognition]);

  const speak = useCallback(
    async (text: string) => {
      if (!speakOutput) return;
      if (ttsFallback) {
        speakBrowser(text);
        return;
      }
      const speechEpoch = ++speechEpochRef.current;
      try {
        const res = await tts({
          data: {
            text,
            voiceId,
            modelId: ttsModel,
            speed,
            stability,
            similarityBoost: similarity,
            style,
            useSpeakerBoost: speakerBoost,
          },
        });
        if (speechEpoch !== speechEpochRef.current) return;
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        const audio = new Audio(`data:${res.mime};base64,${res.audio}`);
        audioRef.current = audio;
        agentSpeakingRef.current = true;
        setAgentSpeaking(true);
        micMuted.current = true;
        try { recRef.current?.abort(); } catch { /* recognition may already be stopped */ }
        const done = () => {
          if (speechEpoch !== speechEpochRef.current) return;
          audioRef.current = null;
          agentSpeakingRef.current = false;
          micMuted.current = false;
          lastTranscript.current = "";
          setAgentSpeaking(false);
          resumeRecognition();
        };
        audio.onended = done;
        audio.onerror = done;
        audio.onpause = done;
        await audio.play();
      } catch (e) {
        if (speechEpoch !== speechEpochRef.current) return;
        const msg = e instanceof Error ? e.message : "TTS failed";
        toast.warning(`Premium voice unavailable — using browser voice. (${msg.slice(0, 100)})`);
        setTtsFallback(true);
        micMuted.current = false;
        speakBrowser(text);
      }
    },
    [speakOutput, ttsFallback, speakBrowser, tts, voiceId, ttsModel, speed, stability, similarity, style, speakerBoost, resumeRecognition],
  );


  const stagePayload = (id: string | null) => {
    const stage = stages.find((s) => s.id === id);
    if (!stage) return {};
    return {
      stagePrompt: fillVariables(stage.prompt, variables),
      transitions: stage.transitions
        .filter((t) => stages.some((s) => s.id === t.target))
        .map((t) => {
          const target = stages.find((s) => s.id === t.target)!;
          return {
            tool: transitionToolName(target.name),
            targetId: target.id,
            targetName: target.name,
            condition: t.condition,
          };
        }),
    };
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    // A typed message outside a voice call still belongs to a logged session.
    ensureCall(listening ? "voice" : "chat");
    log("user", trimmed);
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    const callAtSend = callIdRef.current;
    try {
      const filledSystem = fillVariables(systemPrompt, variables);
      let activeStage = stageId;
      let res = await chat({
        data: { model, systemPrompt: filledSystem, messages: next, ...stagePayload(activeStage) },
      });
      const history: Msg[] = [...next];

      if (res.moveTo) {
        activeStage = res.moveTo.id;
        setStageId(activeStage);
        if (res.content) history.push({ role: "assistant", content: res.content });
        history.push({
          role: "assistant",
          content: `→ Moved to stage "${res.moveTo.name}"${res.moveTo.reason ? `: ${res.moveTo.reason}` : ""}`,
        });
        log("stage", `Moved to "${res.moveTo.name}"${res.moveTo.reason ? `: ${res.moveTo.reason}` : ""}`);
        setMessages(history);
        if (!res.content) {
          res = await chat({
            data: {
              model,
              systemPrompt: filledSystem,
              messages: next,
              ...stagePayload(activeStage),
            },
          });
        }
      }

      const reply = res.content || "(empty response)";
      setMessages([...history, { role: "assistant", content: reply }]);
      log("agent", reply);
      if (!voice || (sessionRef.current && callIdRef.current === callAtSend)) void speak(reply);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };


  const clearSilence = () => {
    if (silenceTimer.current) {
      window.clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  };

  const beginRecognition = () => {
    const w = window as AnyWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return false;
    const rec = new SR();
    rec.lang = recogLang;
    rec.interimResults = interim;
    rec.continuous = true;
    lastTranscript.current = "";

    rec.onresult = (ev: any) => {
      // Ignore anything captured while the agent's own voice is playing.
      if (micMuted.current || agentSpeakingRef.current || Date.now() < suppressRecognitionUntilRef.current) return;
      const transcript = Array.from(ev.results)
        .slice(ev.resultIndex)
        .map((r: any) => r[0].transcript)
        .join(" ")
        .trim();
      if (!transcript) return;
      lastTranscript.current = transcript;
      setInput(transcript);

      clearSilence();
      silenceTimer.current = window.setTimeout(() => {
        const utterance = lastTranscript.current.trim();
        if (utterance.length >= minSpeechChars && autoSend) {
          lastTranscript.current = "";
          setInput("");
          void send(utterance);
        }
      }, silenceMs);
    };
    rec.onerror = (ev: any) => {
      clearSilence();
      if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
        sessionRef.current = false;
        setListening(false);
        toast.error("Microphone permission denied");
      }
    };
    rec.onend = () => {
      clearSilence();
       if (sessionRef.current && !agentSpeakingRef.current) {
        // keep the mic live for the whole call
        window.setTimeout(() => {
          if (!sessionRef.current) return;
          try { rec.start(); } catch { /* already started */ }
        }, 250);
      } else {
        setListening(false);
      }
    };
    recRef.current = rec;
    try {
      rec.start();
      return true;
    } catch {
      return false;
    }
  };

  const startListening = () => {
    const w = window as AnyWindow;
    if (!(w.SpeechRecognition || w.webkitSpeechRecognition)) {
      toast.error("Speech recognition not supported in this browser. Try Chrome.");
      return;
    }
    sessionRef.current = true;
    if (beginRecognition()) {
      setListening(true);
      void startMicMonitor();
      const id = ensureCall("voice");
      addEvent(id, "system", "Call started");
      toast.success("Call live — speak any time. Use End call to hang up.");
    } else {
      sessionRef.current = false;
      toast.error("Could not start mic");
    }
  };

  const hangUp = (options?: { sendPending?: boolean }) => {
    sessionRef.current = false;
    speechEpochRef.current += 1;
    clearSilence();
    try { recRef.current?.abort(); } catch { /* noop */ }
    recRef.current = null;
    setListening(false);
    stopAgentSpeech();
    stopMicMonitor();
    const utterance = lastTranscript.current.trim();
    lastTranscript.current = "";
    if (options?.sendPending && autoSend && utterance.length >= minSpeechChars) {
      void send(utterance);
    }
    if (callIdRef.current) {
      addEvent(callIdRef.current, "system", "Call ended");
      endCall(callIdRef.current);
      callIdRef.current = null;
    }
    toast.info("Call ended");
  };

  useEffect(() => {
    return () => {
      sessionRef.current = false;
      try { recRef.current?.stop(); } catch { /* noop */ }
      stopMicMonitor();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const selectedVoice = ELEVEN_VOICES.find((v) => v.id === voiceId);

  return (
    <div>
      <div className="flex h-[600px] flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="text-sm text-muted-foreground">
          Manual chat · <span className="font-mono">{model}</span>
          {selectedVoice && speakOutput && (
            <span className="ml-2 text-xs text-emerald-600">♪ {selectedVoice.name}</span>
          )}
          {listening && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {agentSpeaking ? "Agent speaking — talk to interrupt" : "Listening"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" title="Voice & VAD settings">
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[360px] max-h-[560px] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Voice (ElevenLabs)</div>
                  <Select value={voiceId} onValueChange={setVoiceId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[260px]">
                      {ELEVEN_VOICES.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} <span className="text-xs text-muted-foreground">— {v.desc}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Model</Label>
                  <Select value={ttsModel} onValueChange={setTtsModel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ELEVEN_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs"><Label>Pace (speed)</Label><span className="text-muted-foreground">{speed.toFixed(2)}x</span></div>
                    <Slider value={[speed]} min={0.7} max={1.2} step={0.05} onValueChange={(v) => setSpeed(v[0])} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs"><Label>Stability</Label><span className="text-muted-foreground">{stability.toFixed(2)}</span></div>
                    <Slider value={[stability]} min={0} max={1} step={0.05} onValueChange={(v) => setStability(v[0])} />
                    <p className="mt-1 text-[10px] text-muted-foreground">Lower = more expressive, higher = more consistent</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs"><Label>Similarity boost</Label><span className="text-muted-foreground">{similarity.toFixed(2)}</span></div>
                    <Slider value={[similarity]} min={0} max={1} step={0.05} onValueChange={(v) => setSimilarity(v[0])} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs"><Label>Style</Label><span className="text-muted-foreground">{style.toFixed(2)}</span></div>
                    <Slider value={[style]} min={0} max={1} step={0.05} onValueChange={(v) => setStyle(v[0])} />
                  </div>
                  <div className="flex items-center justify-between"><Label className="text-xs">Speaker boost</Label><Switch checked={speakerBoost} onCheckedChange={setSpeakerBoost} /></div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => speak("Hi! This is a preview of the selected voice, pace, and style.")}>
                    Preview voice
                  </Button>
                </div>

                <Separator />

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">VAD / Recognition</div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Language</Label>
                      <Select value={recogLang} onValueChange={setRecogLang}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RECOG_LANGS.map((l) => (
                            <SelectItem key={l.v} value={l.v}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs"><Label>Silence timeout (VAD)</Label><span className="text-muted-foreground">{silenceMs} ms</span></div>
                      <Slider value={[silenceMs]} min={300} max={4000} step={100} onValueChange={(v) => setSilenceMs(v[0])} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs"><Label>Min speech length</Label><span className="text-muted-foreground">{minSpeechChars} chars</span></div>
                      <Slider value={[minSpeechChars]} min={1} max={20} step={1} onValueChange={(v) => setMinSpeechChars(v[0])} />
                    </div>
                    <div className="flex items-center justify-between"><Label className="text-xs">Mute mic while agent speaks</Label><Switch checked={muteWhileSpeaking} onCheckedChange={setMuteWhileSpeaking} /></div>
                    <div className="flex items-center justify-between"><Label className="text-xs">Interim results</Label><Switch checked={interim} onCheckedChange={setInterim} /></div>
                    <div className="flex items-center justify-between"><Label className="text-xs">Auto-send on silence</Label><Switch checked={autoSend} onCheckedChange={setAutoSend} /></div>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Interruption</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Allow barge-in (talk over agent)</Label>
                      <Switch checked={bargeIn} onCheckedChange={setBargeIn} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs">
                        <Label>Interrupt sensitivity</Label>
                        <span className="text-muted-foreground">{bargeThreshold.toFixed(3)}</span>
                      </div>
                      <Slider
                        value={[bargeThreshold]}
                        min={0.01}
                        max={0.2}
                        step={0.005}
                        onValueChange={(v) => setBargeThreshold(v[0])}
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Lower = interrupts more easily. Raise it if room noise cuts the agent off.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSpeakOutput((v) => !v)}
            title={speakOutput ? "Mute speech output" : "Speak responses"}
          >
            {speakOutput ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
            Clear
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Send a message{voice ? " or start a call" : ""} to start.
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>

      <div className="flex items-end gap-2 border-t p-3">
        {voice && (
          <>
            {listening ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => hangUp({ sendPending: false })}
                  title="End the call"
                >
                  <PhoneOff className="mr-1.5 h-4 w-4" />
                  End call
                </Button>
                {agentSpeaking && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => stopAgentSpeech("interrupted")}
                    title="Interrupt the agent"
                  >
                    Interrupt
                  </Button>
                )}
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startListening}
                disabled={loading}
                title="Start a call"
              >
                <Mic className="mr-1.5 h-4 w-4" />
                Start call
              </Button>
            )}
          </>
        )}
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Type a message…"
          className="min-h-[44px] flex-1 resize-none"
          rows={1}
        />
        <Button onClick={() => send(input)} disabled={loading || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
      </div>

      <CallHistory calls={calls} activeId={activeId} onClear={clearHistory} />
    </div>
  );
}
