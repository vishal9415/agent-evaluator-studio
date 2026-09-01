import { Plus, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  newId,
  transitionToolName,
  type Stage,
} from "@/lib/playground-constants";

interface Props {
  stages: Stage[];
  onChange: (stages: Stage[]) => void;
}

export function StagesEditor({ stages, onChange }: Props) {
  function addStage() {
    onChange([
      ...stages,
      {
        id: newId(),
        name: `Stage ${stages.length + 1}`,
        prompt: "",
        transitions: [],
      },
    ]);
  }

  function update(id: string, patch: Partial<Stage>) {
    onChange(stages.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStage(id: string) {
    onChange(
      stages
        .filter((s) => s.id !== id)
        .map((s) => ({ ...s, transitions: s.transitions.filter((t) => t.target !== id) })),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Stages
          </Label>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Optional. Each stage is system prompt + this stage&apos;s prompt. A transition becomes a
            tool named <code className="font-mono">move_to_&lt;target&gt;</code> that the model calls
            to hand off — history and models carry over. Remove every stage to fall back to a single
            prompt.
          </p>
        </div>
      </div>

      {stages.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          No stages — the single system prompt is used.
        </div>
      ) : (
        <div className="space-y-3">
          {stages.map((stage, i) => (
            <div key={stage.id} className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                  {i + 1}
                </span>
                <Input
                  value={stage.name}
                  onChange={(e) => update(stage.id, { name: e.target.value })}
                  className="h-8 rounded-md text-xs font-medium"
                  placeholder="Stage name"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={() => removeStage(stage.id)}
                  title="Remove stage"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                tool: {transitionToolName(stage.name)}
              </p>

              <Textarea
                value={stage.prompt}
                onChange={(e) => update(stage.id, { prompt: e.target.value })}
                placeholder="This stage's prompt — the goal, tone and rules while in this stage."
                className="mt-2 min-h-[110px] resize-none rounded-lg bg-background font-mono text-xs leading-relaxed"
              />

              <div className="mt-3 space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Transitions
                </Label>
                {stage.transitions.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    No transitions — this stage is terminal.
                  </p>
                )}
                {stage.transitions.map((t) => (
                  <div key={t.id} className="rounded-lg border bg-background p-2">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <Select
                        value={t.target}
                        onValueChange={(v) =>
                          update(stage.id, {
                            transitions: stage.transitions.map((x) =>
                              x.id === t.id ? { ...x, target: v } : x,
                            ),
                          })
                        }
                      >
                        <SelectTrigger className="h-8 rounded-md text-xs">
                          <SelectValue placeholder="Target stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {stages
                            .filter((s) => s.id !== stage.id)
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground"
                        onClick={() =>
                          update(stage.id, {
                            transitions: stage.transitions.filter((x) => x.id !== t.id),
                          })
                        }
                        title="Remove transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      value={t.condition}
                      onChange={(e) =>
                        update(stage.id, {
                          transitions: stage.transitions.map((x) =>
                            x.id === t.id ? { ...x, condition: e.target.value } : x,
                          ),
                        })
                      }
                      placeholder="Trigger — e.g. the caller confirms interest and shares a budget"
                      className="mt-2 min-h-[52px] resize-none rounded-md text-xs"
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full rounded-md text-xs"
                  disabled={stages.length < 2}
                  onClick={() =>
                    update(stage.id, {
                      transitions: [
                        ...stage.transitions,
                        {
                          id: newId(),
                          target: stages.find((s) => s.id !== stage.id)?.id ?? "",
                          condition: "",
                        },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add transition
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" className="h-9 w-full rounded-lg" onClick={addStage}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add stage
      </Button>
    </div>
  );
}
