import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Copy,
  Lightbulb,
  Loader2,
  RefreshCw,
  Target,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { coachSuggest } from "@/lib/playground.functions";
import type { Stage } from "@/lib/playground-constants";

type Section = {
  key: string;
  label: string;
  verdict: string;
  issues: string[];
  suggestions: Array<{ change: string; why: string; goal_alignment: string }>;
  rewritten: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: string;
  agentType: string;
  beginMessage: string;
  systemPrompt: string;
  stages: Stage[];
  onApplyBeginMessage: (text: string) => void;
  onApplySystemPrompt: (text: string) => void;
  onApplyStagePrompt: (stageId: string, text: string) => void;
};

export function PromptCoach({
  open,
  onOpenChange,
  model,
  agentType,
  beginMessage,
  systemPrompt,
  stages,
  onApplyBeginMessage,
  onApplySystemPrompt,
  onApplyStagePrompt,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [goalUnderstanding, setGoalUnderstanding] = useState("");
  const [overallNotes, setOverallNotes] = useState<string[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const suggest = useServerFn(coachSuggest);

  const analyse = useCallback(async () => {
    setLoading(true);
    try {
      const res = await suggest({
        data: {
          model,
          agentType,
          beginMessage,
          systemPrompt,
          stages: stages.map((s) => ({
            id: s.id,
            name: s.name,
            prompt: s.prompt,
            transitions: (s.transitions ?? []).map((t) => ({
              target: t.target,
              condition: t.condition,
            })),
          })),
        },
      });
      setGoalUnderstanding(res.goalUnderstanding);
      setOverallNotes(res.overallNotes);
      setSections(res.sections);
      setApplied({});
      setCopied({});
      setRan(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not analyse the prompt");
    } finally {
      setLoading(false);
    }
  }, [suggest, model, agentType, beginMessage, systemPrompt, stages]);

  useEffect(() => {
    if (open && !ran && !loading) void analyse();
  }, [open, ran, loading, analyse]);

  function applySection(s: Section) {
    if (!s.rewritten.trim()) return;
    if (s.key === "begin_message") onApplyBeginMessage(s.rewritten);
    else if (s.key === "system_prompt") onApplySystemPrompt(s.rewritten);
    else if (s.key.startsWith("stage:")) onApplyStagePrompt(s.key.slice(6), s.rewritten);
    else return;
    setApplied((p) => ({ ...p, [s.key]: true }));
    toast.success(`Applied to ${s.label}`);
  }

  async function copySection(s: Section) {
    try {
      await navigator.clipboard.writeText(s.rewritten);
      setCopied((p) => ({ ...p, [s.key]: true }));
      toast.success(`Copied ${s.label} rewrite`);
      setTimeout(() => setCopied((p) => ({ ...p, [s.key]: false })), 2000);
    } catch {
      toast.error("Clipboard unavailable — select the text and copy manually");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-primary" />
            Prompt Coach
          </SheetTitle>
          <SheetDescription className="text-xs">
            Reads your begin message, system prompt and every stage (including transitions), infers
            what the agent is meant to do, then suggests aligned improvements you can copy or apply.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 p-6">
            {loading && !sections.length ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">
                  Reading your prompt and stage flow…
                </p>
              </div>
            ) : null}

            {goalUnderstanding ? (
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Target className="h-3 w-3" /> What the coach understands your agent should do
                </p>
                <p className="mt-1.5 text-xs leading-relaxed">{goalUnderstanding}</p>
              </div>
            ) : null}

            {overallNotes.length ? (
              <ul className="space-y-1.5">
                {overallNotes.map((n, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    {n}
                  </li>
                ))}
              </ul>
            ) : null}

            {sections.map((s) => (
              <div key={s.key} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold">{s.label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {s.verdict}
                    </p>
                  </div>
                  <Badge variant={s.suggestions.length ? "secondary" : "outline"}>
                    {s.suggestions.length ? `${s.suggestions.length} tips` : "Looks good"}
                  </Badge>
                </div>

                {s.issues.length ? (
                  <div className="mt-3 space-y-1.5">
                    {s.issues.map((it, i) => (
                      <p key={i} className="flex gap-2 text-[11px] leading-relaxed">
                        <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                        {it}
                      </p>
                    ))}
                  </div>
                ) : null}

                {s.suggestions.length ? (
                  <>
                    <Separator className="my-3" />
                    <div className="space-y-3">
                      {s.suggestions.map((sg, i) => (
                        <div key={i} className="space-y-1">
                          <p className="text-[11px] font-medium leading-relaxed">{sg.change}</p>
                          <p className="text-[10px] leading-relaxed text-muted-foreground">
                            {sg.why}
                          </p>
                          <p className="text-[10px] leading-relaxed text-primary">
                            Serves your goal: {sg.goal_alignment}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}

                {s.rewritten.trim() ? (
                  <>
                    <Separator className="my-3" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Suggested rewrite
                    </p>
                    <pre className="mt-1.5 max-h-56 select-text overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-mono text-[10px] leading-relaxed">
                      {s.rewritten}
                    </pre>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={applied[s.key] ? "secondary" : "default"}
                        className="h-8 rounded-lg text-xs"
                        onClick={() => applySection(s)}
                      >
                        {applied[s.key] ? (
                          <>
                            <Check className="mr-1.5 h-3 w-3" /> Applied
                          </>
                        ) : (
                          "Apply to prompt"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => copySection(s)}
                      >
                        {copied[s.key] ? (
                          <>
                            <Check className="mr-1.5 h-3 w-3" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1.5 h-3 w-3" /> Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center gap-2 border-t px-6 py-4">
          <Button
            onClick={analyse}
            disabled={loading}
            variant="outline"
            className="h-10 flex-1 rounded-lg"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Re-analyse
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
