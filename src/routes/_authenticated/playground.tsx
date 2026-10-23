import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, CheckCircle2, Cpu, GitCompareArrows, Lightbulb, Loader2, Save, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { listPrompts, savePrompt as savePromptFn } from "@/lib/playground-data.functions";

import {
  AGENT_TYPES,
  DEFAULT_BEGIN_MESSAGE,
  DEFAULT_PROMPT,
  MODELS,
  type Stage,
} from "@/lib/playground-constants";
import { ManualChat } from "@/components/playground/ManualChat";
import { AutoEval } from "@/components/playground/AutoEval";
import { StagesEditor } from "@/components/playground/StagesEditor";
import { PromptCoach } from "@/components/playground/PromptCoach";
import { PromptComparison } from "@/components/playground/PromptComparison";
import { VoiceExport } from "@/components/playground/VoiceExport";
import { PromptVersionHistory, type PromptSnapshot } from "@/components/playground/PromptVersionHistory";

export const Route = createFileRoute("/_authenticated/playground")({
  head: () => ({
    meta: [
      { title: "PromptLab Playground — Test and compare AI agents" },
      {
        name: "description",
        content:
          "Test conversational agent prompts manually or auto-evaluate against 50 generated scenarios to measure effectiveness and hallucination risk.",
      },
      { property: "og:title", content: "Agent Playground" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content:
          "Manual chat or 50-scenario auto-eval for conversational agent prompts.",
      },
    ],
  }),
  component: Playground,
});

type SavedPrompt = {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
  agent_type: string;
  begin_message: string;
  stages: Stage[];
  variables: Record<string, string>;
};

function varsToText(vars: Record<string, string>) {
  return Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

function textToVars(text: string) {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    if (k) out[k] = line.slice(i + 1).trim();
  }
  return out;
}

