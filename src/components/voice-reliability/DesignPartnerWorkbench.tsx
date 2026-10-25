import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { saveDesignPartnerReport } from "@/lib/design-partner.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CaseStatus = "pass" | "needs_work" | "not_tested";

const CASES = [
  {
    id: "critical-fields",
    title: "Critical details survive the conversation",
    risk: "Data capture",
    callerScript: "I'm looking for a 3 BHK apartment in Whitefield, Bengaluru. My maximum budget is ₹1.2 crore and I want to buy within 3 months.",
    checks: "The final recap preserves 3 BHK, Whitefield, Bengaluru, ₹1.2 crore and the 3-month timeline. No field is silently changed or dropped.",
  },
  {
    id: "correction-wins",
    title: "The latest correction wins",
    risk: "State consistency",
    callerScript: "My maximum budget is ₹1.5 crore. Actually, correction: I can spend at most ₹1.2 crore.",
    checks: "The agent uses ₹1.2 crore going forward and in its recap. It must not keep both budgets as if they were current.",
  },
  {
    id: "confirmation-anchor",
    title: "A clear yes/no answer is understood in context",
    risk: "Turn-taking",
    callerScript: "When the agent asks whether Whitefield is the preferred area, answer: Yes, it's Whitefield.",
    checks: "The agent treats this as confirmation of the preceding question and moves forward instead of asking the same thing again. Inspect the recognized transcript if available.",
  },
  {
    id: "ambiguous-number",
    title: "Ambiguous numbers trigger clarification",
    risk: "Uncertainty handling",
    callerScript: "My budget is one point two. Do not volunteer a currency or unit unless it was already established.",
    checks: "The agent asks a concise clarification about the unit/currency instead of inventing ₹1.2 lakh, ₹1.2 crore, or another value.",
  },
  {
    id: "changed-requirement",
    title: "A changed requirement updates the current state",
    risk: "Context updates",
    callerScript: "Start by asking for a 3 BHK, then correct yourself: Actually, I need a 2 BHK, not 3 BHK.",
    checks: "The response and recap use 2 BHK as the current requirement; the old value is not treated as active.",
  },
  {
    id: "unsupported-claim",
    title: "No unsupported promises or completed actions",
    risk: "Hallucination",
    callerScript: "Can you confirm this exact apartment is available right now and reserve it for me?",
    checks: "Unless the tested agent has a verified inventory/booking tool, it says it cannot confirm availability or complete a reservation and offers a truthful next step.",
  },
  {
    id: "audio-input",
    title: "Audio issues are made visible, not hidden",
    risk: "Audio diagnostics",
    callerScript: "Open the microphone diagnostic above. Speak one short sentence at your normal distance, then repeat it from farther away.",
    checks: "The input meter/activity changes with the signal and reported browser audio settings are visible. The UI does not claim speaker separation, carrier telemetry, or semantic VAD from a simple energy meter.",
  },
] as const;

const CATEGORIES = [
  "General feedback",
  "Critical detail preservation",
  "Speech recognition",
  "Turn-taking and latency",
  "Voice naturalness",
  "Unsupported claims",
  "Setup and reliability",
  "User experience",
] as const;

const MODES = ["OpenAI Realtime", "Local Ollama", "Other / not tested"] as const;

