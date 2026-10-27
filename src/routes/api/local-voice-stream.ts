import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const requestSchema = z.object({
  model: z.enum(["ollama/llama3.2:1b", "ollama/llama3.2:3b", "ollama/qwen3:4b"]),
  instructions: z.string().trim().min(1).max(5000),
  responseLanguage: z.string().trim().min(2).max(40).optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(4000),
  })).min(1).max(8),
});

function ollamaRoot(): string {
  return (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1")
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "");
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/local-voice-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) {
          return jsonError("Please sign in before using the local voice agent.", 401);
        }

        const supabaseUrl = process.env.PROMPTLAB_SUPABASE_URL;
        const supabaseKey = process.env.PROMPTLAB_SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !supabaseKey) {
          return jsonError("PromptLab Supabase authentication is not configured on this server. Add PROMPTLAB_SUPABASE_URL and PROMPTLAB_SUPABASE_PUBLISHABLE_KEY.", 503);
        }

        const token = authorization.slice("Bearer ".length).trim();
        if (!token) return jsonError("Missing authentication token.", 401);

        try {
          const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: "Bearer " + token } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
          if (claimsError || !claimsData?.claims?.sub) {
            return jsonError("Your session has expired. Sign in again.", 401);
          }
        } catch {
          return jsonError("Could not validate the current session.", 401);
        }

        let parsed: z.infer<typeof requestSchema>;
        try {
          parsed = requestSchema.parse(await request.json());
        } catch {
          return jsonError("Invalid local voice request. Keep the prompt under 5,000 characters and send up to 8 recent messages.", 400);
        }

        const ollamaModel = parsed.model === "ollama/qwen3:4b" ? "qwen3:4b" : parsed.model === "ollama/llama3.2:1b" ? "llama3.2:1b" : "llama3.2:3b";
        const systemPrompt =
          "You are a concise, natural spoken-conversation agent. Answer in one or two short sentences, then ask at most one useful follow-up question. Do not use markdown or narrate your reasoning. Preserve names, locations, numbers, budgets, currencies, dates and corrections exactly. A clear yes/no confirmation confirms the immediately preceding question; do not ask for the same detail again unless the answer is genuinely ambiguous. If a critical value is unclear, ask the caller to repeat just that value. Follow these agent instructions:\n\n" +
          parsed.instructions +
          (parsed.responseLanguage ? "\n\nRespond in " + parsed.responseLanguage + " unless the caller explicitly asks to use another language." : "");

        let upstream: Response;
        try {
          upstream = await fetch(ollamaRoot() + "/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: ollamaModel,
              messages: [
                { role: "system", content: systemPrompt },
                ...parsed.messages,
              ],
              stream: true,
              keep_alive: "10m",
              options: { temperature: 0.25, num_predict: 120, num_ctx: 4096 },
            }),
            signal: request.signal,
          });
        } catch {
          return jsonError("Could not reach Ollama. Confirm it is running on this machine and try Refresh models.", 502);
        }

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          return jsonError("Ollama returned an error: " + (detail || upstream.statusText || "unknown error").slice(0, 400), 502);
        }

        // Proxy Ollama NDJSON directly so the browser can render and speak
        // completed phrases while the model is still generating its reply.
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
