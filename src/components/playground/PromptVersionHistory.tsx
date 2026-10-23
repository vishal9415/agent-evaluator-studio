import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPromptVersions } from "@/lib/playground-data.functions";
import type { Stage } from "@/lib/playground-constants";

export type PromptSnapshot = {
  name: string;
  system_prompt: string;
  model: string;
  agent_type: "chat" | "voice";
  begin_message: string;
  stages: Stage[];
  variables: Record<string, string>;
};

type VersionRow = {
  id: string;
  version_number: number;
  created_at: string;
  change_note: string | null;
  snapshot: unknown;
};

type Props = {
  promptId: string | null;
  refreshToken: number;
  onRestore: (snapshot: PromptSnapshot) => void;
};

export function PromptVersionHistory({ promptId, refreshToken, onRestore }: Props) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const loadVersions = useServerFn(listPromptVersions);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!promptId) {
        setVersions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const rows = await loadVersions({ data: { promptId } });
        if (!cancelled) setVersions(rows as unknown as VersionRow[]);
      } catch {
        if (!cancelled) toast.error("Could not load prompt version history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [promptId, refreshToken, loadVersions]);

  function restore(version: VersionRow) {
    const snapshot = version.snapshot as PromptSnapshot;
    if (
      !snapshot ||
      typeof snapshot.name !== "string" ||
      typeof snapshot.system_prompt !== "string" ||
      typeof snapshot.model !== "string" ||
      !["chat", "voice"].includes(snapshot.agent_type) ||
      !Array.isArray(snapshot.stages) ||
      typeof snapshot.variables !== "object" ||
      snapshot.variables === null
    ) {
      toast.error("This saved version is invalid and cannot be restored.");
      return;
    }
    onRestore(snapshot);
    toast.success(`Loaded version ${version.version_number}. Save to create a new version from it.`);
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4" />
          Version history
        </CardTitle>
        <CardDescription className="text-xs">
          Each meaningful save records an immutable configuration snapshot. Restoring a version only loads it into the editor; it does not overwrite history until you save.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!promptId ? (
          <p className="text-xs text-muted-foreground">Save this prompt to start its version history.</p>
        ) : loading ? (
          <p className="text-xs text-muted-foreground">Loading versions…</p>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No version snapshots are available for this prompt yet.</p>
        ) : (
          <div className="space-y-2">
            {versions.map((version) => (
              <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">v{version.version_number}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(version.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{version.change_note || "Saved configuration"}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => restore(version)}>
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Load version
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
