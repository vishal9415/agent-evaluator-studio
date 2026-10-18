import { useState } from "react";
import { Copy, Download, ExternalLink, FileJson, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildVoiceExport, EXPORT_TARGETS, type AgentExportInput, type ExportTarget } from "@/lib/voice-export";

export function VoiceExport({ input }: { input: AgentExportInput }) {
  const [target, setTarget] = useState<ExportTarget>("vapi");
  const [samples, setSamples] = useState(false);
  let result: ReturnType<typeof buildVoiceExport> | null = null;
  let error = "";
  try { result = buildVoiceExport(input, target, samples); }
  catch (e) { error = e instanceof Error ? e.message : "Could not prepare export."; }
  const text = result ? JSON.stringify(result, null, 2) : "";
  const descriptor = EXPORT_TARGETS.find((item) => item.id === target);
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "agent"}-${target}-handoff.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Agent handoff downloaded");
  }
  return <section aria-label="Voice platform export" className="min-w-0 space-y-5">
    <div className="flex items-center gap-2 border-b pb-4"><FileJson className="h-4 w-4" /><h2 className="text-base font-semibold">Voice platform export</h2></div>
    <div className="space-y-2"><Label htmlFor="export-platform">Platform</Label>
      <Select value={target} onValueChange={(value) => { if (EXPORT_TARGETS.some((item) => item.id === value)) setTarget(value as ExportTarget); }}>
        <SelectTrigger id="export-platform" className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{EXPORT_TARGETS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium">{descriptor?.format}</span>
      <Button asChild variant="ghost" size="sm"><a href={descriptor?.docs} target="_blank" rel="noopener noreferrer">Platform documentation<ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button>
    </div>
    <Label className="flex items-center gap-2 text-xs"><Checkbox checked={samples} onCheckedChange={(checked) => setSamples(checked === true)} /> Include sample variable values</Label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {result && <>
      <ul className="space-y-2 border-l-2 border-border pl-3">{result.warnings.map((warning) => <li key={warning} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{warning}</span></li>)}</ul>
      <div className="flex flex-wrap gap-2">
        <Button onClick={download}><Download className="mr-2 h-4 w-4" /> Download handoff</Button>
        <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(text); toast.success("Agent handoff copied"); } catch { toast.error("Copy unavailable. Download the handoff instead."); } }}><Copy className="mr-2 h-4 w-4" /> Copy JSON</Button>
      </div>
      <div className="space-y-2"><h3 className="text-xs font-semibold">Export preview</h3><pre className="max-h-[520px] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground">{text}</pre></div>
    </>}
  </section>;
}