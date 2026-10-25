import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, PhoneOff, Radio, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PROMPT } from "@/lib/playground-constants";
import { createOpenAIRealtimeAnswer } from "@/lib/voice-adapters/openai-realtime.functions";
import type { VoiceEventSource } from "@/lib/voice-adapters/contract";
import { finishVoiceSession, recordVoiceSessionEvent } from "@/lib/voice-session.functions";
import { VoiceSessionHistory } from "@/components/voice-reliability/VoiceSessionHistory";
import { VoiceUsagePanel } from "@/components/voice-reliability/VoiceUsagePanel";
import { waitForIceGatheringComplete } from "@/lib/voice-adapters/ice-gathering";

type SessionState = "idle" | "connecting" | "connected" | "ended" | "error";
type TimelineEvent = { id: number; time: string; elapsedMs: number; type: string; detail: string };
type TranscriptItem = { id: number; role: "Caller" | "Agent"; text: string };
type AudioTrackSnapshot = {
  sampleRate?: number;
  channelCount?: number;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
};
type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

const MODELS = [
  { value: "gpt-realtime-2.1", label: "GPT Realtime 2.1" },
  { value: "gpt-realtime-2.1-mini", label: "GPT Realtime 2.1 Mini" },
] as const;
const VOICES = ["marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"] as const;

function eventDetail(event: UnknownRecord): string {
  const error = asRecord(event.error);
  const response = asRecord(event.response);
  if (event.type === "error") return String(error.message ?? event.message ?? "Provider reported an error").slice(0, 240);
  if (event.type === "response.done") return String(response.status ?? "Response completed");
  if (event.type === "conversation.item.input_audio_transcription.completed") return "Caller transcription completed";
  if (event.type === "response.output_audio_transcript.done") return "Agent audio transcript completed";
  if (event.type === "input_audio_buffer.speech_started") return "Voice activity detected";
  if (event.type === "input_audio_buffer.speech_stopped") return "Voice activity stopped";
  if (event.type === "response.created") return "Agent response started (provider event received by browser)";
  if (event.type === "session.created") return "Realtime session created";
  if (event.type === "session.updated") return "Realtime session configuration acknowledged";
  return "";
}

