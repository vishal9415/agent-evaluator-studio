import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const PUBLIC_SPACE_BASE = "https://hugging-apps-maya2-native.hf.space";
const languageCodes = ["as", "bn", "en", "gu", "hi", "kn", "ml", "mr", "or", "pa", "ta", "te"] as const;
const voiceNames = [
  "Ahana", "Vaidehi", "Malini", "Charvi", "Jahnavi", "Anirban", "Nakul", "Vasant",
  "Siddhant", "Satvik", "Abhay", "Nivedita", "Ishwari", "Ritvik", "Vrinda",
  "Sreekar", "Kayal", "Shaunak", "Akshat", "Tanushree",
] as const;

const requestSchema = z.object({
  input: z.string().trim().min(1).max(2500),
  language: z.enum(languageCodes),
  voice: z.enum(voiceNames),
  response_format: z.literal("wav").default("wav"),
  normalize: z.boolean().default(true),
});

type TtsRequest = z.infer<typeof requestSchema>;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function configuredBaseUrl(): string | null {
  const raw = process.env.MAYA_TTS_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

async function authenticate(request: Request): Promise<{ userId: string } | Response> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return jsonError("Please sign in before using Maya 2 Native.", 401);
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return jsonError("Missing authentication token.", 401);

  const supabaseUrl = process.env.PROMPTLAB_SUPABASE_URL;
  const publishableKey = process.env.PROMPTLAB_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return jsonError("PromptLab Supabase server authentication is not configured.", 503);

  try {
    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: "Bearer " + token } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.auth.getClaims(token);
    const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
    if (error || !userId) return jsonError("Your session could not be validated. Sign in again.", 401);
    return { userId };
  } catch {
    return jsonError("Could not validate the current session.", 401);
  }
}