function Playground() {
  const [name, setName] = useState("Untitled prompt");
  const [beginMessage, setBeginMessage] = useState(DEFAULT_BEGIN_MESSAGE);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
  const [stages, setStages] = useState<Stage[]>([]);
  const [varsText, setVarsText] = useState("lead_name=Priya");
  const [model, setModel] = useState(MODELS[0].value);
  const [agentType, setAgentType] = useState("chat");
  const [promptId, setPromptId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPrompt[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [savedLoadError, setSavedLoadError] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [versionRefreshKey, setVersionRefreshKey] = useState(0);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const variables = textToVars(varsText);
  const currentSignature = JSON.stringify({
    name,
    system_prompt: systemPrompt,
    model,
    agent_type: agentType,
    begin_message: beginMessage,
    stages,
    variables,
  });
  const hasUnsavedChanges = savedSignature !== currentSignature;
  const fetchPrompts = useServerFn(listPrompts);
  const persistPrompt = useServerFn(savePromptFn);

  useEffect(() => {
    void refreshSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshSaved() {
    setLoadingSaved(true);
    try {
      const data = await fetchPrompts();
      setSaved(data as unknown as SavedPrompt[]);
      setSavedLoadError(false);
    } catch {
      setSavedLoadError(true);
    } finally {
      setLoadingSaved(false);
    }
  }

  async function savePrompt() {
    setSaving(true);
    try {
      const res = await persistPrompt({
        data: {
          id: promptId,
          payload: {
            name,
            system_prompt: systemPrompt,
            model,
            agent_type: agentType as "chat" | "voice",
            begin_message: beginMessage,
            stages,
            variables,
          },
        },
      });
      if (res.id) setPromptId(res.id);
      setSavedSignature(currentSignature);
      setVersionRefreshKey((value) => value + 1);
      toast.success(res.versionNumber ? `Saved as version ${res.versionNumber}` : "Saved");
      void refreshSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }


  function restoreSnapshot(snapshot: PromptSnapshot) {
    setName(snapshot.name);
    setSystemPrompt(snapshot.system_prompt);
    setModel(snapshot.model);
    setAgentType(snapshot.agent_type);
    setBeginMessage(snapshot.begin_message ?? "");
    setStages(Array.isArray(snapshot.stages) ? snapshot.stages : []);
    setVarsText(varsToText(snapshot.variables ?? {}));
  }

  function confirmDiscardDraft() {
    const isPristineNewDraft =
      !promptId &&
      name === "Untitled prompt" &&
      beginMessage === DEFAULT_BEGIN_MESSAGE &&
      systemPrompt === DEFAULT_PROMPT &&
      stages.length === 0 &&
      model === MODELS[0].value &&
      agentType === "chat" &&
      varsText === "lead_name=Priya";
    if (!hasUnsavedChanges || isPristineNewDraft) return true;
    return window.confirm("You have unsaved prompt changes. Discard them and continue?");
  }

  function resetToSample() {
    if (!confirmDiscardDraft()) return;
    setName("Untitled prompt");
    setBeginMessage(DEFAULT_BEGIN_MESSAGE);
    setSystemPrompt(DEFAULT_PROMPT);
    setStages([]);
    setModel(MODELS[0].value);
    setAgentType("chat");
    setVarsText("lead_name=Priya");
    setPromptId(null);
    setSavedSignature(null);
  }

  function loadPrompt(id: string) {
    if (id !== (promptId ?? "__new__") && !confirmDiscardDraft()) return;
    if (id === "__new__") {
      setPromptId(null);
      setName("Untitled prompt");
      setSystemPrompt(DEFAULT_PROMPT);
      setBeginMessage(DEFAULT_BEGIN_MESSAGE);
      setStages([]);
      setModel(MODELS[0].value);
      setAgentType("chat");
      setVarsText("lead_name=Priya");
      setSavedSignature(null);
      return;
    }
    const p = saved.find((x) => x.id === id);
    if (!p) return;
    setPromptId(p.id);
    setName(p.name);
    setSystemPrompt(p.system_prompt);
    setModel(p.model);
    setAgentType(p.agent_type);
    setBeginMessage(p.begin_message ?? "");
    setStages(Array.isArray(p.stages) ? p.stages : []);
    setVarsText(varsToText((p.variables ?? {}) as Record<string, string>));
    setSavedSignature(JSON.stringify({
      name: p.name,
      system_prompt: p.system_prompt,
      model: p.model,
      agent_type: p.agent_type,
      begin_message: p.begin_message ?? "",
      stages: Array.isArray(p.stages) ? p.stages : [],
      variables: (p.variables ?? {}) as Record<string, string>,
    }));
  }

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="relative mb-6 flex flex-col gap-4 overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-6 text-white shadow-xl shadow-slate-950/10 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-8">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"><Sparkles className="h-4 w-4" /> Agent workspace <span className="text-slate-600">/</span> Studio 01</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Evaluation studio</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">Configure once, then test conversations, probe failure cases, compare prompt versions, and keep the iterations that improve your agent.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${hasUnsavedChanges ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${hasUnsavedChanges ? "bg-amber-500" : "bg-emerald-500"}`} />
              {!promptId ? "New draft" : hasUnsavedChanges ? "Unsaved changes" : "Saved version"}
            </span>
            <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => setCoachOpen(true)}><Lightbulb className="mr-2 h-4 w-4 text-primary" />Improve prompt</Button>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Cpu className="h-3.5 w-3.5 text-brand" /> Runtime</div>
            <p className="mt-2 text-sm font-semibold tracking-tight">{model.startsWith("ollama/") ? "Local · Ollama" : "Hosted model"}</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{model.startsWith("ollama/") ? "Runs on your machine" : "Uses configured AI gateway"}</p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Activity className="h-3.5 w-3.5 text-brand" /> Prompt size</div>
            <p className="mt-2 text-sm font-semibold tracking-tight">{systemPrompt.length.toLocaleString()} <span className="font-normal text-muted-foreground">chars</span></p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{stages.length} configured stage{stages.length === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"><WandSparkles className="h-3.5 w-3.5 text-brand" /> Agent channel</div>
            <p className="mt-2 text-sm font-semibold tracking-tight">{agentType === "voice" ? "Voice agent" : "Chat agent"}</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Mode follows your configuration</p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Save className="h-3.5 w-3.5 text-brand" /> Prompt library</div>
            <p className="mt-2 text-sm font-semibold tracking-tight">{loadingSaved ? "Syncing…" : savedLoadError ? "Unavailable" : saved.length}</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{savedLoadError ? "Could not load saved prompts" : "Saved prompts in your workspace"}</p>
          </div>
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/5 via-card to-card shadow-sm">
          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold"><WandSparkles className="h-4 w-4 text-brand" /> A simple evaluation loop</p>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Start with the sample prompt, run a few scenarios, inspect what failed, then save a version when you’re ready to keep the change.</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand/10 font-semibold text-brand">1</span> Configure</span>
                <span className="inline-flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand/10 font-semibold text-brand">2</span> Test</span>
                <span className="inline-flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand/10 font-semibold text-brand">3</span> Review & save</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button variant="outline" size="sm" onClick={resetToSample}><Sparkles className="mr-2 h-3.5 w-3.5" />Reset to sample</Button>
              <Button size="sm" onClick={savePrompt} disabled={saving || !name.trim() || !systemPrompt.trim() || !hasUnsavedChanges}><Save className="mr-2 h-3.5 w-3.5" />{saving ? "Saving…" : "Save prompt"}</Button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:gap-6">
        {/* Left: configuration */}
        <Card className="self-start overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/70 bg-muted/20 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Cpu className="h-4 w-4 text-brand" /> Agent configuration</CardTitle>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Set up the prompt and the context used by each test.</p>
              </div>
              <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Step 1</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Saved prompts
              </Label>
              <Select value={promptId ?? "__new__"} onValueChange={loadPrompt}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder={loadingSaved ? "Loading saved prompts…" : "New prompt"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">+ New prompt</SelectItem>
                  {saved.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {savedLoadError && <p role="status" className="text-xs leading-5 text-destructive">Saved prompts could not be loaded. Check your connection, then refresh the page.</p>}
              {!loadingSaved && !savedLoadError && saved.length === 0 && <p className="text-xs leading-5 text-muted-foreground">No saved prompts yet. Save your first setup to find it here later.</p>}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="name"
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Model
                </Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Agent type
                </Label>
                <Select value={agentType} onValueChange={setAgentType}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_TYPES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
              {model.startsWith("ollama/") ? <Cpu className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /> : <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />}
              {model.startsWith("ollama/")
                ? "Local model selected. Text inference is routed to Ollama on the machine running this app and does not incur per-token model API fees."
                : "Hosted model selected. Requests use your configured AI gateway and may consume provider credits. Choose a Local · Ollama model to avoid model API token charges."}
            </p>

            <div className="space-y-1.5">
              <Label
                htmlFor="begin"
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                Begin message
              </Label>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Spoken verbatim when the callee answers — no LLM call.{" "}
                <code className="font-mono">{"{{lead_name}}"}</code>-style variables are substituted
                at call time. Leave empty to have the model open from the system prompt instead.
              </p>
              <Textarea
                id="begin"
                value={beginMessage}
                onChange={(e) => setBeginMessage(e.target.value)}
                placeholder="Hi {{lead_name}}, this is Maya from Acme…"
                className="min-h-[70px] resize-none rounded-xl bg-muted/30 text-xs leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="vars"
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                Variables
              </Label>
              <Textarea
                id="vars"
                value={varsText}
                onChange={(e) => setVarsText(e.target.value)}
                placeholder={"lead_name=Priya\ncompany=Acme"}
                className="min-h-[60px] resize-none rounded-xl bg-muted/30 font-mono text-xs leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground">
                One <code className="font-mono">key=value</code> per line.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="prompt"
                  className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                  System prompt
                </Label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {systemPrompt.length} chars
                </span>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                The base prompt. When stages are configured this is prepended to the active
                stage&apos;s prompt, so only one stage prompt is in context at a time.
              </p>
              <Textarea
                id="prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[260px] resize-none rounded-xl bg-muted/30 font-mono text-xs leading-relaxed"
              />
            </div>

            <StagesEditor stages={stages} onChange={setStages} />

            <Button
              variant="outline"
              onClick={() => setCoachOpen(true)}
              className="h-10 w-full rounded-lg"
            >
              <Lightbulb className="mr-2 h-4 w-4 text-primary" />
              Suggest improvements
            </Button>

            <Button onClick={savePrompt} disabled={saving || !name.trim() || !systemPrompt.trim() || !hasUnsavedChanges} className="h-10 w-full rounded-lg">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Saving…" : promptId ? "Save new version" : "Save prompt"}
            </Button>
            {hasUnsavedChanges && <p className="text-center text-[11px] leading-5 text-muted-foreground">Changes in this editor are a draft until you save them.</p>}
            <PromptVersionHistory
              promptId={promptId}
              refreshToken={versionRefreshKey}
              onRestore={restoreSnapshot}
            />
          </CardContent>
        </Card>

        {/* Right: testing surfaces */}
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand"><Activity className="h-3.5 w-3.5" /> Step 2 · Test & review</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Test your agent</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Choose a test mode. Your current prompt and model selection will carry through.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${hasUnsavedChanges ? "bg-amber-500" : "bg-emerald-500"}`} />{hasUnsavedChanges ? "Draft configuration" : "Saved configuration"}</span>
          </div>
          <Tabs defaultValue="manual">
            <TabsList className="h-auto min-h-10 max-w-full flex-wrap rounded-xl bg-muted/60 p-1">
              <TabsTrigger value="manual" className="rounded-lg px-4 text-xs font-medium">
                Manual testing
              </TabsTrigger>
              <TabsTrigger value="auto" className="rounded-lg px-4 text-xs font-medium">
                Auto-eval
              </TabsTrigger>
              <TabsTrigger value="compare" className="rounded-lg px-3 text-xs font-medium">
                Compare
              </TabsTrigger>
              <TabsTrigger value="export" className="rounded-lg px-3 text-xs font-medium">
                Export
              </TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="mt-4">
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-card/70 p-3 text-xs leading-5 text-muted-foreground"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /><span>Best for quick iteration. Test one turn at a time and refine your instructions before running a larger evaluation. Speech features may use separate speech-provider settings from your selected text model.</span></div>
              <ManualChat
                key={`${promptId ?? "new"}-${model}-${agentType}`}
                systemPrompt={systemPrompt}
                model={model}
                agentType={agentType}
                beginMessage={beginMessage}
                stages={stages}
                variables={variables}
              />
            </TabsContent>
            <TabsContent value="auto" className="mt-4">
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-card/70 p-3 text-xs leading-5 text-muted-foreground"><Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /><span>Start with 5 scenarios to validate the setup. Expand to 10 or 50 when you're ready for broader coverage. Model-based scores are estimates that should be reviewed with the conversation evidence.</span></div>
              <AutoEval
                systemPrompt={
                  stages.length
                    ? [systemPrompt, stages[0].prompt].filter(Boolean).join("\n\n")
                    : systemPrompt
                }
                model={model}
                agentType={agentType}
                promptId={promptId}
                onApplyImprovedPrompt={(s) => setSystemPrompt(s)}
              />
            </TabsContent>
            <TabsContent value="compare" className="mt-4">
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-card/70 p-3 text-xs leading-5 text-muted-foreground"><GitCompareArrows className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /><span>Change one prompt or model at a time where possible. Local comparisons can avoid per-token model API charges by selecting local models for both variants.</span></div>
              <PromptComparison systemPrompt={systemPrompt} model={model} agentType={agentType}
                hasStages={stages.length > 0} onApply={setSystemPrompt} />
            </TabsContent>
            <TabsContent value="export" className="mt-4">
              <VoiceExport input={{ name, systemPrompt, beginMessage, model, agentType, stages, variables }} />
            </TabsContent>
          </Tabs>
        </div>
        </div>
      </main>

      <PromptCoach
        open={coachOpen}
        onOpenChange={setCoachOpen}
        model={model}
        agentType={agentType}
        beginMessage={beginMessage}
        systemPrompt={systemPrompt}
        stages={stages}
        onApplyBeginMessage={setBeginMessage}
        onApplySystemPrompt={setSystemPrompt}
        onApplyStagePrompt={(id, text) =>
          setStages((prev) => prev.map((s) => (s.id === id ? { ...s, prompt: text } : s)))
        }
      />
    </div>
  );
}

