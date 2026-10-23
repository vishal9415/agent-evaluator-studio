import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, Clock3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteVoiceSession, getVoiceSessionEvents, listVoiceSessions } from "@/lib/voice-session.functions";

type SessionRow = {
  id: string;
  provider: string;
  status: string;
  model: string;
  voice: string;
  started_at: string;
  connected_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  end_reason: string | null;
  created_at: string;
};
type EventRow = {
  id: string;
  event_type: string;
  source: string;
  client_elapsed_ms: number | null;
  measurement_status: string;
  received_at: string;
};

function statusVariant(status: string) {
  if (status === "ended") return "secondary" as const;
  if (status === "active") return "default" as const;
  if (status === "error" || status === "cancelled") return "destructive" as const;
  return "outline" as const;
}

export function VoiceSessionHistory({ refreshToken }: { refreshToken: number }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [events, setEvents] = useState<Record<string, EventRow[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const list = useServerFn(listVoiceSessions);
  const getEvents = useServerFn(getVoiceSessionEvents);
  const remove = useServerFn(deleteVoiceSession);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await list();
      setSessions(rows as unknown as SessionRow[]);
    } catch {
      toast.error("Could not load voice session history.");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshToken]);

  async function toggleDetails(sessionId: string) {
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    setExpanded(sessionId);
    try {
      const rows = await getEvents({ data: { sessionId } });
      setEvents((previous) => ({ ...previous, [sessionId]: rows as unknown as EventRow[] }));
    } catch {
      toast.error("Could not load this session's event timeline.");
    }
  }

  async function deleteSession(session: SessionRow) {
    const ok = window.confirm("Delete this session's metadata and event timeline? This cannot be undone.");
    if (!ok) return;
    try {
      await remove({ data: { sessionId: session.id } });
      setEvents((previous) => {
        const next = { ...previous };
        delete next[session.id];
        return next;
      });
      if (expanded === session.id) setExpanded(null);
      toast.success("Voice session history deleted.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this session.");
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4" /> Recent voice sessions</CardTitle>
        <CardDescription className="text-xs">
          The history stores session metadata and event timings only. Raw audio and transcript text are not persisted. Delete records whenever you no longer need them; automatic expiry is not configured yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading session history…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No live voice sessions have been recorded yet.</p>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="rounded-lg border border-border/70">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
                    <span className="text-sm font-medium">{session.model}</span>
                    <span className="text-xs text-muted-foreground">Voice: {session.voice}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(session.started_at).toLocaleString()}
                    {session.duration_seconds !== null ? ` · ${session.duration_seconds}s observed` : " · Duration not finalized"}
                  </p>
                  {session.end_reason && <p className="text-xs text-muted-foreground">End reason: {session.end_reason.replaceAll("_", " ")}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => void toggleDetails(session.id)}>
                    {expanded === session.id ? <ChevronUp className="mr-1.5 h-3.5 w-3.5" /> : <ChevronDown className="mr-1.5 h-3.5 w-3.5" />}
                    Events
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete voice session history"
                    title={session.ended_at ? "Delete session history" : "End this session before deleting its history"}
                    disabled={!session.ended_at}
                    onClick={() => void deleteSession(session)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {expanded === session.id && (
                <div className="border-t border-border/70 p-3">
                  {(events[session.id] ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No persisted events for this session.</p>
                  ) : (
                    <div className="max-h-72 space-y-2 overflow-auto">
                      {events[session.id].map((event) => (
                        <div key={event.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border/50 pb-2 text-xs last:border-0">
                          <div className="min-w-0">
                            <p className="break-all font-medium">{event.event_type}</p>
                            <p className="text-muted-foreground">{event.source} · {event.measurement_status}</p>
                          </div>
                          <div className="text-right">
                            {event.client_elapsed_ms !== null && <p className="font-mono tabular-nums">+{event.client_elapsed_ms} ms</p>}
                            <p className="text-muted-foreground">{new Date(event.received_at).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-[11px] text-muted-foreground">Times labelled “client elapsed” originate from the browser monotonic clock. Server “received at” timestamps mark when the event metadata reached PromptLab, not when the provider internally generated it.</p>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
