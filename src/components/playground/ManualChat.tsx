import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, Send, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { chatCompletion } from "@/lib/playground.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  systemPrompt: string;
  model: string;
  agentType: string;
}

// Browser SpeechRecognition typings are loose across browsers
type AnyWindow = Window & {
  webkitSpeechRecognition?: new () => any;
  SpeechRecognition?: new () => any;
};

const INDIAN_FEMALE_NAMES = [
  "kalpana", "priya", "heera", "shruti", "swara", "kavya", "meera", "neeta", "rekha", "sunita",
];

function getIndianFemaleVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices();
  // Prefer exact Indian female names
  for (const name of INDIAN_FEMALE_NAMES) {
    const v = voices.find((voice) => voice.lang.toLowerCase().endsWith("-in") && voice.name.toLowerCase().includes(name));
    if (v) return v;
  }
  // Fallback: any Indian lang voice with "female" in name
  const female = voices.find((voice) => voice.lang.toLowerCase().endsWith("-in") && voice.name.toLowerCase().includes("female"));
  if (female) return female;
  // Fallback: any Indian voice
  const anyIn = voices.find((voice) => voice.lang.toLowerCase().endsWith("-in"));
  if (anyIn) return anyIn;
  return undefined;
}

export function ManualChat({ systemPrompt, model, agentType }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState(agentType === "voice");
  const [listening, setListening] = useState(false);
  const [speakOutput, setSpeakOutput] = useState(agentType === "voice");
  const [indianVoiceName, setIndianVoiceName] = useState<string>("");
  const chat = useServerFn(chatCompletion);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);

  const refreshVoice = useCallback(() => {
    const v = getIndianFemaleVoice();
    setIndianVoiceName(v?.name ?? "");
  }, []);

  useEffect(() => {
    refreshVoice();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = refreshVoice;
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, [refreshVoice]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setVoice(agentType === "voice");
    setSpeakOutput(agentType === "voice");
  }, [agentType]);

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
      if (speakOutput && typeof window !== "undefined" && "speechSynthesis" in window) {
        const utter = new SpeechSynthesisUtterance(reply);
        utter.rate = 1.05;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
      setMessages(messages);
    } finally {
      setLoading(false);
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
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev: any) => {
      const transcript = Array.from(ev.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      setListening(false);
      send(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stopListening = () => {
    recRef.current?.stop();
    setListening(false);
  };

  return (
    <div className="flex h-[600px] flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="text-sm text-muted-foreground">
          Manual chat · <span className="font-mono">{model}</span>
        </div>
        <div className="flex items-center gap-2">
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
