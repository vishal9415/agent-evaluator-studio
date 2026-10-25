import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function speakerLabel(speakerId: string | null, labels: Map<string, string>): string {
  if (!speakerId) return "Speaker";
  const existing = labels.get(speakerId);
  if (existing) return existing;
  const label = "Speaker " + (labels.size + 1);
  labels.set(speakerId, label);
  return label;
}

function formatSpeakerTranscript(words: unknown): string | null {
  if (!Array.isArray(words)) return null;
  const labels = new Map<string, string>();
  const segments: Array<{ speaker: string; text: string }> = [];

  for (const item of words) {
    if (!item || typeof item !== "object") continue;
    const word = item as { text?: unknown; speaker_id?: unknown; type?: unknown };
    if (typeof word.text !== "string" || !word.text) continue;
    const speakerId = typeof word.speaker_id === "string" ? word.speaker_id : null;
    const label = speakerLabel(speakerId, labels);
    const isSpacing = word.type === "spacing" || !word.text.trim();
    let current = segments[segments.length - 1];
    if (!current || current.speaker !== label) {
      if (isSpacing) continue;
      current = { speaker: label, text: "" };
      segments.push(current);
    }
    current.text += word.text;
  }

  const result = segments
    .map((segment) => segment.speaker + ": " + segment.text.trim())
    .filter((line) => !line.endsWith(": "))
    .join("\n")
    .trim();

  return result || null;
}

export const Route = createFileRoute("/api/recording-transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) {
          return errorResponse("Please sign in before transcribing a recording.", 401);
        }
        const token = authorization.slice("Bearer ".length).trim();
        if (!token) return errorResponse("Missing authentication token.", 401);

        const supabaseUrl = process.env.PROMPTLAB_SUPABASE_URL;
        const publishableKey = process.env.PROMPTLAB_SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !publishableKey) {
          return errorResponse("PromptLab Supabase server configuration is missing.", 503);
        }

        try {
          const authClient = createClient(supabaseUrl, publishableKey, {
            global: { headers: { Authorization: "Bearer " + token } },
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          });
          const { data, error } = await authClient.auth.getClaims(token);
          if (error || !data?.claims?.sub) {
            return errorResponse("Your session could not be validated. Sign in again.", 401);
          }
        } catch {
          return errorResponse("Could not validate your current session.", 401);
        }

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) return errorResponse("Transcription is not configured. Add ELEVENLABS_API_KEY to the server secrets.", 503);

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return errorResponse("Expected a multipart file upload.", 400);
        }

        const fileEntry = form.get("file");
        if (!(fileEntry instanceof File)) return errorResponse("Choose an audio file to transcribe.", 400);
        const file = fileEntry as File;
        if (file.size < 1) return errorResponse("The selected file is empty.", 400);
        if (file.size > MAX_FILE_BYTES) return errorResponse("Files must be 25 MB or smaller for this upload.", 413);

        const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
        const acceptedExtensions = new Set(["wav", "mp3", "m4a", "aac", "ogg", "oga", "opus", "webm", "mp4", "flac"]);
        if (!file.type.startsWith("audio/") && !acceptedExtensions.has(extension)) {
          return errorResponse("Unsupported audio format. Try WAV, MP3, M4A, OGG, WebM or FLAC.", 415);
        }

        const upstreamForm = new FormData();
        upstreamForm.append("file", file, file.name);
        upstreamForm.append("model_id", "scribe_v2");
        upstreamForm.append("diarize", "true");
        upstreamForm.append("tag_audio_events", "true");
        upstreamForm.append("timestamps_granularity", "word");

        let upstream: Response;
        try {
          upstream = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: { "xi-api-key": apiKey },
            body: upstreamForm,
            signal: AbortSignal.timeout(120_000),
          });
        } catch {
          return errorResponse("Could not reach the transcription provider. Retry with a smaller recording or check provider access.", 502);
        }

        if (!upstream.ok) {
          if (upstream.status === 401 || upstream.status === 403) {
            return errorResponse("The transcription provider rejected the configured API key or its permissions.", 502);
          }
          if (upstream.status === 429 || upstream.status === 402) {
            return errorResponse("Transcription could not proceed because of provider rate limits or available usage. Check your ElevenLabs plan and usage.", 429);
          }
          if (upstream.status === 413) return errorResponse("The transcription provider rejected this file size.", 413);
          if (upstream.status === 422) return errorResponse("The transcription provider could not process this file. Try WAV or MP3.", 422);
          console.error("[Recording transcription] Provider request failed", { status: upstream.status });
          return errorResponse("Transcription provider error (HTTP " + upstream.status + ").", 502);
        }

        let result: { text?: unknown; words?: unknown; language_code?: unknown };
        try {
          result = await upstream.json();
        } catch {
          return errorResponse("The transcription provider returned an invalid response.", 502);
        }

        const transcript = formatSpeakerTranscript(result.words) ?? (typeof result.text === "string" ? result.text.trim() : "");
        if (!transcript) return errorResponse("No transcript was returned for this recording.", 422);

        return Response.json({
          transcript: transcript.slice(0, 50000),
          languageCode: typeof result.language_code === "string" ? result.language_code : null,
          diarized: Boolean(formatSpeakerTranscript(result.words)),
        });
      },
    },
  },
});
