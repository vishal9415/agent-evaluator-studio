import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Shield, AlertTriangle, AlertOctagon, Info } from "lucide-react";
import type { Guardrail, Severity } from "@/lib/guardrails-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const severityMeta: Record<Severity, { label: string; className: string; Icon: typeof Shield }> = {
  low: { label: "Low", className: "bg-muted text-muted-foreground border-border", Icon: Info },
  medium: { label: "Medium", className: "bg-[color:var(--info)]/10 text-[color:var(--info)] border-[color:var(--info)]/30", Icon: Shield },
  high: { label: "High", className: "bg-[color:var(--warning)]/10 text-[color:var(--warning)] border-[color:var(--warning)]/30", Icon: AlertTriangle },
  critical: { label: "Critical", className: "bg-destructive/10 text-destructive border-destructive/30", Icon: AlertOctagon },
};

export function GuardrailCard({ g }: { g: Guardrail }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const sev = severityMeta[g.severity];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(g.prompt);
      setCopied(true);
      toast.success("Guardrail copied", { description: "Paste it into your prompt editor and adapt it to your agent." });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard access is unavailable", { description: "Open this page in a secure browser context and try again." });
    }
  };

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${sev.className}`}>
              <sev.Icon className="h-3 w-3" />
              {sev.label}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{g.id}</span>
          </div>
          <h3 className="mt-2 text-base font-semibold leading-tight text-foreground">{g.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{g.description}</p>
        </div>
      </header>

      <div className="mt-3 flex flex-wrap gap-1">
        {g.industries.map((i) => (
          <Badge key={i} variant="secondary" className="rounded-md text-[11px] font-normal">{i}</Badge>
        ))}
        {g.useCases.map((u) => (
          <Badge key={u} variant="outline" className="rounded-md text-[11px] font-normal">{u}</Badge>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Models</span>
        {g.models.map((m) => (
          <span key={m} className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-foreground">
            {m}
          </span>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-muted/35">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">system prompt</span>
          <Button size="sm" variant="ghost" onClick={copy} className="h-7 gap-1.5 px-2 text-xs">
            {copied ? <Check className="h-3.5 w-3.5 text-[color:var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <pre className={`whitespace-pre-wrap px-3 py-3 font-mono text-[11px] leading-6 text-foreground ${expanded ? "" : "max-h-32 overflow-hidden"}`}>
          {g.prompt}
        </pre>
        {g.prompt.length > 220 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full border-t border-border px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {expanded ? "Show less" : "Show full prompt"}
          </button>
        )}
      </div>
    </article>
  );
}
