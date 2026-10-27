import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

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

async function checkHealth(base: string): Promise<{ ready: boolean; message: string }> {
  try {
    const response = await fetch(base + "/health", {
      method: "GET",
      headers: process.env.MAYA_TTS_BEARER_TOKEN
        ? { Authorization: "Bearer " + process.env.MAYA_TTS_BEARER_TOKEN }
        : {},
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return { ready: false, message: "Maya server responded with HTTP " + response.status + "." };
    let detail = "";
    try {
      const body = await response.json() as { status?: unknown; ready?: unknown };
      detail = typeof body.status === "string" ? body.status : typeof body.ready === "boolean" ? (body.ready ? "ready" : "loading") : "";
    } catch { /* any HTTP 2xx health response counts as reachable */ }
    return { ready: true, message: detail ? "Maya server reachable (" + detail + ")." : "Maya server reachable." };
  } catch {
    return { ready: false, message: "Maya server is configured but unreachable from PromptLab. Check network access, server readiness and the private endpoint URL." };
  }
}

export const Route = createFileRoute("/api/maya-tts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;

        const base = configuredBaseUrl();
        if (!base) {
          return Response.json({
            configured: false,
            ready: false,
            message: "MAYA_TTS_BASE_URL is not set to a valid HTTP(S) URL in the PromptLab server environment.",
          }, { headers: { "Cache-Control": "no-store" } });
        }

        const health = await checkHealth(base);
        return Response.json({ configured: true, ...health }, { headers: { "Cache-Control": "no-store" } });
      },
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;

        let payload: z.infer<typeof requestSchema>;
        try {
          payload = requestSchema.parse(await request.json());
        } catch {
          return jsonError("Invalid request. Provide speech text (up to 2,500 characters), a supported language and a voice.", 400);
        }

        const base = configuredBaseUrl();
        if (!base) return jsonError("Maya 2 Native is not configured. Set MAYA_TTS_BASE_URL on the PromptLab server.", 503);

        const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "audio/wav" };
        // Maya's reference server has no built-in authentication. A private reverse
        // proxy can be protected with this optional server-only bearer secret.
        if (process.env.MAYA_TTS_BEARER_TOKEN) {
          headers.Authorization = "Bearer " + process.env.MAYA_TTS_BEARER_TOKEN;
        }

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
            signal: AbortSignal.timeout(120_000),
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
