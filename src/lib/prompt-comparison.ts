import { z } from "zod";
import { computeReadiness } from "./eval-suites";
import { MODELS } from "./playground-constants";

export const variantSchema = z.object({
  label: z.string().trim().min(1).max(100),
  systemPrompt: z.string().trim().min(1).max(20000),
  model: z.string().refine((m) => MODELS.some((item) => item.value === m), "Choose a supported model"),
});
export const scenarioSchema = z.object({
  category: z.string(), user_goal: z.string(), expected_behavior: z.string(),
  opening_message: z.string().min(1),
  userTurns: z.array(z.string().min(1)).min(1).max(3),
});
export type Variant = z.infer<typeof variantSchema>;
export type ComparisonScenario = z.infer<typeof scenarioSchema>;
export type Judgement = {
  conversation: Array<{ role: string; content: string }>;
  effectiveness: number; hallucination: number; passed: boolean; notes: string;
  safety: number; privacy: number; adversarial: number; severity: string; vulnerability: string;
};
export type PairResult = { idx: number; a: Judgement | null; b: Judgement | null; error: string | null };
export type Comparison = {
  id: string; name: string; status: string; suite: string; agent_type: string;
  variant_a: Variant; variant_b: Variant; scenarios: ComparisonScenario[];
  results: PairResult[]; completed_count: number; scenario_count: number;
  error: string | null; created_at: string; updated_at: string;
};

export function pairedMetrics(results: PairResult[], side: "a" | "b") {
  const valid = results.filter((r) => r.a && r.b).flatMap((r) => r[side] ? [r[side]] : []);
  if (!valid.length) return null;
  const avg = (key: "effectiveness" | "hallucination" | "safety" | "privacy" | "adversarial") =>
    valid.reduce((sum, r) => sum + r[key], 0) / valid.length;
  const passRate = valid.filter((r) => r.passed).length / valid.length * 100;
  const criticalFailures = valid.filter((r) => r.severity === "critical").length;
  const highFailures = valid.filter((r) => r.severity === "high").length;
  return { count: valid.length, effectiveness: avg("effectiveness"), hallucination: avg("hallucination"),
    safety: avg("safety"), privacy: avg("privacy"), adversarial: avg("adversarial"), passRate,
    criticalFailures, highFailures,
    readiness: computeReadiness({ safety: avg("safety"), hallucination: avg("hallucination"), passRate, criticalFailures, highFailures }) };
}

export function comparisonDeltas(results: PairResult[]) {
  const a = pairedMetrics(results, "a");
  const b = pairedMetrics(results, "b");
  if (!a || !b) return null;
  return { effectiveness: b.effectiveness - a.effectiveness,
    hallucination: b.hallucination - a.hallucination, passRate: b.passRate - a.passRate };
}