import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { FileDown, ShieldCheck, Play, Loader2, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { runEvaluation } from "@/lib/playground.functions";
import { getEvaluation } from "@/lib/playground-data.functions";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SUITES, DEFAULT_SUITE, type SuiteId } from "@/lib/eval-suites";
import { exportAuditReport } from "@/lib/audit-report";

interface Props {
  systemPrompt: string;
  model: string;
  agentType: string;
  promptId: string | null;
  onApplyImprovedPrompt: (s: string) => void;
}

type EvalRow = {
  id: string;
  status: string;
  scenario_count: number;
  completed_count: number;
  effectiveness_score: number | null;
  hallucination_risk: number | null;
  summary: any;
  error: string | null;
  created_at: string;
};

type ScenarioRow = {
  id: string;
  idx: number;
  category: string | null;
  user_goal: string;
  expected_behavior: string | null;
  conversation: any;
  effectiveness: number | null;
  hallucination: number | null;
  passed: boolean | null;
  notes: string | null;
  status: string;
};

export function AutoEval({ systemPrompt, model, agentType, promptId, onApplyImprovedPrompt }: Props) {
  const [activeEvalId, setActiveEvalId] = useState<string | null>(null);
  const [evalRow, setEvalRow] = useState<EvalRow | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [suite, setSuite] = useState<SuiteId>(DEFAULT_SUITE);
  const run = useServerFn(runEvaluation);
  const fetchEval = useServerFn(getEvaluation);
  const qc = useQueryClient();

  // Poll while running
  useEffect(() => {
    if (!activeEvalId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetchEval({ data: { evaluationId: activeEvalId } });
        if (cancelled) return;
        if (res.evaluation) setEvalRow(res.evaluation as EvalRow);
        setScenarios((res.scenarios ?? []) as ScenarioRow[]);
      } catch {
        /* transient */
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvalId]);


  const start = async (count: number) => {
    if (!systemPrompt.trim()) {
      setStartError("Add a system prompt in the configuration panel before running an evaluation.");
      toast.error("Add a system prompt first.");
      return;
    }
    setStartError("");
    setStarting(true);
    setEvalRow(null);
    setScenarios([]);
    setExpanded(new Set());
    try {
      const res = await run({
        data: { systemPrompt, model, agentType, promptId, scenarioCount: count, suite },
      });
      setActiveEvalId(res.evaluationId);
      qc.invalidateQueries({ queryKey: ["evaluations"] });
      toast.success("Evaluation started", { description: "Results will appear here as scenarios are processed." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Evaluation failed";
      setStartError(message);
      toast.error(message);
    } finally {
      setStarting(false);
    }
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const running = starting || (evalRow && evalRow.status !== "done" && evalRow.status !== "error");
  const progress = evalRow ? (evalRow.completed_count / Math.max(evalRow.scenario_count, 1)) * 100 : 0;
  const summary = evalRow?.summary as
    | {
        verdict?: string;
        strengths?: string[];
        weaknesses?: string[];
        hallucination_drivers?: string[];
        suggestions?: string[];
        improved_prompt?: string;
        passRate?: number;
        enterprise?: Enterprise;
      }
    | null
    | undefined;

  const currentScenario = scenarios.find((s) => s.status === "running") ??
    (running ? scenarios.find((s) => s.status === "pending") : undefined);
  const passedCount = scenarios.filter((s) => s.status === "done" && s.passed).length;
  const failedCount = scenarios.filter((s) => s.status === "done" && s.passed === false).length;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-[22px] border-[#e0e9e3] bg-white shadow-[0_12px_40px_-30px_rgba(16,43,37,0.35)]">
        <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-brand" /> Automatic evaluation</CardTitle>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground">
              Generate scenarios, test behavior, score effectiveness and hallucination indicators, then review the evidence and suggestions.
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            <Button onClick={() => start(5)} disabled={!!running || !systemPrompt.trim()} variant="outline" size="sm" className="min-w-0 flex-1 rounded-lg sm:flex-none">
              {running && evalRow?.scenario_count === 5 ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}Run 5
            </Button>
            <Button onClick={() => start(10)} disabled={!!running || !systemPrompt.trim()} variant="outline" size="sm" className="min-w-0 flex-1 rounded-lg sm:flex-none">
              {running && evalRow?.scenario_count === 10 ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}Run 10
            </Button>
            <Button onClick={() => start(50)} disabled={!!running || !systemPrompt.trim()} size="sm" className="min-w-0 flex-1 rounded-lg sm:flex-none">
              {running && evalRow?.scenario_count === 50 ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}Run 50
            </Button>
          </div>
        </CardHeader>
        <div className="border-b border-border bg-muted/20 px-4 py-3 sm:px-6">
          <p className="text-xs leading-5 text-muted-foreground">
            {model.startsWith("ollama/")
              ? "Local inference selected. Calls use the Ollama service configured for this PromptLab server and do not incur per-token model API fees. Larger runs may take longer."
              : "Hosted inference selected. Scenario generation, simulated turns, and judging may consume AI gateway/provider credits. Start with 5 scenarios before choosing a larger run."}
          </p>
        </div>
        {startError && <div role="alert" className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs leading-5 text-destructive sm:mx-6"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{startError}</div>}
        <div className="px-4 py-4 sm:px-6">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Test suite
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {SUITES.map((su) => (
              <button
                key={su.id}
                type="button"
                disabled={!!running}
                onClick={() => setSuite(su.id)}
                className={cn(
                  "rounded-lg border p-2.5 text-left transition-colors disabled:opacity-60",
                  suite === su.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                )}
              >
                <div className="text-xs font-semibold">{su.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{su.description}</div>
              </button>
            ))}
          </div>
        </div>
        {evalRow && (
          <CardContent className="space-y-4 border-t bg-muted/20 pt-4">
            <div className="flex items-end justify-between">
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  {evalRow.status === "done"
                    ? "Evaluation complete"
                    : evalRow.status === "error"
                      ? "Evaluation failed"
                      : `Running evaluation · ${evalRow.status}`}
                </div>
                <div className="text-sm font-medium">
                  {currentScenario
                    ? `Scenario ${currentScenario.idx + 1}: ${currentScenario.user_goal.slice(0, 60)}${currentScenario.user_goal.length > 60 ? "…" : ""}`
                    : evalRow.status === "done"
                      ? "All scenarios processed"
                      : "Preparing scenarios…"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">
                  {evalRow.completed_count}
                  <span className="text-muted-foreground/60">/{evalRow.scenario_count}</span>
                </div>
                <div className="text-[10px] font-medium text-muted-foreground">
                  {progress.toFixed(0)}% complete
                </div>
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  evalRow.status === "error"
                    ? "bg-destructive"
                    : "bg-gradient-to-r from-primary via-primary to-primary/70 shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_40%,transparent)]",
                )}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {passedCount} passed
              </span>
              <span className="flex items-center gap-1.5 text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                {failedCount} failed
              </span>
              {running && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  Active
                </span>
              )}
              <span className="ml-auto">
                <Badge
                  variant={
                    evalRow.status === "done"
                      ? "default"
                      : evalRow.status === "error"
                        ? "destructive"
                        : "secondary"
                  }
                  className="rounded-full text-[10px] uppercase tracking-wider"
                >
                  {evalRow.status}
                </Badge>
              </span>
            </div>
            {evalRow.error && (
              <p className="text-sm text-destructive">{evalRow.error}</p>
            )}
          </CardContent>
        )}
      </Card>


      {evalRow?.status === "done" && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <ScoreCard
              label="Effectiveness"
              value={evalRow.effectiveness_score ?? 0}
              suffix="/100"
              positive
            />
            <ScoreCard
              label="Hallucination risk"
              value={evalRow.hallucination_risk ?? 0}
              suffix="/100"
            />
            <ScoreCard
              label="Pass rate"
              value={summary?.passRate ?? 0}
              suffix="%"
              positive
            />
          </div>

          {summary?.enterprise && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-3">
                <div>
                  <CardTitle className="text-base">Enterprise readiness</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {summary.enterprise.suiteLabel} · prompt #{summary.enterprise.promptHash}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={summary.enterprise.readiness === "Requires Remediation" ? "destructive" : "default"}
                    className="rounded-full"
                  >
                    {summary.enterprise.readiness}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      exportAuditReport({ evalRow: evalRow!, scenarios, summary: summary!, model, agentType, systemPrompt })
                    }
                  >
                    <FileDown className="mr-1.5 h-3.5 w-3.5" /> Export audit report
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Mini label="Safety & alignment" v={summary.enterprise.safety} />
                <Mini label="PII protection" v={summary.enterprise.privacy} />
                <Mini label="Adversarial resistance" v={summary.enterprise.adversarial} />
                <Mini label="Critical failures" v={summary.enterprise.criticalFailures} raw bad={summary.enterprise.criticalFailures > 0} />
                <Mini label="High failures" v={summary.enterprise.highFailures} raw bad={summary.enterprise.highFailures > 0} />
              </CardContent>
            </Card>
          )}

          {summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {summary.verdict && (
                  <p className="leading-relaxed">{summary.verdict}</p>
                )}
                <Section title="Strengths" items={summary.strengths} />
                <Section title="Weaknesses" items={summary.weaknesses} tone="warn" />
                <Section
                  title="What's driving hallucinations"
                  items={summary.hallucination_drivers}
                  tone="warn"
                />
                <Section title="Suggested fixes" items={summary.suggestions} tone="info" />

                {summary.improved_prompt && (
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Suggested improved prompt</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onApplyImprovedPrompt(summary.improved_prompt!);
                          toast.success("Applied to editor");
                        }}
                      >
                        Apply to editor
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {summary.improved_prompt}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {scenarios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scenarios ({scenarios.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-2">
              <ul className="space-y-2">
                {scenarios.map((s) => {
                  const isOpen = expanded.has(s.id);
                  return (
                    <li key={s.id} className="rounded-md border">
                      <button
                        className="flex w-full items-start gap-2 p-3 text-left hover:bg-muted/50"
                        onClick={() => toggle(s.id)}
                      >
                        {isOpen ? (
                          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">#{s.idx + 1}</span>
                            {s.category && (
                              <Badge variant="outline" className="text-xs">
                                {s.category}
                              </Badge>
                            )}
                            <StatusPill status={s.status} passed={s.passed} />
                            {(() => {
                              const e = summary?.enterprise?.scenarios.find((x) => x.idx === s.idx);
                              if (!e || e.severity === "none") return null;
                              return (
                                <Badge variant="outline" className={cn("text-[10px] uppercase", SEV_CLASS[e.severity])}>
                                  {e.severity}{e.vulnerability ? ` · ${e.vulnerability}` : ""}
                                </Badge>
                              );
                            })()}
                          </div>
                          <p className="mt-1 text-sm">{s.user_goal}</p>
                          {(s.effectiveness !== null || s.hallucination !== null) && (
                            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                              <span>Eff: {s.effectiveness?.toFixed(0) ?? "–"}</span>
                              <span>Halluc: {s.hallucination?.toFixed(0) ?? "–"}</span>
                            </div>
                          )}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="space-y-2 border-t bg-muted/20 p-3 text-xs">
                          {s.expected_behavior && (
                            <p>
                              <span className="font-semibold">Expected:</span> {s.expected_behavior}
                            </p>
                          )}
                          {s.notes && (
                            <p>
                              <span className="font-semibold">Judge notes:</span> {s.notes}
                            </p>
                          )}
                          {Array.isArray(s.conversation) && (
                            <div className="space-y-1.5">
                              {s.conversation.map((m: any, i: number) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "rounded px-2 py-1.5",
                                    m.role === "user"
                                      ? "bg-primary/10"
                                      : "bg-background border",
                                  )}
                                >
                                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                                    {m.role}
                                  </div>
                                  <div className="whitespace-pre-wrap">{m.content}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  value,
  suffix,
  positive,
}: {
  label: string;
  value: number;
  suffix: string;
  positive?: boolean;
}) {
  const v = Number(value) || 0;
  // For positive metrics (eff, pass): high = good. For others (hallucination): high = bad.
  const good = positive ? v >= 70 : v <= 30;
  const mid = positive ? v >= 50 : v <= 50;
  const color = good ? "text-emerald-600" : mid ? "text-amber-600" : "text-destructive";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-3xl font-semibold", color)}>
          {v.toFixed(1)}
          <span className="text-base text-muted-foreground">{suffix}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items?: string[];
  tone?: "warn" | "info";
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="mb-1.5 text-sm font-semibold">{title}</h4>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span
              className={cn(
                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                tone === "warn"
                  ? "bg-amber-500"
                  : tone === "info"
                    ? "bg-blue-500"
                    : "bg-emerald-500",
              )}
            />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusPill({ status, passed }: { status: string; passed: boolean | null }) {
  if (status === "done") {
    return passed ? (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="h-3 w-3" /> pass
      </Badge>
    ) : (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> fail
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" /> error
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Loader2 className="h-3 w-3 animate-spin" /> {status}
    </Badge>
  );
}

export type Enterprise = {
  suite: string;
  suiteLabel: string;
  safety: number;
  privacy: number;
  adversarial: number;
  criticalFailures: number;
  highFailures: number;
  readiness: string;
  promptHash: string;
  scenarios: Array<{ idx: number; severity: string; vulnerability: string; safety: number; privacy: number; adversarial: number }>;
};

const SEV_CLASS: Record<string, string> = {
  low: "border-muted-foreground/30 text-muted-foreground",
  moderate: "border-amber-500/50 text-amber-600",
  high: "border-orange-500/60 text-orange-600",
  critical: "border-destructive text-destructive",
};

function Mini({ label, v, raw, bad }: { label: string; v: number; raw?: boolean; bad?: boolean }) {
  const n = Number(v) || 0;
  const color = raw ? (bad ? "text-destructive" : "text-emerald-600") : n >= 85 ? "text-emerald-600" : n >= 70 ? "text-amber-600" : "text-destructive";
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", color)}>{raw ? n : n.toFixed(0)}</div>
    </div>
  );
}


