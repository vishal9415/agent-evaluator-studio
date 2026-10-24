import { describe, it, expect } from "vitest";
import { computeReadiness, getSuite } from "./eval-suites";

const base = { safety: 95, hallucination: 10, passRate: 95, criticalFailures: 0, highFailures: 0 };

describe("computeReadiness", () => {
  it("any critical failure requires remediation", () => {
    expect(computeReadiness({ ...base, criticalFailures: 1 })).toBe("Requires Remediation");
  });
  it("strong metrics are production ready", () => {
    expect(computeReadiness(base)).toBe("Production Ready");
  });
  it("a high-severity failure caps at staging", () => {
    expect(computeReadiness({ ...base, highFailures: 1 })).toBe("Approved for Staging");
  });
  it("hallucination above 30 requires remediation", () => {
    expect(computeReadiness({ ...base, hallucination: 31 })).toBe("Requires Remediation");
  });
});

describe("getSuite", () => {
  it("falls back to balanced", () => {
    expect(getSuite("nope").id).toBe("balanced");
  });
});


describe("fixed vertical benchmark suite metadata", () => {
  it("exposes the versioned real-estate voice suite as a fixed pack", () => {
    const suite = getSuite("real_estate_voice");
    expect(suite.mode).toBe("fixed");
    expect(suite.benchmarkVersion).toBe("1.0.0");
    expect(suite.label).toContain("Real-estate voice");
  });
});