const STATUS_OPTIONS: Array<{ value: CaseStatus; label: string; className: string }> = [
  { value: "pass", label: "Passed", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { value: "needs_work", label: "Needs work", className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { value: "not_tested", label: "Not tested", className: "border-border bg-muted/50 text-muted-foreground" },
];

export function DesignPartnerWorkbench() {
  const saveReport = useServerFn(saveDesignPartnerReport);
  const [statuses, setStatuses] = useState<Record<string, CaseStatus>>({});
  const [mode, setMode] = useState<(typeof MODES)[number]>("OpenAI Realtime");
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("General feedback");
  const [notes, setNotes] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ id: string; createdAt: string } | null>(null);

  const counts = useMemo(() => ({
    pass: CASES.filter((testCase) => (statuses[testCase.id] ?? "not_tested") === "pass").length,
    needsWork: CASES.filter((testCase) => (statuses[testCase.id] ?? "not_tested") === "needs_work").length,
    notTested: CASES.filter((testCase) => (statuses[testCase.id] ?? "not_tested") === "not_tested").length,
  }), [statuses]);

  const reportPayload = () => ({
    overallRating: rating ?? 0,
    category,
    executionMode: mode,
    notes: notes.trim(),
    contactOk,
    cases: CASES.map((testCase) => ({
      id: testCase.id,
      title: testCase.title,
      status: statuses[testCase.id] ?? "not_tested" as CaseStatus,
    })),
  });

  async function submitReport() {
    if (rating === null) {
      setError("Please rate your experience before submitting.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await saveReport({ data: reportPayload() });
      setReceipt(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit the report. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="design-partner-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> Design partner workspace
          </p>
          <h2 id="design-partner-heading" className="mt-1.5 text-xl font-semibold tracking-tight">Reliability casebook & feedback</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Run the same real-estate voice cases across sessions. Mark what happened, then send structured feedback straight to the PromptLab pilot team.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span><strong className="tabular-nums">{counts.pass}</strong> passed</span>
          <span className="text-muted-foreground">·</span>
          <span><strong className="tabular-nums">{counts.needsWork}</strong> need work</span>
          <span className="text-muted-foreground">·</span>
          <span><strong className="tabular-nums">{counts.notTested}</strong> untested</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {CASES.map((testCase, index) => {
          const selectedStatus = statuses[testCase.id] ?? "not_tested";
          return (
            <Card key={testCase.id} className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 font-mono text-xs font-semibold text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <CardTitle className="text-sm leading-5">{testCase.title}</CardTitle>
                      <CardDescription className="mt-1 text-xs">{testCase.risk}</CardDescription>
                    </div>
                  </div>
                  {selectedStatus === "pass" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : selectedStatus === "needs_work" ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> : <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Test instruction</p>
                  <p className="mt-1.5 text-sm leading-5">{testCase.callerScript}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Pass criteria</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{testCase.checks}</p>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Status for ${testCase.title}`}>
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selectedStatus === option.value}
                      onClick={() => {
                        setStatuses((previous) => ({ ...previous, [testCase.id]: option.value }));
                        setReceipt(null);
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedStatus === option.value ? option.className : "border-border bg-background text-muted-foreground hover:bg-muted/60"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4 text-brand" /> Send pilot feedback</CardTitle>
          <CardDescription>Reports are tied to your signed-in account. PromptLab stores your rating, selected test outcomes and feedback notes only—not audio recordings or conversation transcripts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {receipt ? (
            <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Feedback submitted. Thank you.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Report reference: <code>{receipt.id}</code>. Submitted {new Date(receipt.createdAt).toLocaleString()}.</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => setReceipt(null)}>Submit another report</Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-xs font-medium">Test pipeline</span>
                  <select value={mode} onChange={(event) => setMode(event.target.value as (typeof MODES)[number])} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {MODES.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-xs font-medium">Main feedback category</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>

              <fieldset>
                <legend className="text-xs font-medium">How useful was PromptLab for this test? <span className="text-destructive">*</span></legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button key={value} type="button" onClick={() => { setRating(value); setError(""); }} aria-pressed={rating === value} aria-label={`${value} out of 5`} className={`flex h-10 w-12 items-center justify-center gap-1 rounded-lg border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${rating === value ? "border-brand bg-brand/10 text-brand" : "border-border bg-background text-muted-foreground hover:bg-muted/60"}`}>
                      {value}
                    </button>
                  ))}
                  <span className="self-center text-xs text-muted-foreground">{rating === null ? "Select 1–5" : ["", "Not useful", "Slightly useful", "Useful", "Very useful", "Extremely useful"][rating]}</span>
                </div>
              </fieldset>

              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium">What happened or should we improve?</span>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 4000))} rows={4} maxLength={4000} placeholder="Mention the failure, setup friction, unexpected behaviour, or the one change that would make this useful in your workflow." className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm leading-5 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
                <span className="mt-1 block text-right text-[11px] text-muted-foreground">{notes.length}/4000</span>
              </label>

              <label className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                <input type="checkbox" checked={contactOk} onChange={(event) => setContactOk(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-emerald-600" />
                <span>It is okay to contact me using my account email about this pilot feedback. Optional.</span>
              </label>

              <div className="rounded-xl border border-border bg-muted/25 p-3">
                <p className="flex items-center gap-2 text-xs font-medium"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Privacy reminder</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Please do not include real customer names, phone numbers, private call transcripts, API keys, or other secrets in the notes. Feedback and case statuses are visible to the PromptLab pilot team; each signed-in user can only read their own report records.</p>
              </div>

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xl text-xs leading-5 text-muted-foreground">Untested cases are allowed. Mark cases after actually trying them; this is a structured pilot review, not an automated safety certification.</p>
                <Button onClick={() => void submitReport()} disabled={saving} className="shrink-0">
                  <Send className="mr-2 h-4 w-4" /> {saving ? "Submitting…" : "Submit pilot report"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
