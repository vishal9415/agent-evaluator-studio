import { useState } from "react";
import { ArrowRight, Check, GitCompareArrows, ShieldCheck, FileCheck2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const views = [
  { id: "evaluate", label: "Risk evaluation", Icon: ShieldCheck },
  { id: "compare", label: "Prompt comparison", Icon: GitCompareArrows },
  { id: "audit", label: "Audit evidence", Icon: FileCheck2 },
] as const;

export function EnterprisePreview() {
  const [view, setView] = useState<(typeof views)[number]["id"]>("evaluate");
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 rounded-full bg-brand" /> Customer support agent <span className="font-mono text-xs text-muted-foreground">v3.2</span></span>
        <span className="text-xs text-muted-foreground">Illustrative report · not a live evaluation</span>
      </div>
      <div role="tablist" aria-label="Product examples" className="flex flex-wrap gap-1 border-b border-border bg-muted/40 p-2">
        {views.map(({ id, label, Icon }) => <Button key={id} role="tab" aria-selected={view === id} aria-controls={`preview-${id}`} id={`tab-${id}`} variant={view === id ? "secondary" : "ghost"} size="sm" onClick={() => setView(id)}><Icon />{label}</Button>)}
      </div>
      <div id={`preview-${view}`} role="tabpanel" aria-labelledby={`tab-${view}`} className="min-h-[340px] p-5 sm:p-7">
        {view === "evaluate" && <>
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-muted-foreground">OWASP red-teaming suite</p><h3 className="mt-1 text-xl font-semibold">Find the failure before your customer does.</h3></div><span className="flex items-center gap-1.5 text-xs font-medium text-destructive"><AlertTriangle className="h-4 w-4" />Requires remediation</span></div>
          <div className="my-6 grid grid-cols-3 divide-x divide-border border-y border-border py-4">{[["Safety score", "84 / 100"], ["Pass rate", "80%"], ["Critical failures", "1"]].map(([label, value]) => <div key={label} className="px-3 first:pl-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold sm:text-2xl">{value}</p></div>)}</div>
          <div className="space-y-3 text-sm">{[[true, "Role override", "Agent stays within its assigned role"], [true, "Knowledge boundaries", "Unknown information escalated"], [false, "Prompt extraction", "Internal instructions disclosed"]].map(([ok, title, detail]) => <div key={String(title)} className="flex items-center gap-3"><span className={ok ? "text-brand" : "text-destructive"}>{ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</span><span className="min-w-0 flex-1 font-medium">{title}</span><span className="hidden text-muted-foreground sm:inline">{detail}</span></div>)}</div>
        </>}
        {view === "compare" && <><p className="text-xs text-muted-foreground">Controlled, paired scenarios</p><h3 className="mt-1 text-xl font-semibold">Same conversations. Two prompt variants.</h3><div className="mt-6 grid grid-cols-2 divide-x divide-border border-y border-border py-5">{[["A · Baseline", "76%", "18%"], ["B · Candidate", "92%", "6%"]].map(([label, pass, risk]) => <div key={label} className="px-5 first:pl-0"><p className="text-sm font-medium">{label}</p><p className="mt-4 text-3xl font-semibold">{pass}</p><p className="text-xs text-muted-foreground">Pass rate</p><p className="mt-4 text-sm">{risk} hallucination risk</p></div>)}</div><p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground"><GitCompareArrows className="h-4 w-4 shrink-0" />Identical scripted user turns and expected behavior, scored by a common evaluator.</p><p className="mt-3 text-xs text-muted-foreground">System-prompt comparison; voice runs evaluate transcripts, not audio quality.</p></>}
        {view === "audit" && <><p className="text-xs text-muted-foreground">Evaluation evidence</p><h3 className="mt-1 text-xl font-semibold">A decision with a traceable record.</h3><div className="mt-6 space-y-4">{["Agent configuration and prompt fingerprint", "Readiness verdict and severity matrix", "Scenario transcripts and evaluator findings", "Printable report and review sign-off section"].map((text, i) => <div key={text} className="flex items-center gap-3 border-b border-border pb-3"><span className="font-mono text-xs text-muted-foreground">0{i + 1}</span><span className="text-sm">{text}</span><FileCheck2 className="ml-auto h-4 w-4 text-brand" /></div>)}</div><p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">Evidence for your review process <ArrowRight className="h-3 w-3" /> not a compliance certification</p></>}
      </div>
    </div>
  );
}
