import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { coachClarify, coachSuggest } from "@/lib/playground.functions";
import type { Stage } from "@/lib/playground-constants";

type Question = { id: string; question: string; why: string; suggested_answer: string };

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
  const [step, setStep] = useState<"intake" | "review">("intake");
  const [goal, setGoal] = useState("");
  const [inferredGoal, setInferredGoal] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [goalUnderstanding, setGoalUnderstanding] = useState("");
  const [overallNotes, setOverallNotes] = useState<string[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  const clarify = useServerFn(coachClarify);
  const suggest = useServerFn(coachSuggest);

  const payload = {
    model,
    agentType,
    beginMessage,
    systemPrompt,
    stages: stages.map((s) => ({ id: s.id, name: s.name, prompt: s.prompt })),
  };

  async function loadQuestions() {
    setLoadingQuestions(true);
    try {
      const res = await clarify({ data: payload });
      setInferredGoal(res.inferredGoal);
      setQuestions(res.questions);
      setAnswers(Object.fromEntries(res.questions.map((q) => [q.id, ""])));
      if (!goal && res.inferredGoal) setGoal(res.inferredGoal);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load questions");
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function getSuggestions() {
    if (!goal.trim()) {
      toast.error("Describe what you want the agent to achieve first");
      return;
    }
    setLoadingSuggestions(true);
    try {
      const res = await suggest({
        data: {
          ...payload,
          goal,
          answers: questions.map((q) => ({
            question: q.question,
            answer: answers[q.id] ?? "",
          })),
        },
      });
      setGoalUnderstanding(res.goalUnderstanding);
      setOverallNotes(res.overallNotes);
      setSections(res.sections);
      setApplied({});
      setStep("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function applySection(s: Section) {
    if (!s.rewritten.trim()) return;
    if (s.key === "begin_message") onApplyBeginMessage(s.rewritten);
    else if (s.key === "system_prompt") onApplySystemPrompt(s.rewritten);
    else if (s.key.startsWith("stage:")) onApplyStagePrompt(s.key.slice(6), s.rewritten);
    else return;
    setApplied((p) => ({ ...p, [s.key]: true }));
    toast.success(`Applied to ${s.label}`);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-primary" />
            Prompt Coach
          </SheetTitle>
          <SheetDescription className="text-xs">
            {step === "intake"
              ? "First tell the coach what you're trying to achieve — suggestions never contradict your goal."
              : "Section-by-section suggestions, aligned with your stated goal."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 p-6">
            {step === "intake" ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    What should this agent achieve?
                  </Label>
                  <Textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="e.g. Qualify inbound SaaS leads on a voice call, book a demo, never quote pricing."
                    className="min-h-[100px] resize-none rounded-xl bg-muted/30 text-xs leading-relaxed"
                  />
                </div>

                {inferredGoal ? (
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Target className="h-3 w-3" /> Coach&apos;s reading of your prompt
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed">{inferredGoal}</p>
                  </div>
                ) : null}

                {questions.length === 0 ? (
                  <Button
                    variant="secondary"
                    onClick={loadQuestions}
                    disabled={loadingQuestions}
                    className="h-10 w-full rounded-lg"
                  >
                    {loadingQuestions ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Let the coach ask about my use case
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Clarifying questions
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadQuestions}
                        disabled={loadingQuestions}
                        className="h-7 px-2 text-xs"
                      >
                        <RefreshCw
                          className={`mr-1 h-3 w-3 ${loadingQuestions ? "animate-spin" : ""}`}
                        />
                        Redo
                      </Button>
                    </div>
                    {questions.map((q) => (
                      <div key={q.id} className="space-y-1.5">
                        <Label className="text-xs font-medium leading-snug">{q.question}</Label>
                        <p className="text-[10px] leading-relaxed text-muted-foreground">{q.why}</p>
                        <Textarea
                          value={answers[q.id] ?? ""}
                          onChange={(e) =>
                            setAnswers((p) => ({ ...p, [q.id]: e.target.value }))
                          }
                          placeholder={q.suggested_answer}
                          className="min-h-[60px] resize-none rounded-xl bg-muted/30 text-xs leading-relaxed"
                        />
                        {q.suggested_answer ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() =>
                              setAnswers((p) => ({ ...p, [q.id]: q.suggested_answer }))
                            }
                          >
                            Use suggested answer
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {goalUnderstanding ? (
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Target className="h-3 w-3" /> Goal the coach optimised for
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
                        <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-mono text-[10px] leading-relaxed">
                          {s.rewritten}
                        </pre>
                        <Button
                          size="sm"
                          variant={applied[s.key] ? "secondary" : "default"}
                          className="mt-2 h-8 rounded-lg text-xs"
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
                      </>
                    ) : null}
                  </div>
                ))}
              </>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center gap-2 border-t px-6 py-4">
          {step === "intake" ? (
            <Button
              onClick={getSuggestions}
              disabled={loadingSuggestions}
              className="h-10 flex-1 rounded-lg"
            >
              {loadingSuggestions ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Get goal-aligned suggestions
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("intake")}
                className="h-10 rounded-lg"
              >
                Edit goal
              </Button>
              <Button
                onClick={getSuggestions}
                disabled={loadingSuggestions}
                className="h-10 flex-1 rounded-lg"
              >
                {loadingSuggestions ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Re-analyse
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
