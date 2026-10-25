import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AudioLines,
  ClipboardPaste,
  FileAudio,
  FileText,
  Info,
  LoaderCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Waves,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_BATCH_BYTES = 100 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["wav", "mp3", "m4a", "aac", "ogg", "oga", "opus", "webm", "mp4", "flac"]);

type Finding = {
  id: string;
  level: "high" | "medium" | "info";
  area: "Audio signal" | "Conversation transcript";
  title: string;
  detail: string;
};

type AudioMetrics = {
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  peakDbfs: number;
  rmsDbfs: number;
  clippedSamplePercent: number;
  longestLowSignalSeconds: number;
};

type ReviewStatus = "ready" | "analyzing" | "complete" | "signal-unavailable";

type Recording = {
  id: string;
  file: File;
  url: string;
  transcript: string;
  status: ReviewStatus;
  metrics: AudioMetrics | null;
  findings: Finding[];
};

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDuration(value: number) {
  const safe = Math.max(0, Math.floor(value));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours) return hours + "h " + minutes + "m";
  if (minutes) return minutes + "m " + seconds + "s";
  return seconds + "s";
}

function dbfs(value: number) {
  return value <= 0.000000001 ? "−∞ dBFS" : (20 * Math.log10(value)).toFixed(1) + " dBFS";
}

