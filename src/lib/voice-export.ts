import { fillVariables, transitionToolName, type Stage } from "./playground-constants";

export const EXPORT_TARGETS = [
  { id: "vapi", label: "Vapi", format: "Assistant draft", docs: "https://docs.vapi.ai/api-reference/assistants/create" },
  { id: "retell", label: "Retell AI", format: "Prompt and flow handoff", docs: "https://docs.retellai.com/build/conversation-flow/overview" },
  { id: "livekit", label: "LiveKit", format: "Developer handoff", docs: "https://docs.livekit.io/agents/" },
  { id: "bland", label: "Bland AI", format: "Pathway handoff", docs: "https://docs.bland.ai/api-v2/overview" },
  { id: "openai", label: "OpenAI Realtime", format: "Session update draft", docs: "https://developers.openai.com/api/reference/resources/realtime/client-events/" },
] as const;
export type ExportTarget = typeof EXPORT_TARGETS[number]["id"];
export type AgentExportInput = {
  name: string; systemPrompt: string; beginMessage: string; model: string;
  agentType: string; stages: Stage[]; variables: Record<string, string>;
};

export function buildVoiceExport(input: AgentExportInput, target: ExportTarget, substitute: boolean) {
  if (!input.systemPrompt.trim()) throw new Error("Add a system prompt before exporting.");
  const descriptor = EXPORT_TARGETS.find((item) => item.id === target);
  if (!descriptor) throw new Error("Unknown export platform.");
  const ids = new Set(input.stages.map((stage) => stage.id));
  if (ids.size !== input.stages.length || input.stages.some((stage) => stage.transitions.some((edge) => !ids.has(edge.target))))
    throw new Error("Fix duplicate stages or missing transition targets before exporting.");
  const render = (text: string) => substitute ? fillVariables(text, input.variables) : text;
  const stages = input.stages.map((stage) => ({
    ...stage, prompt: render(stage.prompt),
    transitions: stage.transitions.map((edge) => ({ ...edge, condition: render(edge.condition),
      toolName: transitionToolName(input.stages.find((s) => s.id === edge.target)?.name ?? "stage") })),
  }));
  const systemPrompt = render(input.systemPrompt);
  const beginMessage = render(input.beginMessage);
  const effectivePrompt = [systemPrompt, stages[0]?.prompt].filter(Boolean).join("\n\n");
  const warnings = ["Export does not create or deploy an agent. Configure credentials, voice, transcription and call handling in the target platform."];
  if (stages.length) warnings.push("All stages and transitions are preserved in the handoff. Draft runtime configuration starts at the first stage; a developer must implement stage switching and carry conversation history forward.");
  if (input.agentType !== "voice") warnings.push("The source is a chat agent. Voice settings still need to be configured.");
  if (substitute) warnings.push("Sample variable values are included. Review the download for personal information before sharing.");
  if (/\{\{[^}]+\}\}/.test(JSON.stringify({ systemPrompt, beginMessage, stages })))
    warnings.push("Unresolved variables remain. Supply their values at call time before sending instructions or speaking the begin message.");
  let draft: Record<string, unknown> | null = null;
  if (target === "vapi") {
    draft = { name: input.name || "Untitled agent", model: { provider: "openai", model: "gpt-4.1", messages: [{ role: "system", content: effectivePrompt }] }, ...(beginMessage ? { firstMessage: beginMessage } : {}) };
    warnings.push("Vapi draft uses OpenAI GPT-4.1 rather than the playground model. Review it and select a voice before creating an assistant.");
  } else if (target === "openai") {
    draft = { type: "session.update", session: { type: "realtime", model: "gpt-realtime", instructions: effectivePrompt } };
    warnings.push("Realtime draft uses gpt-realtime. The begin message must be spoken separately by your application; session.update alone does not speak it.");
  } else {
    warnings.push(`${descriptor.label} receives a developer handoff, not a native import file. Map prompts and transitions to the platform's current runtime and validate before deployment.`);
  }
  return { schemaVersion: 1, target, format: descriptor.format, documentation: descriptor.docs,
    warnings, draft,
    source: { name: input.name, agentType: input.agentType, model: input.model, systemPrompt, beginMessage,
      entryStageId: stages[0]?.id ?? null, stages, variableNames: Object.keys(input.variables),
      ...(substitute ? { sampleVariables: input.variables } : {}) },
    runtimeContract: { beginMessage: "Speak verbatim after call-time variable substitution; no LLM call. Empty means the model opens.",
      stages: "Prepend systemPrompt to only the active stage prompt. On a matching transition, switch stage and preserve history and model.",
      voice: "Configure and validate voice, VAD, interruptions, echo cancellation and hangup in the target runtime; browser settings are not portable." },
  };
}