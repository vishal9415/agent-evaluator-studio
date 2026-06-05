import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Loader2, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { runEvaluation } from "@/lib/playground.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const run = useServerFn(runEvaluation);
  const qc = useQueryClient();

  // Poll while running
  useEffect(() => {
    if (!activeEvalId) return;
    let cancelled = false;
    const tick = async () => {
      const [{ data: ev }, { data: sc }] = await Promise.all([
        supabase.from("evaluations").select("*").eq("id", activeEvalId).single(),
        supabase.from("scenarios").select("*").eq("evaluation_id", activeEvalId).order("idx"),
      ]);
      if (cancelled) return;
      if (ev) setEvalRow(ev as EvalRow);
      if (sc) setScenarios(sc as ScenarioRow[]);
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeEvalId]);

  const start = async () => {
    if (!systemPrompt.trim()) {
      toast.error("Add a system prompt first.");
      return;
    }
    setStarting(true);
    setEvalRow(null);
    setScenarios([]);
    setExpanded(new Set());
    try {
      const res = await run({
        data: { systemPrompt, model, agentType, promptId, scenarioCount: 50 },
      });
      setActiveEvalId(res.evaluationId);
      qc.invalidateQueries({ queryKey: ["evaluations"] });
      toast.success("Evaluation complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Evaluation failed");
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
      }
    | null
    | undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Automatic evaluation</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Generate 50 diverse scenarios, run them against your prompt, and get effectiveness +
              hallucination scores plus an improved prompt suggestion.
            </p>
          </div>
          <Button onClick={start} disabled={!!running}>
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run 50 scenarios
              </>
            )}
          </Button>
        </CardHeader>
        {evalRow && (
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Progress value={progress} className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {evalRow.completed_count}/{evalRow.scenario_count}
              </span>
              <Badge variant={evalRow.status === "done" ? "default" : "secondary"}>
                {evalRow.status}
              </Badge>
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
