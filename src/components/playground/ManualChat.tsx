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
import { chatCompletion } from "@/lib/playground.functions";
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

const INDIAN_FEMALE_NAMES = [
  "kalpana", "priya", "heera", "shruti", "swara", "kavya", "meera", "neeta", "rekha", "sunita",
];

function pickDefaultVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  for (const name of INDIAN_FEMALE_NAMES) {
    const v = voices.find((voice) => voice.lang.toLowerCase().endsWith("-in") && voice.name.toLowerCase().includes(name));
    if (v) return v;
  }
  const female = voices.find((voice) => voice.lang.toLowerCase().endsWith("-in") && voice.name.toLowerCase().includes("female"));
  if (female) return female;
  const anyIn = voices.find((voice) => voice.lang.toLowerCase().endsWith("-in"));
  if (anyIn) return anyIn;
  return voices[0];
}

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

  // Voice playback settings
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [rate, setRate] = useState(1.05);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);

  // VAD / recognition settings
  const [recogLang, setRecogLang] = useState("en-IN");
  const [continuous, setContinuous] = useState(false);
  const [interim, setInterim] = useState(true);
  const [silenceMs, setSilenceMs] = useState(1200); // VAD: silence before auto-stop
  const [minSpeechChars, setMinSpeechChars] = useState(2);
  const [autoSend, setAutoSend] = useState(true);

  const chat = useServerFn(chatCompletion);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const silenceTimer = useRef<number | null>(null);
  const lastTranscript = useRef<string>("");

  const refreshVoices = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const list = window.speechSynthesis.getVoices();
    setVoices(list);
    setVoiceURI((cur) => {
      if (cur && list.some((v) => v.voiceURI === cur)) return cur;
      return pickDefaultVoice(list)?.voiceURI ?? "";
    });
  }, []);

  useEffect(() => {
    refreshVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
      return () => { window.speechSynthesis.onvoiceschanged = null; };
    }
  }, [refreshVoices]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setVoice(agentType === "voice");
    setSpeakOutput(agentType === "voice");
  }, [agentType]);

  const speak = (text: string) => {
    if (!speakOutput || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.pitch = pitch;
    utter.volume = volume;
    const v = voices.find((x) => x.voiceURI === voiceURI);
    if (v) utter.voice = v;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

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
      speak(reply);
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

      // VAD: reset silence timer on any speech result
      clearSilence();
      silenceTimer.current = window.setTimeout(() => {
        if (transcript.length >= minSpeechChars) {
          try { rec.stop(); } catch { /* noop */ }
          if (autoSend) send(transcript);
        }
      }, silenceMs);
    };
    rec.onerror = () => { clearSilence(); setListening(false); };
    rec.onend = () => {
      clearSilence();
      setListening(false);
      if (autoSend && lastTranscript.current.length >= minSpeechChars && !continuous) {
        // Already handled by silence timer typically; this is a fallback
      }
    };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch (e) {
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

  const selectedVoice = voices.find((v) => v.voiceURI === voiceURI);

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
            <PopoverContent align="end" className="w-[340px] max-h-[520px] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">TTS Voice</div>
                  <Select value={voiceURI} onValueChange={setVoiceURI}>
                    <SelectTrigger><SelectValue placeholder="Select voice" /></SelectTrigger>
                    <SelectContent className="max-h-[260px]">
                      {voices.map((v) => (
                        <SelectItem key={v.voiceURI} value={v.voiceURI}>
                          {v.name} <span className="text-xs text-muted-foreground">({v.lang})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs"><Label>Pace (rate)</Label><span className="text-muted-foreground">{rate.toFixed(2)}x</span></div>
                    <Slider value={[rate]} min={0.5} max={2} step={0.05} onValueChange={(v) => setRate(v[0])} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs"><Label>Pitch</Label><span className="text-muted-foreground">{pitch.toFixed(2)}</span></div>
                    <Slider value={[pitch]} min={0} max={2} step={0.05} onValueChange={(v) => setPitch(v[0])} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs"><Label>Volume</Label><span className="text-muted-foreground">{Math.round(volume * 100)}%</span></div>
                    <Slider value={[volume]} min={0} max={1} step={0.05} onValueChange={(v) => setVolume(v[0])} />
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => speak("This is a preview of the selected voice and pace.")}>
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
