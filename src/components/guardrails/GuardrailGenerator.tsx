import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { generateGuardrails, type GeneratedGuardrail } from "@/lib/guardrails.functions";

const EXAMPLE =
  "Outbound voice agent for an Indian two-wheeler loan company. It calls customers whose EMI is overdue by 1-30 days, reminds them of the amount and due date, offers a payment link by SMS, and can schedule a promise-to-pay date. Customers often speak Hinglish.";

export function GuardrailGenerator() {
  const gen = useServerFn(generateGuardrails);
  const [useCase, setUseCase] = useState("");
  const [agentType, setAgentType] = useState<"Chat" | "Voice">("Voice");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [result, setResult] = useState<{ summary: string; guardrails: GeneratedGuardrail[] } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const run = async () => {
    if (useCase.trim().length < 20) {
      setValidationError("Add a little more detail (at least 20 characters) so the guardrails can fit your use case.");
      return;
    }
    setValidationError("");
    setLoading(true);
    try {
      const response = await gen({ data: { useCase: useCase.trim(), agentType } });
      setResult(response);
      toast.success("Guardrails generated", { description: "Review and adapt the suggestions before putting them into production." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Generation failed";
      setValidationError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success(key === "all" ? "All guardrails copied" : "Guardrail prompt copied");
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Clipboard access is unavailable", { description: "Select the prompt text and copy it manually." });
    }
  };

  const all = result?.guardrails.map((g) => `## ${g.title}\n${g.prompt}`).join("\n\n") ?? "";

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">Generate guardrails for your use case</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Describe what your agent does, who it talks to and what it can do. You'll get a tailored set of ready-to-paste guardrails.
      </p>
      <div className="mt-4 space-y-2">
        <Label htmlFor="guardrail-use-case" className="text-xs font-semibold">Describe your agent and its boundaries</Label>
        <Textarea
          id="guardrail-use-case"
          value={useCase}
          onChange={(e) => { setUseCase(e.target.value); setValidationError(""); }}
          placeholder={EXAMPLE}
          maxLength={5000}
          aria-invalid={Boolean(validationError)}
          aria-describedby="guardrail-use-case-help"
          disabled={loading}
          className="min-h-32 bg-background leading-6"
        />
        <div className="flex items-start justify-between gap-3">
          <p id="guardrail-use-case-help" className="text-xs leading-5 text-muted-foreground">Include the task, who the agent speaks to, allowed actions, and what it must avoid.</p>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{useCase.length}/5000</span>
        </div>
        {validationError && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">{validationError}</p>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Agent type</span>
        {(["Chat", "Voice"] as const).map((t) => (
          <Button key={t} type="button" size="sm" variant={agentType === t ? "default" : "outline"} aria-pressed={agentType === t} disabled={loading} onClick={() => setAgentType(t)}>
            {t}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" disabled={loading} onClick={() => { setUseCase(EXAMPLE); setValidationError(""); }}>Use example</Button>
        <Button type="button" size="sm" className="ml-auto gap-1.5" onClick={run} disabled={loading || useCase.trim().length < 20}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {loading ? "Generating…" : "Generate guardrails"}
        </Button>
      </div>

      {result && (
        <div className="mt-5 space-y-3">
          <div className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 p-3">
            <p className="text-sm text-foreground">{result.summary}</p>
            <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => copy("all", all)}>
              {copied === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copy all ({result.guardrails.length})
            </Button>
          </div>
          {result.guardrails.map((g, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={g.severity === "critical" ? "destructive" : "secondary"} className="text-[10px] uppercase">
                      {g.severity}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{g.category}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-foreground">{g.title}</h3>
                  <p className="text-xs text-muted-foreground">{g.risk}</p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => copy(String(i), g.prompt)}>
                  {copied === String(i) ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy
                </Button>
              </div>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono text-[12px] leading-relaxed text-foreground">{g.prompt}</pre>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Test it with:</span> “{g.test_utterance}”
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
