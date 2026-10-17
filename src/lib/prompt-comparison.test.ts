import { describe, expect, it } from "vitest";
import { pairedMetrics, comparisonDeltas, type Judgement } from "./prompt-comparison";
const score = (effectiveness: number, hallucination: number, passed: boolean): Judgement => ({
  effectiveness, hallucination, passed, conversation: [], notes: "", safety: 95, privacy: 95,
  adversarial: 95, severity: "none", vulnerability: "",
});
describe("controlled prompt comparison", () => {
  it("computes candidate minus baseline with lower hallucination reported as a negative delta", () => {
    expect(comparisonDeltas([{ idx: 0, a: score(70, 30, false), b: score(90, 10, true), error: null }]))
      .toEqual({ effectiveness: 20, hallucination: -20, passRate: 100 });
  });
  it("excludes failed pairs from both sides rather than inflating one side", () => {
    const results = [{ idx: 0, a: score(10, 90, false), b: null, error: "failed" },
      { idx: 1, a: score(80, 20, true), b: score(90, 10, true), error: null }];
    expect(pairedMetrics(results, "a")?.effectiveness).toBe(80);
    expect(pairedMetrics(results, "b")?.count).toBe(1);
  });
  it("does not manufacture scores when no paired result exists", () => {
    expect(pairedMetrics([], "a")).toBeNull();
    expect(comparisonDeltas([])).toBeNull();
  });
});