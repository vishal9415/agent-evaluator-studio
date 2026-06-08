import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, Send, Volume2, VolumeX, Settings2 } from "lucide-react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  systemPrompt: string;
  model: string;
  agentType: string;
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

export function ManualChat({ systemPrompt, model, agentType }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState(agentType === "voice");
  const [listening, setListening] = useState(false);
  const [speakOutput, setSpeakOutput] = useState(agentType === "voice");

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
  const [continuous, setContinuous] = useState(false);
  const [interim, setInterim] = useState(true);
  const [silenceMs, setSilenceMs] = useState(1200);
  const [minSpeechChars, setMinSpeechChars] = useState(2);
  const [autoSend, setAutoSend] = useState(true);

  const chat = useServerFn(chatCompletion);
  const tts = useServerFn(synthesizeSpeech);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimer = useRef<number | null>(null);
  const lastTranscript = useRef<string>("");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setVoice(agentType === "voice");
    setSpeakOutput(agentType === "voice");
  }, [agentType]);

  const speak = useCallback(
    async (text: string) => {
      if (!speakOutput) return;
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
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        const audio = new Audio(`data:${res.mime};base64,${res.audio}`);
        audioRef.current = audio;
        await audio.play();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "TTS failed");
      }
    },
    [speakOutput, tts, voiceId, ttsModel, speed, stability, similarity, style, speakerBoost],
  );

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await chat({ data: { model, systemPrompt, messages: next } });
      const reply = res.content || "(empty response)";
      setMessages([...next, { role: "assistant", content: reply }]);
      void speak(reply);
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

  const startListening = () => {
    const w = window as AnyWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition not supported in this browser. Try Chrome.");
      return;
    }
    const rec = new SR();
    rec.lang = recogLang;
    rec.interimResults = interim;
    rec.continuous = continuous;
    lastTranscript.current = "";

    rec.onresult = (ev: any) => {
      const transcript = Array.from(ev.results)
        .map((r: any) => r[0].transcript)
        .join(" ")
        .trim();
      lastTranscript.current = transcript;
      setInput(transcript);

      clearSilence();
      silenceTimer.current = window.setTimeout(() => {
        if (transcript.length >= minSpeechChars) {
          try { rec.stop(); } catch { /* noop */ }
          if (autoSend) send(transcript);
        }
      }, silenceMs);
    };
    rec.onerror = () => { clearSilence(); setListening(false); };
    rec.onend = () => { clearSilence(); setListening(false); };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch {
      toast.error("Could not start mic");
    }
  };

  const stopListening = () => {
    clearSilence();
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
    if (autoSend && lastTranscript.current.trim().length >= minSpeechChars) {
      send(lastTranscript.current);
    }
  };

  const selectedVoice = ELEVEN_VOICES.find((v) => v.id === voiceId);

  return (
    <div className="flex h-[600px] flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="text-sm text-muted-foreground">
          Manual chat · <span className="font-mono">{model}</span>
          {selectedVoice && speakOutput && (
            <span className="ml-2 text-xs text-emerald-600">♪ {selectedVoice.name}</span>
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
                    <div className="flex items-center justify-between"><Label className="text-xs">Continuous listening</Label><Switch checked={continuous} onCheckedChange={setContinuous} /></div>
                    <div className="flex items-center justify-between"><Label className="text-xs">Interim results</Label><Switch checked={interim} onCheckedChange={setInterim} /></div>
                    <div className="flex items-center justify-between"><Label className="text-xs">Auto-send on silence</Label><Switch checked={autoSend} onCheckedChange={setAutoSend} /></div>
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
            Send a message{voice ? " or hold the mic" : ""} to start.
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
          <Button
            type="button"
            variant={listening ? "destructive" : "outline"}
            size="icon"
            onClick={listening ? stopListening : startListening}
            disabled={loading}
            title={listening ? "Stop" : "Record"}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
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
  );
}