export function LiveRealtimeTest() {
  const [instructions, setInstructions] = useState(DEFAULT_PROMPT);
  const [model, setModel] = useState<(typeof MODELS)[number]["value"]>("gpt-realtime-2.1");
  const [voice, setVoice] = useState<(typeof VOICES)[number]>("marin");
  const [status, setStatus] = useState<SessionState>("idle");
  const [error, setError] = useState("");
  const [callId, setCallId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [historySaveWarning, setHistorySaveWarning] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [observedGapMs, setObservedGapMs] = useState<number | null>(null);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(false);
  const [audioTrackSettings, setAudioTrackSettings] = useState<AudioTrackSnapshot | null>(null);

  const negotiate = useServerFn(createOpenAIRealtimeAnswer);
  const persistSessionEvent = useServerFn(recordVoiceSessionEvent);
  const finishSessionOnServer = useServerFn(finishVoiceSession);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const speechStoppedAtRef = useRef<number | null>(null);
  const sequenceRef = useRef(0);
  const sessionTimerRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const finishingSessionRef = useRef(false);
  const seenAssistantResponseIdsRef = useRef<Set<string>>(new Set());

  const pushEvent = (
    type: string,
    detail = "",
    source: VoiceEventSource = "browser",
  ) => {
    const now = performance.now();
    const start = startedAtRef.current ?? now;
    const elapsedMs = Math.round(now - start);
    setEvents((previous) => [
      ...previous.slice(-99),
      {
        id: ++sequenceRef.current,
        time: new Date().toLocaleTimeString(),
        elapsedMs,
        type,
        detail,
      },
    ]);

    // Persist event type and clock metadata only; transcript text/audio never
    // leave this component for storage. The server re-checks session ownership.
    const activeSessionId = sessionIdRef.current;
    if (activeSessionId) {
      const eventKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      void persistSessionEvent({
        data: {
          sessionId: activeSessionId,
          eventKey,
          eventType: type,
          source,
          clientElapsedMs: elapsedMs,
          measurementStatus: "measured",
        },
      }).catch(() => setHistorySaveWarning(true));
    }
  };

  const tearDown = (finalState: SessionState = "ended") => {
    if (sessionTimerRef.current !== null) window.clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = null;
    channelRef.current?.close();
    channelRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setStatus(finalState);
  };

  const finalizeSession = async (
    finalState: SessionState,
    endReason: "user_ended" | "duration_cap_reached" | "connection_failed" | "provider_error" | "browser_unmounted" | "negotiation_failed",
  ) => {
    if (finishingSessionRef.current) return;
    finishingSessionRef.current = true;
    const activeSessionId = sessionIdRef.current;
    if (activeSessionId) pushEvent(`session.${endReason}`, "Session finish requested");
    // Stop local capture immediately. The server separately asks OpenAI to hang up.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    tearDown(finalState);

    if (activeSessionId) {
      try {
        const result = await finishSessionOnServer({
          data: {
            sessionId: activeSessionId,
            status: finalState === "error" ? "error" : finalState === "ended" ? "ended" : "cancelled",
            endReason,
          },
        });
        if (result.hangupStatus === "unconfirmed") {
          setError("The browser was disconnected, but provider hangup could not be confirmed. Check the OpenAI session usage and status.");
        }
      } catch {
        setHistorySaveWarning(true);
        setError("The browser was disconnected, but PromptLab could not confirm the server-side session finish.");
      } finally {
        sessionIdRef.current = null;
        setHistoryRefreshToken((value) => value + 1);
        finishingSessionRef.current = false;
      }
    } else {
      finishingSessionRef.current = false;
    }
  };

  const startSession = async () => {
    if (status === "connecting" || status === "connected") return;
    setError("");
    setCallId(null);
    setSessionId(null);
    sessionIdRef.current = null;
    finishingSessionRef.current = false;
    setHistorySaveWarning(false);
    setEvents([]);
    setTranscript([]);
    setObservedGapMs(null);
    setAudioTrackSettings(null);
    sequenceRef.current = 0;
    seenAssistantResponseIdsRef.current.clear();
    speechStoppedAtRef.current = null;
    setStatus("connecting");
    startedAtRef.current = performance.now();
    pushEvent("session.start_requested", "Microphone permission requested after user action");

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error("Sign in again to start a live voice session.");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation, noiseSuppression, autoGainControl },
      });
      streamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];
      const audioSettings = audioTrack?.getSettings();
      const snapshot: AudioTrackSnapshot = {
        sampleRate: audioSettings?.sampleRate,
        channelCount: audioSettings?.channelCount,
        noiseSuppression: audioSettings?.noiseSuppression,
        echoCancellation: audioSettings?.echoCancellation,
        autoGainControl: audioSettings?.autoGainControl,
      };
      setAudioTrackSettings(snapshot);
      pushEvent(
        "browser.audio_processing_settings",
        "Requested NS=" + noiseSuppression +
          ", EC=" + echoCancellation +
          ", AGC=" + autoGainControl +
          "; browser-reported NS=" + String(snapshot.noiseSuppression ?? "unknown") +
          ", EC=" + String(snapshot.echoCancellation ?? "unknown") +
          ", AGC=" + String(snapshot.autoGainControl ?? "unknown") +
          ", sample rate=" + String(snapshot.sampleRate ?? "unknown") + " Hz.",
      );

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.addTrack(stream.getAudioTracks()[0], stream);

      pc.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
          void audioRef.current.play().catch(() => {
            setError("Audio playback was blocked. Use the audio player's play control.");
          });
        }
        pushEvent("browser.remote_audio_track", "Remote audio track received; this is not a measurement of audible onset");
      };

      pc.onconnectionstatechange = () => {
        pushEvent(`browser.connection_state.${pc.connectionState}`);
        if (pc.connectionState === "connected") setStatus("connected");
        if (pc.connectionState === "failed") {
          setError("WebRTC connection failed. PromptLab is attempting to close the provider session.");
          void finalizeSession("error", "connection_failed");
        } else if (pc.connectionState === "disconnected") {
          setError("WebRTC connection was interrupted. You can end the session or wait for it to recover.");
        }
      };

      const channel = pc.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onopen = () => {
        pushEvent("browser.data_channel.open", "Provider event channel is open");
        setStatus("connected");
      };
      channel.onclose = () => pushEvent("browser.data_channel.closed");
      channel.onerror = () => pushEvent("browser.data_channel.error", "Data channel error");

      channel.onmessage = (message) => {
        let payload: UnknownRecord;
        try {
          payload = JSON.parse(String(message.data));
        } catch {
          pushEvent("provider.event_parse_error", "Received a non-JSON event");
          return;
        }
        const type = typeof payload.type === "string" ? payload.type : "provider.unknown_event";
        const detail = eventDetail(payload);
        if (type === "input_audio_buffer.speech_stopped") {
          speechStoppedAtRef.current = performance.now();
        } else if (type === "response.created" && speechStoppedAtRef.current !== null) {
          // Both timestamps are local browser receipt times. This is an observed
          // event gap, not end-to-end latency or time-to-audible-response.
          setObservedGapMs(Math.round(performance.now() - speechStoppedAtRef.current));
          speechStoppedAtRef.current = null;
        }

        const callerTranscript = payload.transcript;
        if (type === "conversation.item.input_audio_transcription.completed" && typeof callerTranscript === "string") {
          const text = callerTranscript.slice(0, 4000);
          setTranscript((previous) => [...previous, { id: ++sequenceRef.current, role: "Caller", text }]);
        } else if (
          (type === "response.output_audio_transcript.done" && typeof payload.transcript === "string") ||
          (type === "response.output_text.done" && typeof payload.text === "string")
        ) {
          const responseKey = String(payload.response_id ?? payload.item_id ?? "current-response");
          if (!seenAssistantResponseIdsRef.current.has(responseKey)) {
            seenAssistantResponseIdsRef.current.add(responseKey);
            const text = String(payload.transcript ?? payload.text ?? "").slice(0, 4000);
            if (text) setTranscript((previous) => [...previous, { id: ++sequenceRef.current, role: "Agent", text }]);
          }
        }
        if (type === "error") setError(detail || "OpenAI Realtime reported an error.");
        if (type.startsWith("input_audio_buffer.") || type.startsWith("response.") || type.startsWith("session.") || type === "error" || type.includes("transcription")) {
          pushEvent(type, detail, "provider");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);
      const localSdp = pc.localDescription?.sdp;
      if (!localSdp) throw new Error("Could not create a WebRTC offer.");

      const answer = await negotiate({
        data: { accessToken, sdp: localSdp, instructions: instructions.trim(), model, voice },
      });
      setCallId(answer.callId);
      setSessionId(answer.sessionId);
      sessionIdRef.current = answer.sessionId;
      setHistoryRefreshToken((value) => value + 1);
      await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
      pushEvent("browser.remote_description_set", "OpenAI SDP answer applied");
      sessionTimerRef.current = window.setTimeout(() => {
        setError("The 10-minute maximum was reached. PromptLab will disconnect the browser and request provider hangup.");
        void finalizeSession("ended", "duration_cap_reached");
      }, 10 * 60 * 1000);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to start the voice session.";
      setError(message);
      pushEvent("session.start_failed", message);
      setHistoryRefreshToken((value) => value + 1);
      if (sessionIdRef.current) {
        void finalizeSession("error", "connection_failed");
      } else {
        tearDown("error");
      }
    }
  };

  const endSession = () => {
    void finalizeSession("ended", "user_ended");
  };

  useEffect(() => () => {
    if (sessionTimerRef.current !== null) window.clearTimeout(sessionTimerRef.current);
    channelRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const activeSessionId = sessionIdRef.current;
    if (activeSessionId) {
      void finishSessionOnServer({
        data: { sessionId: activeSessionId, status: "cancelled", endReason: "browser_unmounted" },
      }).catch(() => undefined);
    }
    // The cleanup intentionally uses refs because the component can unmount
    // while a long-running voice session is active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = status === "connecting" || status === "connected";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5" /> Live voice test</CardTitle>
          <CardDescription>
            Connect the browser microphone to an OpenAI Realtime session. Session metadata and event timings are saved; raw audio and transcript text are not persisted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" /> Before you start</p>
            <p className="mt-1 text-muted-foreground">Your microphone will be active while the session is running. Speak only with consent from anyone whose voice may be captured. End the session to stop microphone capture.</p>
          </div>
          <section className="rounded-xl border border-border/80 bg-muted/20 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Live input processing</h3>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                  These settings are requested from the browser microphone before audio enters the live WebRTC session. Actual support varies by browser and device; PromptLab displays the settings the browser reports after capture starts.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" /> Applied at capture
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Noise suppression", description: "Reduce ambient noise", checked: noiseSuppression, onCheckedChange: setNoiseSuppression },
                { label: "Echo cancellation", description: "Reduce speaker-to-mic echo", checked: echoCancellation, onCheckedChange: setEchoCancellation },
                { label: "Auto gain control", description: "Normalize input level", checked: autoGainControl, onCheckedChange: setAutoGainControl },
              ].map((setting) => (
                <div key={setting.label} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{setting.label}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{setting.description}</p>
                  </div>
                  <Switch
                    checked={setting.checked}
                    onCheckedChange={setting.onCheckedChange}
                    disabled={active}
                    aria-label={setting.label}
                  />
                </div>
              ))}
            </div>
            {audioTrackSettings && (
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["Noise suppression", audioTrackSettings.noiseSuppression],
                  ["Echo cancellation", audioTrackSettings.echoCancellation],
                  ["Auto gain", audioTrackSettings.autoGainControl],
                ].map(([label, value]) => (
                  <span key={String(label)} className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
                    {String(label)}: <strong className="text-foreground">{typeof value === "boolean" ? (value ? "On" : "Off") : "Not reported"}</strong>
                  </span>
                ))}
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
                  Sample rate: <strong className="text-foreground">{audioTrackSettings.sampleRate ? Math.round(audioTrackSettings.sampleRate / 100) / 10 + " kHz" : "Not reported"}</strong>
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
                  Channels: <strong className="text-foreground">{audioTrackSettings.channelCount ?? "Not reported"}</strong>
                </span>
              </div>
            )}
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              Browser processing is not a substitute for primary-speaker separation, network jitter control or recovery logic. Change settings between sessions and compare the same noisy scenario; no raw audio is saved by this panel.
            </p>
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">Realtime model
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 font-normal" value={model} onChange={(event) => setModel(event.target.value as typeof model)} disabled={active}>
                {MODELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">Agent voice
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 font-normal" value={voice} onChange={(event) => setVoice(event.target.value as typeof voice)} disabled={active}>
                {VOICES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1.5 text-sm font-medium">Agent instructions
            <Textarea className="min-h-40 font-mono text-xs" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={5000} disabled={active} />
            <span className="block text-xs font-normal text-muted-foreground">{instructions.length}/5000 characters. Instructions are sent for this session; this page does not create a versioned prompt.</span>
          </label>
          <p className="text-xs text-muted-foreground">A 10-minute browser timer stops local capture and asks the server to hang up the provider call. A remote hangup result is reported when available; this is not yet a persistent watchdog for a malicious or abandoned browser.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void startSession()} disabled={active || !instructions.trim()}><Mic className="mr-2 h-4 w-4" /> {status === "connecting" ? "Connecting…" : "Start live session"}</Button>
            <Button variant="outline" onClick={endSession} disabled={!active}><PhoneOff className="mr-2 h-4 w-4" /> End session</Button>
            <span className="text-sm text-muted-foreground">Status: <strong className="text-foreground">{status}</strong></span>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {sessionId && <p className="text-xs text-muted-foreground">PromptLab session: <code>{sessionId}</code></p>}
          {callId && <p className="text-xs text-muted-foreground">Provider call reference: <code>{callId}</code></p>}
          {historySaveWarning && <p role="status" className="text-xs text-amber-700">Some session metadata could not be saved or finalized. Check your connection and refresh session history.</p>}
          <audio ref={audioRef} autoPlay controls className="w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversation transcript</CardTitle>
          <CardDescription>Provider transcription events only. Missing events are not inferred.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {transcript.length === 0 ? <p className="text-sm text-muted-foreground">Transcript events will appear here during a live session when the provider emits them.</p> : transcript.map((item) => (
            <div key={item.id} className="rounded-lg border border-border p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.role}</p>
              <p className="whitespace-pre-wrap text-sm">{item.text}</p>
            </div>
          ))}
          {observedGapMs !== null && <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Browser-observed speech-stop → response-created event gap</p>
            <p className="text-2xl font-semibold tabular-nums">{observedGapMs} ms</p>
            <p className="mt-1 text-xs text-muted-foreground">This uses local browser event-receipt timestamps; it is not provider processing latency or time to audible response.</p>
          </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div><CardTitle>Event timeline</CardTitle><CardDescription>Local browser receive time; newest events appear last.</CardDescription></div>
          <Button size="sm" variant="ghost" onClick={() => { setEvents([]); setTranscript([]); setObservedGapMs(null); }} disabled={active || events.length === 0}><Trash2 className="mr-2 h-4 w-4" /> Clear</Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? <p className="text-sm text-muted-foreground">Start a session to collect the events exposed by the browser and provider.</p> : (
            <div className="max-h-96 space-y-2 overflow-auto">
              {events.map((event) => <div key={event.id} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 border-b border-border/60 pb-2 text-xs last:border-0">
                <span className="font-mono tabular-nums text-muted-foreground">+{event.elapsedMs} ms</span>
                <div className="min-w-0"><p className="break-all font-medium">{event.type}</p>{event.detail && <p className="mt-0.5 text-muted-foreground">{event.detail}</p>}<p className="mt-0.5 text-muted-foreground">{event.time}</p></div>
              </div>)}
            </div>
          )}
        </CardContent>
      </Card>

      <VoiceUsagePanel refreshToken={historyRefreshToken} />
      <VoiceSessionHistory refreshToken={historyRefreshToken} />
    </div>
  );
}