function normalizeLine(value: string) {
  return value.toLowerCase().replace(/^\s*(agent|assistant|bot|caller|customer|user)\s*[:\-]\s*/i, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function roleOf(line: string): "agent" | "caller" | null {
  if (/^\s*(agent|assistant|bot)\s*[:\-]/i.test(line)) return "agent";
  if (/^\s*(caller|customer|user)\s*[:\-]/i.test(line)) return "caller";
  return null;
}

function analyzeTranscript(transcript: string): Finding[] {
  const text = transcript.trim();
  if (!text) return [];
  const findings: Finding[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const inaudibleMarkers = (text.match(/\b(inaudible|unintelligible|could not transcribe|unrecognized speech|speech not recognized)\b|\[(?:unclear|noise|silence|inaudible|unintelligible)[^\]]*\]/gi) ?? []).length;
  if (inaudibleMarkers > 0) {
    findings.push({
      id: "transcript-incomplete",
      level: "high",
      area: "Conversation transcript",
      title: "Transcript contains unclear or unrecognized speech markers",
      detail: `Found ${inaudibleMarkers} marker(s). Review those parts against the original recording; they can hide missed names, numbers or caller intent.`,
    });
  }

  const agentLines = lines.filter((line) => roleOf(line) === "agent");
  const labelledLines = lines.filter((line) => roleOf(line) !== null);
  if (labelledLines.length === 0) {
    findings.push({
      id: "speaker-labels",
      level: "info",
      area: "Conversation transcript",
      title: "Speaker labels not detected",
      detail: "For better conversation checks, label each line Agent: or Caller:. Without roles, PromptLab skips agent-specific repetition and monologue checks.",
    });
  } else {
    const questionCounts = new Map<string, number>();
    for (const line of agentLines) {
      const normalized = normalizeLine(line);
      if (normalized.length < 12 || !/[?？]$/.test(line) && !/\b(what|when|where|which|who|how|could you|can you|would you|do you|is it|are you)\b/i.test(line)) continue;
      questionCounts.set(normalized, (questionCounts.get(normalized) ?? 0) + 1);
    }
    const repeatedQuestions = [...questionCounts.entries()].filter(([, count]) => count > 1);
    if (repeatedQuestions.length) {
      findings.push({
        id: "repeated-agent-question",
        level: "medium",
        area: "Conversation transcript",
        title: "Possible repeated agent question",
        detail: `Found ${repeatedQuestions.length} question wording(s) repeated by the agent. Check whether the caller had already answered or corrected the detail.`,
      });
    }

    const longAgentLines = agentLines.filter((line) => normalizeLine(line).split(/\s+/).filter(Boolean).length > 110);
    if (longAgentLines.length) {
      findings.push({
        id: "long-agent-turn",
        level: "medium",
        area: "Conversation transcript",
        title: "Very long agent turn",
        detail: `Found ${longAgentLines.length} agent turn(s) over 110 words. Review whether the agent is monologuing instead of using shorter, natural turns.`,
      });
    }

    const exactRepeats = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      const previousRole = roleOf(lines[i - 1]);
      const currentRole = roleOf(lines[i]);
      const prev = normalizeLine(lines[i - 1]);
      const current = normalizeLine(lines[i]);
      if (previousRole && currentRole && previousRole === currentRole && prev.length > 15 && prev === current) {
        exactRepeats.add(previousRole + ":" + current);
      }
    }
    if (exactRepeats.size) {
      findings.push({
        id: "consecutive-duplicate",
        level: "medium",
        area: "Conversation transcript",
        title: "Repeated consecutive utterance",
        detail: `Found ${exactRepeats.size} exact duplicate(s) in consecutive same-speaker turns. Check for playback, transcription or dialogue-loop issues.`,
      });
    }
  }

  const numericValues = text.match(/(?:₹|\$|€|£)?\s*\b\d[\d,]*(?:\.\d+)?\s*(?:lakh|lac|crore|cr|thousand|million|billion|k|m)?\b/gi) ?? [];
  const distinctNumbers = [...new Set(numericValues.map((value) => value.toLowerCase().replace(/\s+/g, " ").trim()))];
  if (distinctNumbers.length >= 4) {
    findings.push({
      id: "numeric-details-review",
      level: "info",
      area: "Conversation transcript",
      title: "Several numeric details appear in this call",
      detail: "Review names, dates, budgets, currencies and corrections manually. This quick check does not determine whether values contradict each other.",
    });
  }

  if (!findings.length) {
    findings.push({
      id: "transcript-no-obvious-flags",
      level: "info",
      area: "Conversation transcript",
      title: "No obvious repetition or transcription flags found",
      detail: "This is a lightweight text check, not a semantic quality score. It does not verify truthfulness, policy adherence or whether every caller detail was preserved.",
    });
  }
  return findings;
}

function analyzeAudioBuffer(buffer: AudioBuffer): { metrics: AudioMetrics; findings: Finding[] } {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const totalSamples = buffer.length * buffer.numberOfChannels;
  const windowFrames = Math.max(1, Math.floor(buffer.sampleRate * 0.1));
  let sumSquares = 0;
  let peak = 0;
  let clipped = 0;
  let longestLowFrames = 0;
  let currentLowFrames = 0;

  for (let start = 0; start < buffer.length; start += windowFrames) {
    const end = Math.min(buffer.length, start + windowFrames);
    let windowSquares = 0;
    let windowSamples = 0;
    for (const channel of channels) {
      for (let frame = start; frame < end; frame++) {
        const sample = Math.abs(channel[frame]);
        sumSquares += sample * sample;
        windowSquares += sample * sample;
        windowSamples++;
        if (sample > peak) peak = sample;
        if (sample >= 0.995) clipped++;
      }
    }
    const windowRms = Math.sqrt(windowSquares / Math.max(1, windowSamples));
    if (windowRms < 0.007) {
      currentLowFrames += end - start;
      longestLowFrames = Math.max(longestLowFrames, currentLowFrames);
    } else {
      currentLowFrames = 0;
    }
  }

  const rms = Math.sqrt(sumSquares / Math.max(1, totalSamples));
  const metrics: AudioMetrics = {
    durationSeconds: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    peakDbfs: peak <= 0 ? -Infinity : 20 * Math.log10(peak),
    rmsDbfs: rms <= 0 ? -Infinity : 20 * Math.log10(rms),
    clippedSamplePercent: (clipped / Math.max(1, totalSamples)) * 100,
    longestLowSignalSeconds: longestLowFrames / buffer.sampleRate,
  };

  const findings: Finding[] = [];
  if (metrics.clippedSamplePercent >= 0.05 || metrics.peakDbfs >= -0.05) {
    findings.push({
      id: "audio-clipping",
      level: "high",
      area: "Audio signal",
      title: "Possible clipping or near-full-scale peaks",
      detail: `${metrics.clippedSamplePercent.toFixed(3)}% of decoded samples reached 0.995 full scale or higher. Inspect for harsh/distorted audio; this threshold is a diagnostic hint, not a guaranteed clipping detector.`,
    });
  }
  if (metrics.rmsDbfs < -35) {
    findings.push({
      id: "audio-low-level",
      level: "medium",
      area: "Audio signal",
      title: "Low average signal level",
      detail: `Average level is ${dbfs(rms)}. Check microphone distance, gain and whether speech is too quiet relative to noise.`,
    });
  }
  if (metrics.longestLowSignalSeconds >= 3) {
    findings.push({
      id: "audio-long-low-level",
      level: "medium",
      area: "Audio signal",
      title: "Long low-level segment detected",
      detail: `The longest segment below the local signal threshold was ${metrics.longestLowSignalSeconds.toFixed(1)}s. This may be silence, a pause or a quiet caller; listen to that section before treating it as a fault.`,
    });
  }
  if (metrics.channels > 2) {
    findings.push({
      id: "audio-multichannel",
      level: "info",
      area: "Audio signal",
      title: "Multichannel recording",
      detail: `The recording has ${metrics.channels} channels. Confirm the intended channel mapping before comparing levels or speech quality.`,
    });
  }
  if (!findings.length) {
    findings.push({
      id: "audio-no-obvious-flags",
      level: "info",
      area: "Audio signal",
      title: "No obvious level or clipping flags found",
      detail: "This signal check cannot detect speech-recognition errors, overlapping speakers, background-noise intelligibility or semantic turn-taking issues.",
    });
  }
  return { metrics, findings };
}

function FindingBadge({ level }: { level: Finding["level"] }) {
  const classes = level === "high"
    ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
    : level === "medium"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
      : "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${classes}`}>{level === "high" ? "Priority review" : level === "medium" ? "Check this" : "Info"}</span>;
}

export function RecordingReview() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const recordingsRef = useRef<Recording[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    recordingsRef.current = recordings;
  }, [recordings]);

  useEffect(() => () => {
    recordingsRef.current.forEach((recording) => URL.revokeObjectURL(recording.url));
  }, []);

  function patchRecording(id: string, patch: Partial<Recording>) {
    setRecordings((current) => current.map((recording) => recording.id === id ? { ...recording, ...patch } : recording));
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const selected = Array.from(fileList);
    const currentBytes = recordings.reduce((sum, item) => sum + item.file.size, 0);
    const additions: Recording[] = [];
    const errors: string[] = [];
    let requestedBytes = 0;
    const existingKeys = new Set(recordings.map((item) => item.file.name + ":" + item.file.size + ":" + item.file.lastModified));

    for (const file of selected) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!file.type.startsWith("audio/") && !ACCEPTED_EXTENSIONS.has(extension)) {
        errors.push(file.name + ": unsupported file type.");
        continue;
      }
      if (file.size === 0) {
        errors.push(file.name + ": file is empty.");
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        errors.push(file.name + ": exceeds the 25 MB per-file limit.");
        continue;
      }
      const duplicateKey = file.name + ":" + file.size + ":" + file.lastModified;
      if (existingKeys.has(duplicateKey)) {
        errors.push(file.name + ": already added.");
        continue;
      }
      existingKeys.add(duplicateKey);
      if (recordings.length + additions.length >= MAX_FILES) {
        errors.push("Only " + MAX_FILES + " recordings can be reviewed in one batch.");
        break;
      }
      if (currentBytes + requestedBytes + file.size > MAX_BATCH_BYTES) {
        errors.push("The batch size limit is 100 MB.");
        continue;
      }
      requestedBytes += file.size;
      additions.push({
        id: makeId(),
        file,
        url: URL.createObjectURL(file),
        transcript: "",
        status: "ready",
        metrics: null,
        findings: [],
      });
    }

    if (additions.length) {
      setRecordings((current) => [...current, ...additions].slice(0, MAX_FILES));
      setUploadMessage("");
    }
    if (errors.length) setUploadMessage(errors.join(" "));
    if (!additions.length && errors.length) toast.error(errors[0]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeRecording(id: string) {
    const recording = recordings.find((item) => item.id === id);
    if (recording) URL.revokeObjectURL(recording.url);
    setRecordings((current) => current.filter((item) => item.id !== id));
  }

  async function analyzeRecording(recording: Recording) {
    if (busyId) return;
    setBusyId(recording.id);
    patchRecording(recording.id, { status: "analyzing", findings: [], metrics: null });
    const findings: Finding[] = [];
    let metrics: AudioMetrics | null = null;
    let signalUnavailable = false;

    try {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) throw new Error("Web Audio API is not available in this browser.");
      const audioContext = new AudioContextConstructor();
      try {
        const buffer = await audioContext.decodeAudioData(await recording.file.arrayBuffer());
        const result = analyzeAudioBuffer(buffer);
        metrics = result.metrics;
        findings.push(...result.findings);
      } finally {
        await audioContext.close().catch(() => undefined);
      }
    } catch {
      signalUnavailable = true;
      findings.push({
        id: "audio-decode-unavailable",
        level: "info",
        area: "Audio signal",
        title: "Browser could not decode this audio file for signal analysis",
        detail: "You can still play the recording below and run transcript checks if you paste a transcript. Browser codec support varies; try WAV or MP3 if needed.",
      });
    }

    findings.push(...analyzeTranscript(recording.transcript));
    if (!recording.transcript.trim()) {
      findings.push({
        id: "transcript-not-provided",
        level: "info",
        area: "Conversation transcript",
        title: "Conversation-level checks skipped",
        detail: "No transcript was provided. PromptLab has not automatically transcribed the audio; paste an existing transcript to check repetition, unclear speech markers and long agent turns.",
      });
    }

    patchRecording(recording.id, {
      metrics,
      findings,
      status: signalUnavailable ? "signal-unavailable" : "complete",
    });
    setBusyId(null);
  }

  async function analyzeAll() {
    for (const recording of recordings) {
      await analyzeRecording(recording);
    }
  }

  const totalBytes = recordings.reduce((sum, recording) => sum + recording.file.size, 0);
  const findingsCount = recordings.filter((recording) => recording.status === "complete" || recording.status === "signal-unavailable")
    .reduce((sum, recording) => sum + recording.findings.filter((finding) => finding.level !== "info").length, 0);

  return (
    <section className="space-y-5" aria-labelledby="recording-review-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">
            <AudioLines className="h-3.5 w-3.5 text-brand" /> Recording analysis <span className="text-muted-foreground/60">/</span> Before design partner
          </p>
          <h2 id="recording-review-heading" className="mt-1.5 text-xl font-semibold tracking-tight">Review existing recordings</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Add up to 10 call recordings, inspect audio-signal warnings, and run quick transcript checks where text is available.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={recordings.length >= MAX_FILES}>
            <Upload className="mr-2 h-4 w-4" /> Add recordings
          </Button>
          <Button onClick={() => void analyzeAll()} disabled={!recordings.length || busyId !== null}>
            {busyId ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Waves className="mr-2 h-4 w-4" />}
            Analyze all
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.oga,.opus,.webm,.mp4,.flac"
            className="hidden"
            onChange={(event) => addFiles(event.currentTarget.files)}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Batch</p>
          <p className="mt-1.5 text-lg font-semibold">{recordings.length} <span className="text-sm font-normal text-muted-foreground">/ {MAX_FILES} recordings</span></p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Selected files</p>
          <p className="mt-1.5 text-lg font-semibold">{(totalBytes / (1024 * 1024)).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">/ 100 MB</span></p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Potential issues flagged</p>
          <p className="mt-1.5 text-lg font-semibold">{findingsCount} <span className="text-sm font-normal text-muted-foreground">to review</span></p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
        <div className="text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">Privacy-first, no API credits required.</span> Audio files are decoded in this browser and are not uploaded or stored. Audio checks flag possible clipping, low signal and long low-level segments. Conversation checks use simple rules on a transcript you paste; automatic speech-to-text and deep semantic scoring are not included in this first version.
        </div>
      </div>

      {uploadMessage && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{uploadMessage}</span>
        </div>
      )}

      {!recordings.length ? (
        <Card className="border-dashed border-border/90 shadow-none">
          <CardContent className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand"><FileAudio className="h-6 w-6" /></span>
            <h3 className="mt-4 text-sm font-semibold">Add up to 10 audio recordings</h3>
            <p className="mt-1.5 max-w-lg text-xs leading-5 text-muted-foreground">WAV, MP3, M4A, AAC, OGG, OPUS, WebM, MP4 and FLAC are accepted. Each file may be up to 25 MB; total batch size is 100 MB.</p>
            <Button className="mt-4" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Choose audio files</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {recordings.map((recording, index) => (
            <Card key={recording.id} className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 font-mono text-xs font-semibold text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <CardTitle className="break-all text-sm leading-5">{recording.file.name}</CardTitle>
                      <CardDescription className="mt-1">{(recording.file.size / (1024 * 1024)).toFixed(2)} MB · {recording.file.type || "Audio file"} · Local only</CardDescription>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void analyzeRecording(recording)} disabled={busyId !== null}>
                      {busyId === recording.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Analyze recording
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={"Remove " + recording.file.name} onClick={() => removeRecording(recording.id)} disabled={busyId !== null}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                  <div className="flex items-center gap-2 text-xs font-medium"><Play className="h-3.5 w-3.5 text-brand" /> Listen to original recording</div>
                  <audio controls preload="metadata" src={recording.url} className="mt-2 w-full" />
                </div>

                {recording.metrics && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[
                      ["Duration", formatDuration(recording.metrics.durationSeconds)],
                      ["Channels", String(recording.metrics.channels)],
                      ["Sample rate", (recording.metrics.sampleRate / 1000).toFixed(1) + " kHz"],
                      ["Peak", dbfs(Math.pow(10, recording.metrics.peakDbfs / 20))],
                      ["Average level", recording.metrics.rmsDbfs.toFixed(1) + " dBFS"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-border bg-muted/20 p-2.5">
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor={"transcript-" + recording.id} className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-brand" /> Transcript (optional)
                  </label>
                  <p className="text-xs leading-5 text-muted-foreground">Paste an existing transcript. For speaker-aware checks, use one turn per line with labels like <code>Agent:</code> and <code>Caller:</code>.</p>
                  <Textarea
                    id={"transcript-" + recording.id}
                    value={recording.transcript}
                    onChange={(event) => patchRecording(recording.id, { transcript: event.target.value, status: "ready", findings: [], metrics: null })}
                    placeholder={"Agent: Hi, can I help you?\nCaller: I'm looking for a 2 BHK...\nAgent: What is your budget?"}
                    rows={4}
                    maxLength={50000}
                    className="text-sm"
                    disabled={busyId !== null}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">{recording.transcript.length.toLocaleString()} / 50,000 characters</span>
                    {recording.transcript.trim() && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><ClipboardPaste className="h-3 w-3" /> Transcript stays in this browser</span>}
                  </div>
                </div>

                {recording.status === "analyzing" && (
                  <div className="flex items-center gap-2 rounded-lg border border-brand/20 bg-brand/5 p-3 text-xs text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Analyzing the audio signal and provided transcript…</div>
                )}

                {(recording.status === "complete" || recording.status === "signal-unavailable") && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="flex items-center gap-2 text-sm font-semibold"><AlertCircle className="h-4 w-4 text-brand" /> Findings to review ({recording.findings.length})</h4>
                      <span className="text-[10px] text-muted-foreground">{recording.metrics ? "Audio signal checked" : "Audio signal decode unavailable"} · {recording.transcript.trim() ? "Transcript checked" : "No transcript supplied"}</span>
                    </div>
                    {recording.findings.map((finding) => (
                      <div key={finding.id} className="rounded-xl border border-border/80 bg-card p-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{finding.title}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{finding.area}</p>
                          </div>
                          <FindingBadge level={finding.level} />
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{finding.detail}</p>
                      </div>
                    ))}
                    <p className="flex items-start gap-2 text-[10px] leading-5 text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Findings are heuristic flags for human review, not proof of an agent fault. Confirm each against the original recording before drawing conclusions.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {recordings.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">Files and pasted transcripts are held in page memory only. Reloading this page clears the batch.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              recordings.forEach((recording) => URL.revokeObjectURL(recording.url));
              setRecordings([]);
              setUploadMessage("");
            }} disabled={busyId !== null}>Clear batch</Button>
            <Button onClick={() => void analyzeAll()} disabled={busyId !== null}>
              {busyId ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Waves className="mr-2 h-4 w-4" />}
              Analyze all
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
