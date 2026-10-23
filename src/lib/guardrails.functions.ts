import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callGateway } from "./playground.functions";
import { GUARDRAILS } from "./guardrails-data";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  useCase: z.string().trim().min(20).max(4000),
  agentType: z.enum(["Chat", "Voice"]),
});

export type GeneratedGuardrail = {
  title: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  risk: string;
  prompt: string;
  test_utterance: string;
};

// Few-shot exemplars pulled from the curated library so the model learns the house style.
const EXEMPLAR_IDS = ["conv-identity-001", "voice-asr-003", "conv-escalate-001", "conv-ground-001"];

const PLAYBOOK = `You are a senior conversational-AI safety engineer who has shipped production chat and voice agents for banks, hospitals, telecoms and e-commerce. You write guardrail clauses that are pasted directly into an agent's system prompt.

METHOD — think through this silently before writing:
1. Extract: business, the agent's job, who it talks to, channel (chat/voice), inbound vs outbound, what actions/tools it likely has, what data it touches, jurisdiction/regulation signals (e.g. India → RBI, DPDP, TRAI DND; US → HIPAA, TCPA, FDCPA; EU → GDPR), and vulnerable-user exposure.
2. Map failure modes specific to THIS use case across: scope drift, hallucinated facts (prices, policies, dates, eligibility), unsafe actions without confirmation, identity/verification gaps, sensitive data (PII, card, OTP, health), regulatory duties, escalation to human, emotional/vulnerable users, prompt injection & persona attacks, AI disclosure, conversation flow (silence, interruptions, one-question-per-turn, closing), and — for Voice — speech-recognition errors and speakable output.
3. Write one guardrail per real risk. Skip categories that genuinely do not apply.

QUALITY BAR — every guardrail MUST:
- Name the concrete trigger and the exact behaviour, using domain nouns from the use case (e.g. "policy number", "EMI amount", "appointment slot"), never generic words like "sensitive information" or "appropriate".
- Include at least one exact phrase the agent should say, in quotes.
- Be imperative, second person ("Never…", "If the caller…, say…"), 2–6 sentences, directly pasteable.
- Be testable: also give a realistic user utterance that would probe it.
- Not contradict the business goal (don't forbid the agent's core job).
BANNED: "be helpful", "be respectful", "ensure accuracy", "as appropriate", "use best judgement", "sensitive information" without specifics, restating generic AI-safety boilerplate.

Return 12–20 guardrails ordered by severity (critical first).`;

export const generateGuardrails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const exemplars = GUARDRAILS.filter((g) => EXEMPLAR_IDS.includes(g.id))
      .map((g) => `### ${g.title} [${g.severity}]\n${g.prompt}`)
      .join("\n\n");

    const tools = [
      {
        type: "function",
        function: {
          name: "emit_guardrails",
          description: "Return the use-case analysis and tailored guardrails.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "2-3 sentences: what the agent does, who for, key risks found." },
              guardrails: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    category: { type: "string" },
                    severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                    risk: { type: "string", description: "The specific failure this prevents, in one sentence." },
                    prompt: { type: "string" },
                    test_utterance: { type: "string" },
                  },
                  required: ["title", "category", "severity", "risk", "prompt", "test_utterance"],
                  additionalProperties: false,
                },
              },
            },
            required: ["summary", "guardrails"],
            additionalProperties: false,
          },
        },
      },
    ];

    const json = await callGateway({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: `${PLAYBOOK}\n\nSTYLE EXEMPLARS (match this specificity):\n\n${exemplars}` },
        {
          role: "user",
          content: `Agent channel: ${data.agentType}\n\nUse case described by the builder:\n"""\n${data.useCase}\n"""`,
        },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "emit_guardrails" } },
    });

    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    let args: { summary?: string; guardrails?: GeneratedGuardrail[] } = {};
    try {
      args = call ? JSON.parse(call.function.arguments) : {};
    } catch {
      args = {};
    }
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    const guardrails = (args.guardrails ?? [])
      .filter((g) => g && g.prompt)
      .sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));
    if (!guardrails.length) throw new Error("The AI didn't return any guardrails. Please try again.");
    return { summary: String(args.summary ?? ""), guardrails };
  });
