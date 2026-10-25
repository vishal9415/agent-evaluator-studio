import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Mic, MicOff, ShieldCheck, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type EventTone = "neutral" | "good" | "warning";
type SignalEvent = {
  id: number;
  elapsedMs: number;
  title: string;
  detail: string;
  tone: EventTone;
};
type ExtendedTrackSettings = MediaTrackSettings & {
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
};
type InputSnapshot = {
  trackSampleRate?: number;
  contextSampleRate: number;
  channelCount?: number;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
};

function dbfs(value: number) {
  return value <= -90 ? "−∞" : value.toFixed(1);
}

function settingLabel(value: boolean | undefined) {
  return value === undefined ? "Not reported" : value ? "On" : "Off";
}

export function LiveAudioDiagnostics() {
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(true);
  const [input, setInput] = useState<InputSnapshot | null>(null);
  const [levelDb, setLevelDb] = useState(-90);
  const [peakDb, setPeakDb] = useState(-90);
  const [bars, setBars] = useState<number[]>(Array.from({ length: 42 }, () => 4));
  const [activity, setActivity] = useState(false);
  const [events, setEvents] = useState<SignalEvent[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const sequenceRef = useRef(0);
  const connectingRef = useRef(false);
  const activityRef = useRef(false);
  const quietSinceRef = useRef<number | null>(null);
  const lastPaintRef = useRef(0);
  const clipAlertRef = useRef(false);

  const appendEvent = useCallback((title: string, detail: string, tone: EventTone = "neutral") => {
    const base = startedAtRef.current ?? performance.now();
    setEvents((current) => [
      ...current,
      {
        id: ++sequenceRef.current,
        elapsedMs: Math.max(0, Math.round(performance.now() - base)),
        title,
        detail,
        tone,
      },
    ].slice(-50));
  }, []);

  const stopCapture = useCallback((recordEvent = true) => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    analyserRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed") void context.close();
    activityRef.current = false;
    quietSinceRef.current = null;
    setActivity(false);
    setRunning(false);
    if (recordEvent) appendEvent("Capture stopped", "Microphone tracks were stopped and the local audio context was closed.");
  }, [appendEvent]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    sourceRef.current?.disconnect();
    const context = contextRef.current;
    if (context && context.state !== "closed") void context.close();
  }, []);

  const startCapture = async () => {
    if (connectingRef.current || running) return;
    setError("");
    setStarting(true);
    connectingRef.current = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone capture is unavailable. Open PromptLab on localhost or a secure HTTPS connection in a supported browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression,
          echoCancellation,
          autoGainControl,
        },
        video: false,
      });
      streamRef.current = stream;

      const context = new AudioContext();
      contextRef.current = context;
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      sourceRef.current = source;
      analyserRef.current = analyser;

      const track = stream.getAudioTracks()[0];
      const settings = (track?.getSettings() ?? {}) as ExtendedTrackSettings;
      setInput({
        trackSampleRate: settings.sampleRate,
        contextSampleRate: context.sampleRate,
        channelCount: settings.channelCount,
        noiseSuppression: settings.noiseSuppression,
        echoCancellation: settings.echoCancellation,
        autoGainControl: settings.autoGainControl,
      });

      setEvents([]);
      sequenceRef.current = 0;
      startedAtRef.current = performance.now();
      activityRef.current = false;
      quietSinceRef.current = null;
      lastPaintRef.current = 0;
      clipAlertRef.current = false;
      setLevelDb(-90);
      setPeakDb(-90);
      setActivity(false);
      setRunning(true);
      appendEvent(
        "Microphone capture started",
        "Requested browser noise suppression, echo cancellation and automatic gain control where supported.",
        "good",
      );

      const timeSamples = new Float32Array(analyser.fftSize);
      const frequencySamples = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (analyserRef.current !== analyser) return;
        analyser.getFloatTimeDomainData(timeSamples);
        analyser.getByteFrequencyData(frequencySamples);

        let sumSquares = 0;
        let peak = 0;
        let clippedSamples = 0;
        for (let i = 0; i < timeSamples.length; i++) {
          const sample = timeSamples[i];
          const absolute = Math.abs(sample);
          sumSquares += sample * sample;
          if (absolute > peak) peak = absolute;
          if (absolute >= 0.995) clippedSamples++;
        }

        const rms = Math.sqrt(sumSquares / timeSamples.length);
        const currentDb = rms > 0.00001 ? 20 * Math.log10(rms) : -100;
        const currentPeakDb = peak > 0.00001 ? 20 * Math.log10(peak) : -100;
        const now = performance.now();

        // A transparent energy threshold is a lightweight activity estimate, not source separation or a trained VAD.
        if (currentDb >= -43) {
          quietSinceRef.current = null;
          if (!activityRef.current) {
            activityRef.current = true;
            appendEvent("Input energy rose", "Energy-based activity estimate crossed −43 dBFS; this can include loud non-speech sounds.", "good");
          }
        } else if (currentDb <= -52) {
          if (quietSinceRef.current === null) quietSinceRef.current = now;
          if (activityRef.current && now - quietSinceRef.current >= 450) {
            activityRef.current = false;
            quietSinceRef.current = null;
            appendEvent("Input energy settled", "Input stayed below −52 dBFS for 450 ms; this is not a semantic end-of-turn decision.");
          }
        } else {
          quietSinceRef.current = null;
        }

        if (clippedSamples >= 2 && !clipAlertRef.current) {
          clipAlertRef.current = true;
          appendEvent("Possible input clipping", "Samples approached full scale. Reduce the microphone gain or move farther from the microphone.", "warning");
        } else if (peak < 0.97) {
          clipAlertRef.current = false;
        }

        if (now - lastPaintRef.current >= 80) {
          const nextBars: number[] = [];
          const groups = 42;
          for (let group = 0; group < groups; group++) {
            const start = Math.floor(group * frequencySamples.length / groups);
            const end = Math.max(start + 1, Math.floor((group + 1) * frequencySamples.length / groups));
            let total = 0;
            for (let i = start; i < end; i++) total += frequencySamples[i];
            nextBars.push(Math.max(4, (total / (end - start)) / 255 * 100));
          }
          setBars(nextBars);
          setLevelDb(Math.max(-90, currentDb));
          setPeakDb(Math.max(-90, currentPeakDb));
          setActivity(activityRef.current);
          lastPaintRef.current = now;
        }

        frameRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (cause) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const context = contextRef.current;
      contextRef.current = null;
      if (context && context.state !== "closed") void context.close();
      sourceRef.current?.disconnect();
      sourceRef.current = null;
      analyserRef.current = null;
      setRunning(false);
      setError(cause instanceof Error ? cause.message : "Could not start the microphone diagnostic.");
    } finally {
      setStarting(false);
      connectingRef.current = false;
    }
  };

  const meterPercent = Math.max(0, Math.min(100, ((levelDb + 60) / 60) * 100));
  const trackRate = input?.trackSampleRate ? (input.trackSampleRate / 1000).toFixed(1) + " kHz" : "Not reported";
  const channels = input?.channelCount ? String(input.channelCount) : "Not reported";

  return (
    <Card className="overflow-hidden border-emerald-900/10 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-gradient-to-r from-emerald-500/[0.06] via-transparent to-sky-500/[0.05]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
              <Waves className="h-4 w-4" /> Live audio path · first MVP slice
            </div>
            <CardTitle className="mt-2 flex items-center gap-2 text-xl">
              <Activity className="h-5 w-5 text-emerald-600" /> Live input diagnostics
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl leading-6">
              Check the microphone signal and request native browser audio processing before connecting a live agent. No model API key is needed for this check.
            </CardDescription>
          </div>
          <Button onClick={() => running ? stopCapture() : void startCapture()} disabled={starting} variant={running ? "destructive" : "default"} className="shrink-0">
            {running ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
            {starting ? "Requesting microphone…" : running ? "Stop diagnostics" : "Start microphone check"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <section className="min-w-0 rounded-2xl border border-border/70 bg-card p-4" aria-label="Microphone signal">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Input signal</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {running ? activity ? "Energy activity detected" : "Listening · low input energy" : "Microphone is off"}
                </p>
              </div>
              <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " + (running ? activity ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-sky-500/10 text-sky-700 dark:text-sky-300" : "bg-muted text-muted-foreground")}>
                <span className={"h-1.5 w-1.5 rounded-full " + (running ? activity ? "bg-emerald-500" : "bg-sky-500" : "bg-muted-foreground")} />
                {running ? activity ? "Activity" : "Standby" : "Stopped"}
              </span>
            </div>
            <div className="mt-5 flex h-24 items-end gap-1 overflow-hidden rounded-xl bg-slate-950 px-3 pb-3 pt-2" aria-label="Live frequency energy visualization">
              {bars.map((height, index) => (
                <span key={index} className="min-w-0 flex-1 rounded-t-sm bg-gradient-to-t from-emerald-500 to-cyan-300 transition-[height] duration-75" style={{ height: running ? Math.max(4, height) + "%" : "4%" }} />
              ))}
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Input energy</span>
                <span className="font-mono font-semibold tabular-nums">{running ? dbfs(levelDb) + " dBFS" : "—"}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-100" style={{ width: running ? meterPercent + "%" : "0%" }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Peak: {running ? dbfs(peakDb) + " dBFS" : "—"}</span>
                <span>Clipping hint: {running && peakDb > -0.5 ? "Check gain" : "No recent peak warning"}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 p-4" aria-label="Browser audio processing settings">
            <p className="text-sm font-semibold">Browser audio processing</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Requested before capture. The browser or device may not support every option; actual settings are shown below when reported.</p>
            <div className="mt-4 space-y-3">
              {[
                { label: "Noise suppression", description: "Reduce environmental noise", value: noiseSuppression, change: setNoiseSuppression },
                { label: "Echo cancellation", description: "Reduce speaker-to-microphone echo", value: echoCancellation, change: setEchoCancellation },
                { label: "Automatic gain control", description: "Normalize microphone level", value: autoGainControl, change: setAutoGainControl },
              ].map((option) => (
                <div key={option.label} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                  <Switch checked={option.value} onCheckedChange={option.change} disabled={running || starting} aria-label={"Request " + option.label} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: "Reported track rate", value: trackRate, help: "Not a guarantee of the carrier codec" },
            { label: "Audio context rate", value: input ? (input.contextSampleRate / 1000).toFixed(1) + " kHz" : "—", help: "Browser processing context" },
            { label: "Channels", value: channels, help: "Reported by input track" },
            { label: "Noise suppression", value: input ? settingLabel(input.noiseSuppression) : "—", help: "Actual track setting" },
            { label: "Echo cancellation", value: input ? settingLabel(input.echoCancellation) : "—", help: "Actual track setting" },
          ].map((metric) => (
            <div key={metric.label} className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-[11px] leading-4 text-muted-foreground">{metric.label}</p>
              <p className="mt-2 break-words text-lg font-semibold tabular-nums">{metric.value}</p>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{metric.help}</p>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
          <p className="text-xs leading-5 text-muted-foreground">
            Privacy and measurement: this module doesn't record or upload audio; capture stays in this browser tab and stops when you stop the check or leave the page. Energy-based activity is only a diagnostic heuristic, not primary-speaker detection, a trained voice-activity detector or semantic turn detection. This first slice diagnoses the local microphone path; wiring processed audio into a production phone-call media path is the next integration step.
          </p>
        </div>

        <section aria-label="Audio diagnostic event timeline">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Diagnostic timeline</p>
              <p className="mt-1 text-xs text-muted-foreground">Local browser events only; not carrier-level measurements.</p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs tabular-nums text-muted-foreground">{events.length} events</span>
          </div>
          {events.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Start the microphone check to see capture, input-activity and clipping events.</p>
          ) : (
            <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
              {[...events].reverse().map((event) => (
                <div key={event.id} className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-xs sm:grid-cols-[88px_minmax(0,1fr)]">
                  <span className="font-mono tabular-nums text-muted-foreground">+{event.elapsedMs} ms</span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      {event.tone === "good" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : event.tone === "warning" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : <Activity className="h-3.5 w-3.5 text-muted-foreground" />}
                      {event.title}
                    </p>
                    <p className="mt-1 leading-5 text-muted-foreground">{event.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
