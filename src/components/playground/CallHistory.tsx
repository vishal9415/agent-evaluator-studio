import { useState } from "react";
import { ChevronDown, ChevronRight, History, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDuration, type CallRecord } from "@/lib/call-history";
import { cn } from "@/lib/utils";

type Props = {
  calls: CallRecord[];
  activeId: string | null;
  onClear: () => void;
};

const KIND_LABEL: Record<string, string> = {
  user: "Caller",
  agent: "Agent",
  stage: "Stage",
  system: "System",
};

function time(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function CallHistory({ calls, activeId, onClear }: Props) {
  const [openId, setOpenId] = useState<string | null>(activeId);

  return (
    <div className="mt-4 rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <History className="h-3.5 w-3.5 text-primary" />
          Live call history
          <Badge variant="outline" className="ml-1 text-[10px]">
            {calls.length}
          </Badge>
        </div>
        {calls.length ? (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
            <Trash2 className="mr-1.5 h-3 w-3" />
            Clear
          </Button>
        ) : null}
      </div>

      {calls.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          No calls yet — start a call or send a message and every turn is logged here as it happens.
        </p>
      ) : (
        <ScrollArea className="max-h-[320px]">
          <div className="divide-y">
            {calls.map((c) => {
              const isOpen = openId === c.id;
              const live = !c.endedAt;
              const ended = c.endedAt ?? Date.now();
              return (
                <div key={c.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : c.id)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/40"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <Phone
                      className={cn("h-3.5 w-3.5", live ? "text-emerald-500" : "text-muted-foreground")}
                    />
                    <span className="text-xs font-medium">
                      {c.mode === "voice" ? "Voice call" : "Chat session"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{time(c.startedAt)}</span>
                    <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
                      {c.events.filter((e) => e.kind === "user" || e.kind === "agent").length} turns
                      <span>{formatDuration(ended - c.startedAt)}</span>
                      {live ? (
                        <span className="flex items-center gap-1 font-medium text-emerald-600">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                          live
                        </span>
                      ) : null}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="space-y-2 bg-muted/20 px-4 py-3">
                      {c.events.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">No turns recorded yet.</p>
                      ) : (
                        c.events.map((e, i) => (
                          <div key={i} className="flex gap-2 text-[11px] leading-relaxed">
                            <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">
                              {time(e.at)}
                            </span>
                            <span
                              className={cn(
                                "w-14 shrink-0 font-semibold",
                                e.kind === "user"
                                  ? "text-primary"
                                  : e.kind === "agent"
                                    ? "text-foreground"
                                    : "text-amber-600",
                              )}
                            >
                              {KIND_LABEL[e.kind] ?? e.kind}
                            </span>
                            <span className="flex-1 whitespace-pre-wrap">{e.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
