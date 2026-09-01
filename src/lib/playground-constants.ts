export const MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (preview, fast & cheap)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (cheapest)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (strongest reasoning)" },
  { value: "openai/gpt-5", label: "GPT-5" },
  { value: "openai/gpt-5-mini", label: "GPT-5 mini" },
  { value: "openai/gpt-5-nano", label: "GPT-5 nano" },
  { value: "openai/gpt-5.2", label: "GPT-5.2 (reasoning)" },
];

export const AGENT_TYPES = [
  { value: "chat", label: "Chat" },
  { value: "voice", label: "Voice" },
];

export type StageTransition = {
  id: string;
  target: string; // stage id
  condition: string;
};

export type Stage = {
  id: string;
  name: string;
  prompt: string;
  transitions: StageTransition[];
};

export const DEFAULT_BEGIN_MESSAGE =
  "Hi {{lead_name}}, this is Maya from Acme Cloud. Do you have a quick minute?";

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

/** move_to_<slug of stage name> */
export function transitionToolName(stageName: string) {
  const slug =
    stageName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "stage";
  return `move_to_${slug}`;
}

/** Substitute {{variable}} placeholders. Unknown vars are left as-is. */
export function fillVariables(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, key: string) =>
    vars[key] !== undefined && vars[key] !== "" ? vars[key] : m,
  );
}

export const DEFAULT_PROMPT = `You are a friendly customer support agent for Acme Cloud, a SaaS file-storage product.

Help users with: account questions, billing, file sharing, plans (Free, Pro, Team).

Rules:
- Be concise and warm. Use the user's name if known.
- If you don't know an answer, say so and offer to escalate to a human.
- Never invent prices, features, or policies that aren't in your knowledge.
- Do not discuss competitors or unrelated topics.`;
