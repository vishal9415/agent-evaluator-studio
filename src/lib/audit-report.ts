// Builds a printable executive audit report and opens it for Save-as-PDF.

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function exportAuditReport(opts: {
  evalRow: { id: string; created_at: string; effectiveness_score: number | null; hallucination_risk: number | null; scenario_count: number };
  scenarios: Array<{ idx: number; category: string | null; user_goal: string; expected_behavior: string | null; passed: boolean | null; effectiveness: number | null; hallucination: number | null; notes: string | null; conversation: any }>;
  summary: any;
  model: string;
  agentType: string;
  systemPrompt: string;
}) {
  const { evalRow, scenarios, summary, model, agentType, systemPrompt } = opts;
  const e = summary.enterprise ?? {};
  const sevOf = (i: number) => (e.scenarios ?? []).find((x: any) => x.idx === i) ?? {};
  const f = (n: unknown) => (Number(n) || 0).toFixed(1);
  const list = (t: string, a?: string[]) =>
    a?.length ? `<h3>${t}</h3><ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const counts: Record<string, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
  scenarios.forEach((s) => {
    const v = sevOf(s.idx).severity;
    if (v && v in counts) counts[v]++;
  });

  const rows = scenarios
    .map((s) => {
      const x = sevOf(s.idx);
      const convo = Array.isArray(s.conversation)
        ? s.conversation.map((m: any) => `<div class="m ${m.role}"><b>${esc(m.role)}:</b> ${esc(m.content)}</div>`).join("")
        : "";
      return `<div class="sc"><div class="sh"><b>#${s.idx + 1}</b> <span class="tag">${esc(s.category)}</span>
        <span class="${s.passed ? "pass" : "fail"}">${s.passed ? "PASS" : "FAIL"}</span>
        ${x.severity && x.severity !== "none" ? `<span class="sev ${x.severity}">${esc(x.severity)}${x.vulnerability ? " · " + esc(x.vulnerability) : ""}</span>` : ""}</div>
        <p><b>Goal:</b> ${esc(s.user_goal)}</p><p><b>Expected:</b> ${esc(s.expected_behavior)}</p>
        <p class="small">Effectiveness ${f(s.effectiveness)} · Hallucination ${f(s.hallucination)} · Safety ${f(x.safety)} · Privacy ${f(x.privacy)} · Adversarial ${f(x.adversarial)}</p>
        <p><b>Judge:</b> ${esc(s.notes)}</p>${convo}</div>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>PromptLab Audit Report ${esc(evalRow.id.slice(0, 8))}</title>
<style>body{font:13px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;max-width:900px;margin:32px auto;padding:0 24px}
h1{font-size:22px;margin:0}h2{font-size:16px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:28px}h3{font-size:13px;margin:12px 0 4px}
.verdict{display:inline-block;padding:6px 14px;border-radius:999px;font-weight:700;margin:12px 0;background:${e.readiness === "Production Ready" ? "#d1fae5" : e.readiness === "Approved for Staging" ? "#fef3c7" : "#fee2e2"}}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.k{border:1px solid #ddd;border-radius:8px;padding:10px}.k b{font-size:20px;display:block}
.sc{border:1px solid #ddd;border-radius:8px;padding:10px;margin:10px 0;page-break-inside:avoid}.tag{background:#eee;padding:1px 6px;border-radius:4px}
.pass{color:#047857;font-weight:700}.fail{color:#b91c1c;font-weight:700}.sev{padding:1px 6px;border-radius:4px;border:1px solid #999;font-size:11px;text-transform:uppercase}
.sev.critical{border-color:#b91c1c;color:#b91c1c}.sev.high{border-color:#c2410c;color:#c2410c}.small{color:#555;font-size:11px}
.m{font-size:12px;padding:4px 8px;margin:2px 0;border-radius:4px;background:#f5f5f5}.m.user{background:#eef6ff}
pre{white-space:pre-wrap;background:#f7f7f7;padding:10px;border-radius:6px;font-size:11px}.sign td{height:42px}
@media print{.noprint{display:none}}</style></head><body>
<button class="noprint" onclick="print()" style="float:right;padding:8px 14px">Save as PDF</button>
<h1>Conversational Agent Evaluation — Audit Report</h1>
<div class="small">PromptLab · Report ID ${esc(evalRow.id)} · Generated ${esc(new Date().toLocaleString())}</div>
<h2>1. Executive summary</h2>
<div class="verdict">${esc(e.readiness ?? "Not assessed")}</div>
<p>${esc(summary.verdict)}</p>
<div class="grid">
<div class="k">Effectiveness<b>${f(evalRow.effectiveness_score)}</b></div>
<div class="k">Hallucination risk<b>${f(evalRow.hallucination_risk)}</b></div>
<div class="k">Pass rate<b>${f(summary.passRate)}%</b></div>
<div class="k">Safety & alignment<b>${f(e.safety)}</b></div>
<div class="k">PII protection<b>${f(e.privacy)}</b></div>
<div class="k">Adversarial resistance<b>${f(e.adversarial)}</b></div>
<div class="k">Critical failures<b>${e.criticalFailures ?? 0}</b></div>
<div class="k">High failures<b>${e.highFailures ?? 0}</b></div></div>
<h2>2. Test configuration</h2>
<table><tr><th>Test suite</th><td>${esc(e.suiteLabel)}</td></tr><tr><th>Model</th><td>${esc(model)}</td></tr>
<tr><th>Agent type</th><td>${esc(agentType)}</td></tr><tr><th>Scenarios</th><td>${scenarios.length} of ${evalRow.scenario_count}</td></tr>
<tr><th>Prompt fingerprint</th><td>${esc(e.promptHash)}</td></tr><tr><th>Run started</th><td>${esc(new Date(evalRow.created_at).toLocaleString())}</td></tr></table>
<h2>3. Vulnerability matrix</h2>
<table><tr><th>Critical</th><th>High</th><th>Moderate</th><th>Low</th></tr><tr><td>${counts.critical}</td><td>${counts.high}</td><td>${counts.moderate}</td><td>${counts.low}</td></tr></table>
${list("Weaknesses", summary.weaknesses)}${list("Hallucination drivers", summary.hallucination_drivers)}${list("Recommended remediations", summary.suggestions)}${list("Strengths", summary.strengths)}
<h2>4. System prompt under test</h2><pre>${esc(systemPrompt)}</pre>
<h2>5. Scenario evidence</h2>${rows}
<h2>6. Compliance sign-off</h2>
<table class="sign"><tr><th>Role</th><th>Name</th><th>Decision</th><th>Signature / Date</th></tr>
<tr><td>AI / Prompt Engineering Lead</td><td></td><td></td><td></td></tr>
<tr><td>Risk & Compliance</td><td></td><td></td><td></td></tr>
<tr><td>Legal / Data Protection</td><td></td><td></td><td></td></tr></table>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `promptlab-audit-${evalRow.id.slice(0, 8)}.html`;
    a.click();
    return;
  }
  w.document.write(html);
  w.document.close();
}
