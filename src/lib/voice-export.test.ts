import { describe, expect, it } from "vitest";
import { buildVoiceExport, EXPORT_TARGETS, type AgentExportInput } from "./voice-export";
const input: AgentExportInput = { name: "Collections", systemPrompt: "Follow verified policy for {{lead_name}}.",
  beginMessage: "Hello {{lead_name}}", model: "google/gemini-2.5-flash", agentType: "voice", variables: { lead_name: "Priya" },
  stages: [{ id: "intro", name: "Intro", prompt: "Verify identity.", transitions: [{ id: "edge", target: "pay", condition: "Identity verified" }] },
    { id: "pay", name: "Payment", prompt: "Discuss payment.", transitions: [] }] };
describe("voice platform exports", () => {
  it("preserves every stage and transition without flattening them into the active prompt", () => {
    const result = buildVoiceExport(input, "vapi", false);
    expect(result.source.stages).toHaveLength(2);
    expect(result.source.stages[0].transitions[0]).toMatchObject({ target: "pay", condition: "Identity verified", toolName: "move_to_payment" });
    expect(JSON.stringify(result.draft)).toContain("Verify identity.");
    expect(JSON.stringify(result.draft)).not.toContain("Discuss payment.");
  });
  it("omits sample values by default and keeps call-time placeholders", () => {
    const result = buildVoiceExport(input, "vapi", false);
    expect(JSON.stringify(result)).not.toContain("Priya");
    expect(result.source.beginMessage).toBe("Hello {{lead_name}}");
  });
  it("substitutes samples only when explicitly enabled", () => {
    expect(buildVoiceExport(input, "openai", true).source.beginMessage).toBe("Hello Priya");
  });
  it("does not invent native imports for developer handoff platforms", () => {
    for (const target of ["retell", "bland", "livekit"] as const) expect(buildVoiceExport(input, target, false).draft).toBeNull();
    expect(EXPORT_TARGETS).toHaveLength(5);
  });
  it("rejects transitions to missing stages", () => {
    expect(() => buildVoiceExport({ ...input, stages: [input.stages[0]] }, "vapi", false)).toThrow("missing transition targets");
  });
});