async function checkHealth(base: string): Promise<{ ready: boolean; message: string; backend: string }> {
  try {
    const response = await fetch(base + "/health", {
      method: "GET",
      headers: process.env.MAYA_TTS_BEARER_TOKEN
        ? { Authorization: "Bearer " + process.env.MAYA_TTS_BEARER_TOKEN }
        : {},
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return { ready: false, message: "Maya server responded with HTTP " + response.status + ".", backend: "self-hosted" };
    let detail = "";
    try {
      const body = await response.json() as { status?: unknown; ready?: unknown };
      detail = typeof body.status === "string" ? body.status : typeof body.ready === "boolean" ? (body.ready ? "ready" : "loading") : "";
    } catch { /* any HTTP 2xx health response counts as reachable */ }
    return { ready: true, message: detail ? "Private Maya server reachable (" + detail + ")." : "Private Maya server reachable.", backend: "self-hosted" };
  } catch {
    return { ready: false, message: "Maya server is configured but unreachable from PromptLab. Check network access, server readiness and the private endpoint URL.", backend: "self-hosted" };
  }
}

async function checkPublicSpace(): Promise<{ ready: boolean; message: string; backend: string }> {
  try {
    const response = await fetch(PUBLIC_SPACE_BASE + "/", {
      method: "GET",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    // A sleeping Space can return 503 while it warms. The Generate request is
    // allowed to wake it; users see that this path is a shared public demo.
    if (response.ok || response.status === 503) {
      return {
        ready: true,
        message: response.status === 503
          ? "Hugging Face public demo is reachable but may be waking up; the first request can wait in a shared queue."
          : "Using the Hugging Face public demo. Shared queue/usage limits apply, and text is sent to Hugging Face.",
        backend: "huggingface-demo",
      };
    }
    return { ready: false, message: "The Hugging Face Maya demo returned HTTP " + response.status + ".", backend: "huggingface-demo" };
  } catch {
    return { ready: false, message: "Could not reach the public Hugging Face Maya demo. Try again or configure a private Maya server.", backend: "huggingface-demo" };
  }
}

function findAudioUrl(value: unknown): string | null {
  if (typeof value === "string") {
    return (/^https?:\/\//i.test(value) || value.startsWith("/")) && value.includes("gradio_api/file=") ? value : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAudioUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.url === "string") {
      const fromUrl = findAudioUrl(record.url);
      if (fromUrl) return fromUrl;
    }
    for (const item of Object.values(record)) {
      const found = findAudioUrl(item);
      if (found) return found;
    }
  }
  return null;
}

function errorFromSse(body: string): string | null {
  if (!/event:\s*error/i.test(body)) return null;
  const data = body.split(/\r?\n/).find((line) => line.startsWith("data:"));
  return data ? data.slice(5).trim().slice(0, 350) : "The public Maya demo returned an error.";
}

async function generateViaPublicSpace(payload: TtsRequest): Promise<Response> {
  if (payload.input.length > 1200) return jsonError("The public Hugging Face demo limits text to 1,200 characters. Shorten the text or configure a private Maya server.", 413);

  let accepted: Response;
  try {
    accepted = await fetch(PUBLIC_SPACE_BASE + "/gradio_api/call/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        data: [payload.input, payload.language, payload.voice, payload.normalize, 0, null, "", payload.language],
      }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
  } catch {
    return jsonError("Could not reach the public Hugging Face Maya demo. Retry, or configure a private Maya server.", 502);
  }
  if (!accepted.ok) {
    const text = (await accepted.text().catch(() => "")).slice(0, 250);
    return jsonError(
      "The Hugging Face Maya demo could not accept the request (HTTP " + accepted.status + "). " + text,
      accepted.status === 429 ? 429 : 502,
    );
  }

  let job: { event_id?: unknown };
  try {
    job = await accepted.json();
  } catch {
    return jsonError("The Hugging Face Maya demo returned an invalid job response.", 502);
  }
  if (typeof job.event_id !== "string" || !job.event_id) {
    return jsonError("The Hugging Face Maya demo did not return a job ID.", 502);
  }

  let sseResponse: Response;
  try {
    sseResponse = await fetch(PUBLIC_SPACE_BASE + "/gradio_api/call/generate/" + encodeURIComponent(job.event_id), {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      signal: AbortSignal.timeout(120000),
      cache: "no-store",
    });
  } catch {
    return jsonError("Timed out waiting for the public Maya demo. It may be loading weights or busy; retry once.", 504);
  }
  if (!sseResponse.ok) return jsonError("The public Maya demo job failed (HTTP " + sseResponse.status + ").", 502);

  const eventText = await sseResponse.text().catch(() => "");
  const eventError = errorFromSse(eventText);
  if (eventError) return jsonError("Maya demo error: " + eventError, 422);

  let fileUrl: string | null = null;
  const dataLines = eventText.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
  for (const line of dataLines.reverse()) {
    try {
      const parsed: unknown = JSON.parse(line);
      fileUrl = findAudioUrl(parsed);
      if (fileUrl) break;
    } catch { /* ignore Gradio progress payloads that are not JSON */ }
  }
  if (!fileUrl) return jsonError("The public Maya demo completed without a downloadable audio URL. Retry or configure a private Maya server.", 502);

  let validatedUrl: URL;
  try {
    validatedUrl = new URL(fileUrl, PUBLIC_SPACE_BASE);
  } catch {
    return jsonError("The public Maya demo returned an invalid audio URL.", 502);
  }
  if (validatedUrl.protocol !== "https:" || validatedUrl.hostname !== "hugging-apps-maya2-native.hf.space") {
    return jsonError("The public Maya demo returned an unexpected audio host.", 502);
  }

  let audioResponse: Response;
  try {
    audioResponse = await fetch(validatedUrl, {
      method: "GET",
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
  } catch {
    return jsonError("Could not download the generated audio from the public Maya demo.", 502);
  }
  if (!audioResponse.ok || !audioResponse.body) return jsonError("The public Maya demo generated audio but it could not be downloaded.", 502);

  return new Response(audioResponse.body, {
    status: 200,
    headers: {
      "Content-Type": audioResponse.headers.get("content-type") || "audio/wav",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const Route = createFileRoute("/api/maya-tts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;

        const base = configuredBaseUrl();
        const health = base ? await checkHealth(base) : await checkPublicSpace();
        return Response.json({ configured: true, ...health }, { headers: { "Cache-Control": "no-store" } });
      },
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;

        let payload: TtsRequest;
        try {
          payload = requestSchema.parse(await request.json());
        } catch {
          return jsonError("Invalid request. Provide speech text (up to 2,500 characters), a supported language and a voice.", 400);
        }

        const base = configuredBaseUrl();
        if (!base) return generateViaPublicSpace(payload);

        const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "audio/wav" };
        // Maya's reference server has no built-in authentication. A private reverse
        // proxy can be protected with this optional server-only bearer secret.
        if (process.env.MAYA_TTS_BEARER_TOKEN) headers.Authorization = "Bearer " + process.env.MAYA_TTS_BEARER_TOKEN;

        let upstream: Response;
        try {
          upstream = await fetch(base + "/v1/audio/speech", {
            method: "POST",
            headers,
            body: JSON.stringify({
              input: payload.input,
              language: payload.language,
              voice: payload.voice,
              response_format: payload.response_format,
              normalize: payload.normalize,
            }),
            signal: AbortSignal.timeout(120000),
            cache: "no-store",
          });
        } catch {
          return jsonError("Could not reach the configured Maya server. Confirm the model is loaded and the endpoint is privately reachable.", 502);
        }

        if (!upstream.ok || !upstream.body) {
          const message = (await upstream.text().catch(() => "")).slice(0, 350);
          console.error("[Maya TTS] Upstream request failed", { status: upstream.status });
          return jsonError("Maya speech generation failed (HTTP " + upstream.status + "). " + message, upstream.status >= 500 ? 502 : 422);
        }

        const upstreamType = upstream.headers.get("content-type") || "audio/wav";
        if (!upstreamType.toLowerCase().startsWith("audio/") && !upstreamType.toLowerCase().includes("octet-stream")) {
          return jsonError("Maya server returned a non-audio response. Check that /v1/audio/speech is configured for WAV output.", 502);
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": upstreamType,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
