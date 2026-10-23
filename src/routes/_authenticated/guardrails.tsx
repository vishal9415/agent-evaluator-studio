import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Cpu, Layers3, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { GUARDRAILS } from "@/lib/guardrails-data";
import { GuardrailCard } from "@/components/guardrails/GuardrailCard";
import { FilterPanel, type Filters } from "@/components/guardrails/FilterPanel";
import { GuardrailGenerator } from "@/components/guardrails/GuardrailGenerator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/guardrails")({
  head: () => ({
    meta: [
      { title: "Guardrails Library — PromptLab" },
      { name: "description", content: "Browse ready-to-paste guardrail prompts by industry, use case, model and severity." },
      { property: "og:title", content: "Guardrails Library — PromptLab" },
      { property: "og:description", content: "Ready-to-paste guardrail prompts for AI agents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuardrailsPage,
});

const emptyFilters = (): Filters => ({ industries: new Set(), useCases: new Set(), models: new Set(), severities: new Set() });
const libraryStats = {
  total: GUARDRAILS.length,
  critical: GUARDRAILS.filter((g) => g.severity === "critical").length,
  industries: new Set(GUARDRAILS.flatMap((g) => g.industries)).size,
  models: new Set(GUARDRAILS.flatMap((g) => g.models)).size,
};

function GuardrailsPage() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [search, setSearch] = useState("");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return GUARDRAILS.filter((g) =>
      (!filters.industries.size || g.industries.some((i) => filters.industries.has(i))) &&
      (!filters.useCases.size || g.useCases.some((u) => filters.useCases.has(u))) &&
      (!filters.models.size || g.models.some((m) => filters.models.has(m))) &&
      (!filters.severities.size || filters.severities.has(g.severity)) &&
      (!query || [g.title, g.description, g.prompt, ...g.tags, ...g.industries, ...g.useCases, ...g.models].some((field) => field.toLowerCase().includes(query))),
    );
  }, [filters, search]);

  const activeFilterCount = filters.industries.size + filters.useCases.size + filters.models.size + filters.severities.size;
  const clearAll = () => {
    setFilters(emptyFilters());
    setSearch("");
  };

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <header className="relative isolate overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-7 text-white shadow-xl shadow-slate-950/10 sm:px-8 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_410px] xl:items-center">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"><ShieldCheck className="h-4 w-4" /> Prompt safety toolkit <span className="text-slate-600">/</span> Library 03</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Guardrails library</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">Find a proven starting point for your agent, narrow the library by risk and use case, or generate safeguards for your specific workflow. Review and test every prompt before production.</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button onClick={() => setGeneratorOpen((value) => !value)} className="h-10 bg-emerald-400 font-semibold text-slate-950 hover:bg-emerald-300"><Sparkles className="mr-2 h-4 w-4" /> {generatorOpen ? "Hide generator" : "Generate for my use case"}</Button>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-300"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Copy-ready templates</span>
            </div>
          </div>
          <div className="relative grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Library rules</p><p className="mt-2 text-3xl font-semibold tracking-tight text-white">{libraryStats.total}</p><p className="mt-1 text-[11px] text-slate-400">Ready to adapt</p></div>
            <div className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.06] p-4"><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200"><AlertTriangle className="h-3 w-3" /> Critical risk</p><p className="mt-2 text-3xl font-semibold tracking-tight text-white">{libraryStats.critical}</p><p className="mt-1 text-[11px] text-slate-400">Highest-severity rules</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"><Layers3 className="h-3 w-3" /> Industries</p><p className="mt-2 text-2xl font-semibold tracking-tight text-white">{libraryStats.industries}</p><p className="mt-1 text-[11px] text-slate-400">Coverage areas</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"><Cpu className="h-3 w-3" /> Model families</p><p className="mt-2 text-2xl font-semibold tracking-tight text-white">{libraryStats.models}</p><p className="mt-1 text-[11px] text-slate-400">Supported targets</p></div>
          </div>
        </div>
      </header>

      {generatorOpen && <div className="rounded-2xl border border-brand/20 bg-brand/[0.025] p-2 sm:p-3"><GuardrailGenerator /></div>}

      <section className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4" aria-label="Search the guardrails library">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search guardrails" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search prompts, tags, risks, industries, or models…" className="h-11 rounded-xl border-border/80 bg-background pl-9 pr-10" />
            {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-border bg-muted/35 px-3 py-2 text-xs text-muted-foreground"><strong className="text-foreground">{visible.length}</strong> <span className="mx-0.5">/</span> {GUARDRAILS.length} rules</span>
            {(activeFilterCount > 0 || search) && <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 rounded-lg">Clear all</Button>}
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[248px_minmax(0,1fr)] xl:gap-6">
        <details className="group rounded-2xl border border-border/80 bg-card p-4 shadow-sm xl:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-brand" /> Refine results</span><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{activeFilterCount} active</span></summary>
          <div className="mt-4 border-t border-border pt-4"><FilterPanel filters={filters} setFilters={setFilters} counts={{ total: GUARDRAILS.length, visible: visible.length }} /></div>
        </details>

        <div className="sticky top-24 hidden rounded-2xl border border-border/80 bg-card p-4 shadow-sm xl:block">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div><p className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4 text-brand" /> Refine results</p><p className="mt-1 text-[11px] text-muted-foreground">Dial in the risk profile</p></div>
            <span className="rounded-lg bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">{activeFilterCount} on</span>
          </div>
          <FilterPanel filters={filters} setFilters={setFilters} counts={{ total: GUARDRAILS.length, visible: visible.length }} />
        </div>

        <section className="min-w-0 space-y-4" aria-label="Guardrail results">
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-14 text-center shadow-sm sm:px-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><Search className="h-5 w-5" /></div>
              <h2 className="mt-4 text-base font-semibold">No guardrails match this search</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Try a broader keyword or remove a filter to widen the results.</p>
              <Button variant="outline" className="mt-5 rounded-xl" onClick={clearAll}>Clear search and filters</Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3 px-1">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Library results</p><h2 className="mt-1 text-base font-semibold tracking-tight">Recommended starting points</h2></div>
                <p className="text-xs text-muted-foreground">Copy · adapt · evaluate</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">{visible.map((g) => <GuardrailCard key={g.id} g={g} />)}</div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
