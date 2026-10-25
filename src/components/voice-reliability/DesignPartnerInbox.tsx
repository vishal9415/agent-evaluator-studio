import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Inbox, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listDesignPartnerReports } from "@/lib/design-partner.functions";

type CaseResult = {
  id: string;
  title: string;
  status: "pass" | "needs_work" | "not_tested";
};

type Report = {
  id: string;
  partnerLabel: string;
  overallRating: number;
  category: string;
  executionMode: string;
  notes: string;
  cases: CaseResult[];
  contactOk: boolean;
  contactEmail: string | null;
  displayName: string | null;
  company: string | null;
  createdAt: string;
};

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return '"' + text.replaceAll('"', '""') + '"';
}

export function DesignPartnerInbox() {
  const load = useServerFn(listDesignPartnerReports);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await load();
      setIsAdmin(result.isAdmin);
      setReports(result.reports as Report[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the feedback inbox.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function downloadCsv() {
    const header = [
      "submitted_at",
      "partner_reference",
      "rating_out_of_5",
      "category",
      "execution_mode",
      "casebook_passed",
      "casebook_needs_work",
      "casebook_not_tested",
      "notes",
      "contact_opt_in",
      "contact_email",
      "display_name",
      "company",
    ];
    const lines = reports.map((report) => {
      const passed = report.cases.filter((item) => item.status === "pass").length;
      const needsWork = report.cases.filter((item) => item.status === "needs_work").length;
      const notTested = report.cases.filter((item) => item.status === "not_tested").length;
      return [
        report.createdAt,
        report.partnerLabel,
        report.overallRating,
        report.category,
        report.executionMode,
        passed,
        needsWork,
        notTested,
        report.notes,
        report.contactOk,
        report.contactOk ? report.contactEmail : "",
        report.contactOk ? report.displayName : "",
        report.contactOk ? report.company : "",
      ].map(csvCell).join(",");
    });
    const blob = new Blob(["\uFEFF" + [header.map(csvCell).join(","), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "promptlab-design-partner-feedback.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (!loading && !isAdmin && !error) return null;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4 text-brand" /> Pilot feedback inbox</CardTitle>
          <CardDescription className="mt-1.5 max-w-2xl text-xs leading-5">Owner-only view. Contact details are included only when a participant has explicitly opted in to follow-up. Other signed-in participants cannot view this inbox.</CardDescription>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={downloadCsv} disabled={loading || reports.length === 0}>
              <Download className="mr-2 h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        )}
      </CardHeader>
      {isAdmin && (
        <CardContent className="space-y-3">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {loading && reports.length === 0 ? (
            <p role="status" className="text-sm text-muted-foreground">Loading reports…</p>
          ) : reports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">No reports submitted yet</p>
              <p className="mt-1 text-xs text-muted-foreground">New design-partner submissions will appear here.</p>
            </div>
          ) : (
            reports.map((report) => {
              const passCount = report.cases.filter((item) => item.status === "pass").length;
              const failCount = report.cases.filter((item) => item.status === "needs_work").length;
              const untestedCount = report.cases.filter((item) => item.status === "not_tested").length;
              const name = report.contactOk ? [report.displayName, report.company].filter(Boolean).join(" · ") : "";
              return (
                <article key={report.id} className="rounded-xl border border-border/80 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{name || report.partnerLabel}</span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-300"><Star className="h-3 w-3" /> {report.overallRating}/5</span>
                        <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{report.category}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString()} · {report.executionMode} · {report.contactOk ? "Follow-up opted in" : "No follow-up consent"}</p>
                      {report.contactOk && report.contactEmail && <p className="mt-1 text-xs"><a className="text-brand underline underline-offset-2" href={`mailto:${encodeURIComponent(report.contactEmail)}`}>{report.contactEmail}</a></p>}
                    </div>
                    <div className="flex shrink-0 gap-2 text-xs tabular-nums">
                      <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">{passCount} passed</span>
                      <span className="rounded-lg bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">{failCount} needs work</span>
                      <span className="rounded-lg bg-muted px-2 py-1 text-muted-foreground">{untestedCount} untested</span>
                    </div>
                  </div>
                  {report.notes.trim() && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-sm leading-6">{report.notes}</p>}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">View case-by-case results ({report.cases.length})</summary>
                    <div className="mt-2 space-y-1.5">
                      {report.cases.map((item) => (
                        <div key={item.id} className="flex flex-col gap-1 rounded-lg border border-border/60 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <span>{item.title}</span>
                          <span className={item.status === "pass" ? "font-medium text-emerald-700 dark:text-emerald-300" : item.status === "needs_work" ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground"}>{item.status.replaceAll("_", " ")}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </article>
              );
            })
          )}
          <p className="text-[11px] leading-5 text-muted-foreground">Showing up to 100 most recent submissions. A missing email means the participant did not opt in, or the optional profile lookup was unavailable.</p>
        </CardContent>
      )}
      {!loading && !isAdmin && error && <CardContent><p role="alert" className="text-sm text-destructive">{error}</p></CardContent>}
    </Card>
  );
}
