import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Coins, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getVoiceUsageSummary, grantVoiceTestCredits } from "@/lib/voice-session.functions";

type Usage = {
  availableSeconds: number;
  reservedSeconds: number;
  grantedSeconds: number;
  usedSeconds: number;
  isAdmin: boolean;
};

function duration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remaining}s`;
  return `${remaining}s`;
}

export function VoiceUsagePanel({ refreshToken }: { refreshToken: number }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);
  const [granting, setGranting] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [minutes, setMinutes] = useState("10");
  const [reason, setReason] = useState("PromptLab MVP pilot allowance");
  const loadUsage = useServerFn(getVoiceUsageSummary);
  const grantCredits = useServerFn(grantVoiceTestCredits);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadUsage();
      setUsage(result as Usage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load usage allowance.");
    } finally {
      setLoading(false);
    }
  }, [loadUsage]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled && data.user && !targetUserId) setTargetUserId(data.user.id);
      } catch {
        // The authenticated parent route normally guarantees a valid session.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshToken]);

  async function grant() {
    const parsedMinutes = Number(minutes);
    if (!Number.isInteger(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 1440) {
      toast.error("Enter a duration between 1 minute and 24 hours.");
      return;
    }
    if (!targetUserId.trim()) {
      toast.error("Enter the target user's Supabase auth UUID.");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Enter an audit reason of at least 3 characters.");
      return;
    }

    setGranting(true);
    try {
      const result = await grantCredits({
        data: {
          targetUserId: targetUserId.trim(),
          amountSeconds: parsedMinutes * 60,
          reason: reason.trim(),
          requestId: crypto.randomUUID(),
        },
      });
      toast.success(`Granted ${duration(result.grantedSeconds)} to ${result.grantedToUserId.slice(0, 8)}…`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not grant test allowance.");
    } finally {
      setGranting(false);
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Coins className="h-4 w-4" />
          Pilot usage allowance
        </CardTitle>
        <CardDescription className="text-xs">
          Credits are internal test-seconds used to bound PromptLab sessions. They are not dollars or an estimate of provider spend. OpenAI bills your OpenAI account separately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh usage
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Available", value: usage ? duration(usage.availableSeconds) : "—" },
            { label: "Reserved", value: usage ? duration(usage.reservedSeconds) : "—" },
            { label: "Used", value: usage ? duration(usage.usedSeconds) : "—" },
            { label: "Granted", value: usage ? duration(usage.grantedSeconds) : "—" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
        {usage && usage.availableSeconds < 600 && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
            Less than ten minutes are available. A new live session reserves up to ten minutes before connecting.
          </p>
        )}
        {!usage && !loading && (
          <p role="status" className="text-sm text-muted-foreground">Usage summary is not available. Apply the included Supabase migrations, then refresh.</p>
        )}
        {usage?.isAdmin && (
          <div className="space-y-3 rounded-lg border border-border/70 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4" />
              Admin: grant pilot test-seconds
            </p>
            <p className="text-xs text-muted-foreground">
              Only user IDs listed in the server-side PROMPTLAB_ADMIN_USER_IDS allowlist can grant. Each grant records an actor, idempotency key and reason.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="usage-target-user" className="text-xs">Target user's Supabase auth UUID</Label>
              <Input id="usage-target-user" value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} placeholder="UUID from Supabase Auth" maxLength={36} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="usage-grant-minutes" className="text-xs">Minutes (1–1440)</Label>
                <Input id="usage-grant-minutes" inputMode="numeric" type="number" min={1} max={1440} value={minutes} onChange={(event) => setMinutes(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="usage-grant-reason" className="text-xs">Audit reason</Label>
                <Input id="usage-grant-reason" value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} />
              </div>
            </div>
            <Button onClick={() => void grant()} disabled={granting || loading || !targetUserId.trim()}>
              {granting ? "Granting…" : "Grant test allowance"}
            </Button>
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Session reconciliation uses server-recorded duration, rounded up to seconds. If provider hangup cannot be confirmed, the full ten-minute test allowance is conservatively consumed. Usage refresh attempts to recover sessions older than 12 minutes, but there is no scheduled background watchdog. Test-seconds are not OpenAI dollar costs.
        </p>
      </CardContent>
    </Card>
  );
}
