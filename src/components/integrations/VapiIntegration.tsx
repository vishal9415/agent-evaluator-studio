import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertCircle,
  Check,
  CircleHelp,
  Clipboard,
  Clock3,
  ExternalLink,
  FileText,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Plug,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Webhook,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  configureVapiIntegration,
  getVapiIntegrationOverview,
} from "@/lib/vapi-integration.functions";

type Overview = Awaited<ReturnType<typeof getVapiIntegrationOverview>>;
type Integration = NonNullable<Overview["integration"]>;
type ImportedCall = Overview["calls"][number];

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function durationLabel(seconds: number | null) {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes ? minutes + "m " + remaining + "s" : remaining + "s";
}

function StatusPill({ status }: { status: "pending" | "active" }) {
  const active = status === "active";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />
      {active ? "Receiving events" : "Waiting for first event"}
    </span>
  );
}

export function VapiIntegration() {
  const loadOverview = useServerFn(getVapiIntegrationOverview);
  const saveIntegration = useServerFn(configureVapiIntegration);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [calls, setCalls] = useState<Overview["calls"]>([]);
  const [origin, setOrigin] = useState("");
  const [storeTranscripts, setStoreTranscripts] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const webhookUrl = origin ? origin + "/api/vapi-webhook" : "";

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const result = await loadOverview();
      setIntegration(result.integration);
      setCalls(result.calls);
      setStoreTranscripts(Boolean(result.integration?.storeTranscripts));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load integrations.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    void refresh();
    // Load once on page mount; explicit refresh is handled by the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save({ rotateSecret }: { rotateSecret: boolean }) {
    setSaving(true);
    setError("");
    try {
      const result = await saveIntegration({
        data: { storeTranscripts, rotateSecret },
      });
      setIntegration(result.integration);
      setWebhookSecret(result.webhookSecret);
      if (rotateSecret) {
        if (result.webhookSecret) {
          toast.success(integration ? "Webhook secret rotated. Update it in Vapi." : "Vapi connection created.");
        }
      } else {
        toast.success("Integration preferences saved.");
      }
      await refresh();
      // A generated secret is deliberately shown only in this page state. Keep
      // it after refresh; it cannot be retrieved from the one-way hash in DB.
      setWebhookSecret(result.webhookSecret);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not save the Vapi integration.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label + " copied");
    } catch {
      toast.error("Clipboard access was blocked. Select and copy the value manually.");
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="relative isolate overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-7 text-white shadow-xl shadow-slate-950/10 sm:px-8 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              <Plug className="h-4 w-4" /> Provider integrations <span className="text-slate-600">/</span> Pilot
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Connect your live voice agent</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
              Send completed-call reports from an existing Vapi assistant into PromptLab. Your agent keeps running in Vapi; PromptLab receives the configured webhook events and builds a call history for quality review.
            </p>
          </div>
          <a href="https://docs.vapi.ai/server-url/setting-server-urls" target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10">
            Vapi setup guide <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="relative mt-7 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Connect", detail: "Add a signed webhook", icon: Link2 },
            { label: "Collect", detail: "Import completed calls", icon: Webhook },
            { label: "Review", detail: "Inspect outcomes and timing", icon: Activity },
          ].map(({ label, detail, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200"><Icon className="h-4 w-4" /></span>
              <span><span className="block text-sm font-medium">{label}</span><span className="mt-0.5 block text-xs text-slate-400">{detail}</span></span>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">{error}</div>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>Retry</Button>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300">V</span> Vapi connection</CardTitle>
                <CardDescription className="mt-2">Connect an assistant you already use in production. PromptLab will not create or change your calls.</CardDescription>
              </div>
              {integration ? <StatusPill status={integration.status} /> : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Not connected
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {loading && !integration ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading integration settings…</div>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-muted/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Webhook endpoint</p>
                  <div className="mt-2 flex items-start gap-2">
                    <code className="min-w-0 flex-1 break-all text-xs leading-5">{webhookUrl || "Preparing endpoint…"}</code>
                    <Button variant="outline" size="icon" aria-label="Copy webhook URL" disabled={!webhookUrl} onClick={() => void copyValue(webhookUrl, "Webhook URL")}><Clipboard className="h-4 w-4" /></Button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Use the endpoint from the same deployed environment you intend to monitor. Before using production calls, publish this version and copy the production URL from the published app.</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Call-content retention</p>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3.5">
                    <Checkbox
                      checked={storeTranscripts}
                      onCheckedChange={(checked) => setStoreTranscripts(checked === true)}
                      disabled={saving}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">Store transcripts and summaries</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">Off by default. When enabled, completed-call transcript text, summary and selected analysis fields are retained for review. Caller names/phone numbers and recording URLs are not copied into PromptLab's call table.</span>
                    </span>
                  </label>
                  {integration && (
                    <Button variant="outline" size="sm" onClick={() => void save({ rotateSecret: false })} disabled={saving || storeTranscripts === integration.storeTranscripts}>
                      {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Save retention setting
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!integration ? (
                    <Button onClick={() => void save({ rotateSecret: true })} disabled={saving}>
                      {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
                      Create Vapi connection
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => void save({ rotateSecret: true })} disabled={saving}>
                      {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
                      Rotate webhook secret
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => void refresh()} disabled={loading || saving}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh status
                  </Button>
                </div>

                {webhookSecret && (
                  <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4">
                    <div className="flex items-start gap-2">
                      <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                      <div>
                        <p className="text-sm font-semibold">Copy this secret now</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">PromptLab stores only a one-way hash. The raw secret cannot be shown again after you leave or reload this page. If lost, rotate it and update Vapi's header.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <code className="min-w-0 flex-1 break-all rounded-lg border border-border bg-background p-3 text-xs leading-5">{webhookSecret}</code>
                      <Button variant="outline" size="icon" aria-label="Copy webhook secret" onClick={() => void copyValue(webhookSecret, "Webhook secret")}><Clipboard className="h-4 w-4" /></Button>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-semibold">Header to configure in Vapi</p>
                      <p className="mt-1 text-xs text-muted-foreground">Name: <code>X-PromptLab-Secret</code></p>
                      <p className="mt-1 text-xs text-muted-foreground">Value: paste the secret displayed above.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Setup checklist</CardTitle>
            <CardDescription>Do this once for the assistant whose calls you want to analyze.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { number: "01", title: "Create the connection", description: "Generate the endpoint and secret in PromptLab." },
              { number: "02", title: "Open Vapi", description: "In Vapi Dashboard, open Assistants and select your existing assistant." },
              { number: "03", title: "Set the server URL", description: "Open Advanced → Webhook Server. Paste the PromptLab endpoint and add the X-PromptLab-Secret HTTP header." },
              { number: "04", title: "Enable completed-call reports", description: "In Server Messages, enable end-of-call-report, then publish the assistant configuration." },
              { number: "05", title: "Place a test call", description: "After the call ends, return here and refresh status. A valid incoming event changes the connection to Receiving events." },
            ].map((item) => (
              <div key={item.number} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 font-mono text-[10px] font-semibold text-muted-foreground">{item.number}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] p-3.5">
              <p className="flex items-center gap-2 text-xs font-semibold"><CircleHelp className="h-4 w-4 text-sky-700 dark:text-sky-300" /> What this MVP receives</p>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Completed-call metadata, duration, call cost when supplied, end reason, and—only if retention is enabled—transcripts and selected analysis fields. It does not mirror audio, control in-progress calls, or automatically modify the assistant prompt.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-brand" /> Recent calls</CardTitle>
            <CardDescription className="mt-1">Imported from Vapi end-of-call reports. Duplicate delivery updates the same call instead of creating another row.</CardDescription>
          </div>
          <span className="shrink-0 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">{calls.length} shown</span>
        </CardHeader>
        <CardContent>
          {!integration ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Webhook className="mx-auto h-8 w-8 text-muted-foreground/70" />
              <p className="mt-3 text-sm font-medium">Connect Vapi to import calls</p>
              <p className="mt-1 text-xs text-muted-foreground">Your existing production calls will appear here after webhook delivery is configured.</p>
            </div>
          ) : loading && calls.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading calls…</div>
          ) : calls.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Clock3 className="mx-auto h-8 w-8 text-muted-foreground/70" />
              <p className="mt-3 text-sm font-medium">No completed calls received yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Configure the webhook in Vapi, place a test call, then refresh this panel.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {calls.map((call: ImportedCall) => (
                <div key={call.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs font-medium">{call.providerCallId}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{dateLabel(call.endedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${call.status === "failed" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>{call.status}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{durationLabel(call.durationSeconds)}</span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded-lg bg-muted/40 p-2.5"><span className="block text-muted-foreground">Assistant</span><span className="mt-1 block break-all font-medium">{call.assistantId || "Unknown"}</span></div>
                    <div className="rounded-lg bg-muted/40 p-2.5"><span className="block text-muted-foreground">Call cost (USD)</span><span className="mt-1 block font-medium">{call.cost === null ? "Not supplied" : "$" + call.cost.toFixed(4)}</span></div>
                    <div className="rounded-lg bg-muted/40 p-2.5"><span className="block text-muted-foreground">End reason</span><span className="mt-1 block break-words font-medium">{call.endedReason || "Not supplied"}</span></div>
                  </div>
                  {call.summary && <details className="mt-3 rounded-lg border border-border bg-muted/20 p-3"><summary className="cursor-pointer text-xs font-medium">Call summary</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{call.summary}</p></details>}
                  {call.transcript && <details className="mt-2 rounded-lg border border-border bg-muted/20 p-3"><summary className="cursor-pointer text-xs font-medium">Transcript</summary><p className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{call.transcript}</p></details>}
                  {call.analysisData && <details className="mt-2 rounded-lg border border-border bg-muted/20 p-3"><summary className="cursor-pointer text-xs font-medium">Selected analysis fields</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-muted-foreground">{JSON.stringify(call.analysisData, null, 2)}</pre></details>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        This first integration is post-call only. Status means a valid webhook message reached PromptLab; it does not by itself certify ongoing delivery or a quality score.
      </p>
    </main>
  );
}
