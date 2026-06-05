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
  { value: "chat", label: "Chat assistant" },
  { value: "voice", label: "Voice agent" },
  { value: "support", label: "Customer support" },
  { value: "sales", label: "Sales / outbound" },
  { value: "booking", label: "Appointment booking" },
  { value: "tutor", label: "Tutor / coach" },
  { value: "qa", label: "Knowledge Q&A" },
];

export const DEFAULT_PROMPT = `You are a friendly customer support agent for Acme Cloud, a SaaS file-storage product.

Help users with: account questions, billing, file sharing, plans (Free, Pro, Team).

Rules:
- Be concise and warm. Use the user's name if known.
- If you don't know an answer, say so and offer to escalate to a human.
- Never invent prices, features, or policies that aren't in your knowledge.
- Do not discuss competitors or unrelated topics.`;
