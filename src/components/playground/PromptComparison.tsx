import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Copy, Download, GitCompareArrows, Loader2, Pause, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MODELS } from "@/lib/playground-constants";
import { SUITES, getSuite, type SuiteId } from "@/lib/eval-suites";
import { createComparison, advanceComparison, listComparisons } from "@/lib/prompt-comparison.functions";
import { pairedMetrics, comparisonDeltas, type Comparison, type Variant } from "@/lib/prompt-comparison";

type Props = { systemPrompt: string; model: string; agentType: string; hasStages: boolean; onApply: (text: string) => void };

export function PromptComparison({ systemPrompt, model, agentType, hasStages, onApply }: Props) {
  const [a, setA] = useState<Variant>({ label: "Baseline", systemPrompt, model });
  const [b, setB] = useState<Variant>({ label: "Candidate", systemPrompt, model });
  const [suite, setSuite] = useState<SuiteId>("balanced");
  const [count, setCount] = useState<5 | 10 | 50>(5);
  const [active, setActive] = useState<Comparison | null>(null);
  const [history, setHistory] = useState<Comparison[]>([]);
  const [busy, setBusy] = useState(false);
  const [pausing, setPausing] = useState(false);
  const alive = useRef(true);
  const stopped = useRef(false);
  const create = useServerFn(createComparison);
  const advance = useServerFn(advanceComparison);
  const list = useServerFn(listComparisons);

  async function refresh() {
    try { const rows = await list(); if (alive.current) setHistory(rows); }
    catch { toast.error("Could not load saved comparisons."); }
  }
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => { alive.current = false; stopped.current = true; };
  }, []);

  async function run(existing?: Comparison) {
    stopped.current = false;
    setPausing(false);
    setBusy(true);
    try {
      let row = existing ?? await create({ data: { a, b, suite, count, agentType: agentType === "voice" ? "voice" : "chat" } });
      if (alive.current) setActive(row);
      while (row.status !== "done" && !stopped.current && alive.current) {
        row = await advance({ data: { id: row.id } });
        if (alive.current) setActive(row);
      }
      if (alive.current && row.status === "done") toast.success("Comparison complete");
    } catch (e) { if (alive.current) toast.error(e instanceof Error ? e.message : "Comparison failed"); }
    finally { if (alive.current) { setBusy(false); setPausing(false); void refresh(); } }
  }

  const delta = active ? comparisonDeltas(active.results) : null;
  const metricsA = active ? pairedMetrics(active.results, "a") : null;
  const metricsB = active ? pairedMetrics(active.results, "b") : null;

  function exportResults() {
    if (!active) return;
    const blob = new Blob([JSON.stringify({ ...active, metricsA, metricsB, delta, protocol: "Identical fixed user turns; baseline-derived expected behavior; paired valid results only. Voice is transcript-only, not audio evaluation." }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `prompt-comparison-${active.id}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return <section className="space-y-6 min-w-0" aria-label="Prompt comparison">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <h2 className="flex items-center gap-2 text-base font-semibold"><GitCompareArrows className="h-4 w-4" /> Prompt comparison</h2>
      <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={busy}><RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh results</Button>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      {([{ value: a, set: setA, side: "A" }, { value: b, set: setB, side: "B" }] as const).map(({ value, set, side }) => <div key={side} className="space-y-3 min-w-0">
        <Label htmlFor={`compare-name-${side}`} className="text-xs font-semibold">{side === "A" ? "A · Baseline" : "B · Candidate"}</Label>
        <Input id={`compare-name-${side}`} value={value.label} disabled={busy} maxLength={100} onChange={(e) => set({ ...value, label: e.target.value })} />
        <Select value={value.model} onValueChange={(m) => set({ ...value, model: m })} disabled={busy}>
          <SelectTrigger className="w-full min-w-0 text-xs" aria-label={`${side} model`}><SelectValue /></SelectTrigger>
          <SelectContent>{MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Label htmlFor={`compare-prompt-${side}`} className="text-xs">System prompt</Label>
        <Textarea id={`compare-prompt-${side}`} value={value.systemPrompt} disabled={busy} maxLength={20000} onChange={(e) => set({ ...value, systemPrompt: e.target.value })} className="min-h-[220px] font-mono text-xs" />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => set({ ...value, systemPrompt, model })}><Copy className="mr-2 h-3.5 w-3.5" /> Use current system prompt</Button>
      </div>)}
    </div>
    {hasStages && <p className="text-xs text-muted-foreground">System-prompt comparison only. Begin messages, stage transitions and voice timing are not evaluated.</p>}
    {agentType === "voice" && <p className="text-xs text-muted-foreground">Voice scenarios are evaluated as transcripts, not audio or interruption latency.</p>}
    <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
      <div className="space-y-1.5"><Label className="text-xs">Benchmark suite</Label><Select value={suite} onValueChange={(s) => setSuite(s as SuiteId)} disabled={busy}><SelectTrigger className="w-full min-w-0 text-xs"><SelectValue /></SelectTrigger><SelectContent>{SUITES.map((s) => <SelectItem value={s.id} key={s.id}>{s.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label className="text-xs">Scenario pairs</Label><Select value={String(count)} onValueChange={(s) => setCount(Number(s) as 5 | 10 | 50)} disabled={busy}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{[5, 10, 50].map((n) => <SelectItem key={n} value={String(n)}>{n} pairs</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => void run()} disabled={busy || !a.systemPrompt.trim() || !b.systemPrompt.trim() || !a.label.trim() || !b.label.trim()}><Play className="mr-2 h-4 w-4" /> Run comparison</Button>
      {busy && <Button variant="outline" disabled={pausing} onClick={() => { stopped.current = true; setPausing(true); }}><Pause className="mr-2 h-4 w-4" />{pausing ? "Pausing after this pair…" : "Pause after current pair"}</Button>}
      {busy && !active && <span className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Preparing shared benchmark…</span>}
    </div>
    <div className="space-y-1.5"><Label className="text-xs">Saved comparisons</Label><Select value={active?.id ?? "none"} disabled={busy} onValueChange={(id) => { const row = history.find((h) => h.id === id); if (row) setActive(row); }}><SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Select a comparison" /></SelectTrigger><SelectContent><SelectItem value="none" disabled>Select a comparison</SelectItem>{history.map((h) => <SelectItem key={h.id} value={h.id}>{h.name} · {new Date(h.created_at).toLocaleDateString()} · {h.completed_count}/{h.scenario_count}</SelectItem>)}</SelectContent></Select></div>
    {active && <div className="space-y-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-sm break-words">{active.name}</h3><Badge variant="outline">{busy ? "Running" : active.status === "done" ? "Complete" : "Incomplete"}</Badge></div>
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{getSuite(active.suite).label}</span><span className="shrink-0">{active.completed_count}/{active.scenario_count} pairs</span></div>
      <Progress value={active.completed_count / active.scenario_count * 100} />
      <p className="text-xs text-muted-foreground">{metricsA?.count ?? 0} valid paired results · Same user turns and expected behavior for A and B · AI-judged evidence, not certification.</p>
      {active.error && <p className="text-xs text-destructive">{active.error}</p>}
      <div className="flex flex-wrap gap-2">
        {!busy && active.status !== "done" && <Button variant="outline" size="sm" onClick={() => void run(active)}><Play className="mr-2 h-3.5 w-3.5" /> Resume comparison</Button>}
        <Button variant="outline" size="sm" onClick={exportResults}><Download className="mr-2 h-3.5 w-3.5" /> Export evidence</Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => { onApply(active.variant_b.systemPrompt); toast.success("Candidate applied to system prompt"); }}>Apply tested candidate</Button>
      </div>
      {metricsA && metricsB && <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b text-left"><th className="py-2">Metric</th><th className="p-2">A</th><th className="p-2">B</th><th className="p-2">B − A</th></tr></thead><tbody>
        {(["effectiveness", "hallucination", "passRate", "safety", "privacy", "adversarial"] as const).map((key) => {
          const diff = metricsB[key] - metricsA[key];
          return <tr key={key} className="border-b"><td className="py-3">{{ effectiveness: "Effectiveness", hallucination: "Hallucination risk ↓", passRate: "Pass rate", safety: "Safety", privacy: "Privacy", adversarial: "Attack resistance" }[key]}</td><td className="p-2 tabular-nums">{metricsA[key].toFixed(1)}</td><td className="p-2 tabular-nums">{metricsB[key].toFixed(1)}</td><td className="p-2 tabular-nums"><span className="inline-flex items-center gap-1">{diff > 0 ? <ArrowUp className="h-3 w-3" /> : diff < 0 ? <ArrowDown className="h-3 w-3" /> : null}{diff > 0 ? "+" : ""}{diff.toFixed(1)}</span></td></tr>;
        })}
      </tbody></table></div>}
      {active.results.map((pair) => {
        const scenario = active.scenarios[pair.idx];
        return <details key={pair.idx} className="rounded-md border p-3"><summary className="cursor-pointer text-sm">#{pair.idx + 1} · {scenario?.user_goal} <span className="text-xs text-muted-foreground">A: {pair.a ? pair.a.passed ? "Pass" : "Fail" : "Error"} · B: {pair.b ? pair.b.passed ? "Pass" : "Fail" : "Error"}</span></summary>
          <p className="mt-3 text-xs text-muted-foreground">Expected: {scenario?.expected_behavior}</p>
          {pair.error && <p className="mt-2 text-xs text-destructive">{pair.error}</p>}
          <div className="mt-3 grid gap-4 xl:grid-cols-2">{(["a", "b"] as const).map((side) => <div key={side} className="min-w-0 space-y-2 text-xs"><h4 className="font-semibold">{side === "a" ? active.variant_a.label : active.variant_b.label}</h4><p>{pair[side]?.notes}</p><Badge variant="outline">{pair[side]?.severity ?? "Unscored"}</Badge>{pair[side]?.conversation.map((m, i) => <div key={i} className="border-l-2 pl-2"><span className="font-semibold capitalize">{m.role}</span><p className="whitespace-pre-wrap break-words text-muted-foreground">{m.content}</p></div>)}</div>)}</div>
        </details>;
      })}
    </div>}
  </section>;
}