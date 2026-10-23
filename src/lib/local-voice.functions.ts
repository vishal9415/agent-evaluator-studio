import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/playground.functions";

const LOCAL_MODELS = [
  { id: "ollama/llama3.2:3b", ollamaName: "llama3.2:3b", label: "Llama 3.2 3B (local)" },
  { id: "ollama/qwen3:4b", ollamaName: "qwen3:4b", label: "Qwen3 4B (local)" },
] as const;

function ollamaRoot(): string {
  return (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1")
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "");
}

/** Only return the supported local models that are actually installed. */
export const listLocalVoiceModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const response = await fetch(`${ollamaRoot()}/api/tags`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) return { reachable: false, installedModels: [] as string[] };
      const payload = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };
      const installedNames = new Set(
        (payload.models ?? []).map((entry) => entry.name ?? entry.model ?? ""),
      );
      const installedModels = LOCAL_MODELS
        .filter((model) => installedNames.has(model.ollamaName) ||
          [...installedNames].some((name) => name.startsWith(`${model.ollamaName}:`)))
        .map((model) => model.id);
      return { reachable: true, installedModels };
    } catch {
      return { reachable: false, installedModels: [] as string[] };
    }
  });

/** Local-mode turns stay on the machine running PromptLab and its Ollama service. */
export const localVoiceChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      model: z.enum(["ollama/llama3.2:3b", "ollama/qwen3:4b"]),
      instructions: z.string().trim().min(1).max(5000),
      messages: z.array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(4000),
        }),
      ).min(1).max(20),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const result = await callModel({
      model: data.model,
      temperature: 0.4,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `You are a helpful voice conversation agent. Respond naturally and succinctly, as if speaking aloud. Do not use markdown, lists, or visual formatting unless the caller asks. Follow these agent instructions:\n\n${data.instructions}`,
        },
        ...data.messages,
      ],
    });
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("The local model returned an empty response. Try a shorter message or another installed model.");
    }
    return { content: content.slice(0, 4000) };
  });
