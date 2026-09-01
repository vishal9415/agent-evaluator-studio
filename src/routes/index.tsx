import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Save, Sparkles } from "lucide-react";
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
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agent Playground — Test conversational prompts" },
      {
        name: "description",
        content:
          "Test conversational agent prompts manually or auto-evaluate against 50 generated scenarios to measure effectiveness and hallucination risk.",
      },
      { property: "og:title", content: "Agent Playground" },
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
};

function Playground() {
  const [name, setName] = useState("Untitled prompt");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
  const [model, setModel] = useState(MODELS[0].value);
  const [agentType, setAgentType] = useState("chat");
  const [promptId, setPromptId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPrompt[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refreshSaved();
  }, []);

  async function refreshSaved() {
    const { data } = await supabase
      .from("prompts")
      .select("id, name, system_prompt, model, agent_type")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (data) setSaved(data as SavedPrompt[]);
  }

  async function savePrompt() {
    setSaving(true);
    try {
      if (promptId) {
        const { error } = await supabase
          .from("prompts")
          .update({
            name,
            system_prompt: systemPrompt,
            model,
            agent_type: agentType,
            updated_at: new Date().toISOString(),
          })
          .eq("id", promptId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("prompts")
          .insert({ name, system_prompt: systemPrompt, model, agent_type: agentType })
          .select()
          .single();
        if (error) throw error;
        if (data) setPromptId(data.id);
      }
      toast.success("Saved");
      void refreshSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function loadPrompt(id: string) {
    if (id === "__new__") {
      setPromptId(null);
      setName("Untitled prompt");
      setSystemPrompt(DEFAULT_PROMPT);
      return;
    }
    const p = saved.find((x) => x.id === id);
    if (!p) return;
    setPromptId(p.id);
    setName(p.name);
    setSystemPrompt(p.system_prompt);
    setModel(p.model);
    setAgentType(p.agent_type);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight tracking-tight">
                Agent Playground
              </h1>
              <p className="text-xs text-muted-foreground">
                Test conversational prompts — manually or with auto-generated scenarios
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Ready
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-6 lg:grid-cols-[440px_1fr]">
        {/* Left: configuration */}
        <Card className="self-start border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Saved prompts
              </Label>
              <Select value={promptId ?? "__new__"} onValueChange={loadPrompt}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="New prompt" />
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
              <Textarea
                id="prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[300px] resize-none rounded-xl bg-muted/30 font-mono text-xs leading-relaxed"
              />
            </div>

            <Button onClick={savePrompt} disabled={saving} className="h-10 w-full rounded-lg">
              <Save className="mr-2 h-4 w-4" />
              {promptId ? "Update prompt" : "Save prompt"}
            </Button>
          </CardContent>
        </Card>

        {/* Right: testing surfaces */}
        <div>
          <Tabs defaultValue="manual">
            <TabsList className="h-10 rounded-xl bg-muted/60 p-1">
              <TabsTrigger value="manual" className="rounded-lg px-4 text-xs font-medium">
                Manual testing
              </TabsTrigger>
              <TabsTrigger value="auto" className="rounded-lg px-4 text-xs font-medium">
                Auto-eval
              </TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="mt-4">
              <ManualChat
                key={`${promptId ?? "new"}-${model}-${agentType}`}
                systemPrompt={systemPrompt}
                model={model}
                agentType={agentType}
              />
            </TabsContent>
            <TabsContent value="auto" className="mt-4">
              <AutoEval
                systemPrompt={systemPrompt}
                model={model}
                agentType={agentType}
                promptId={promptId}
                onApplyImprovedPrompt={(s) => setSystemPrompt(s)}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

