import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";
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

const emptyFilters = (): Filters => ({
  industries: new Set(),
  useCases: new Set(),
  models: new Set(),
  severities: new Set(),
});

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
      (!query || [
        g.title,
        g.description,
        g.prompt,
        ...g.tags,
        ...g.industries,
        ...g.useCases,
        ...g.models,
      ].some((field) => field.toLowerCase().includes(query))),
    );
  }, [filters, search]);

  const activeFilterCount = filters.industries.size + filters.useCases.size + filters.models.size + filters.severities.size;
  const clearAll = () => {
    setFilters(emptyFilters());
    setSearch("");
  };

  return (
    <main className="mx-auto max-w-[1800px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
      <header className="relative mb-5 overflow-hidden rounded-[28px] bg-[#102b25] px-5 py-6 text-white shadow-[0_24px_70px_-35px_rgba(16,43,37,0.65)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/80"><ShieldCheck className="h-3.5 w-3.5" /> Agent safety toolkit</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-[42px]">Guardrails library<span className="text-emerald-300">.</span></h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 sm:text-base sm:leading-7">Reusable safety instructions for real conversational agents. Find patterns by use case, inspect what they protect against, and adapt before release.</p>
          </div>
          <Button onClick={() => setGeneratorOpen((value) => !value)} className="relative h-11 shrink-0 rounded-xl bg-emerald-300 px-4 font-semibold text-[#12382d] hover:bg-emerald-200">
            <Sparkles className="mr-2 h-4 w-4" /> {generatorOpen ? "Hide generator" : "Generate guardrails"}
          </Button>
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-2 border-t border-white/10 pt-5 sm:grid-cols-3 sm:gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">Pattern library</p><p className="mt-2 text-xl font-semibold tabular-nums sm:text-2xl">{GUARDRAILS.length}</p><p className="mt-1 text-[11px] text-white/45">Ready-to-adapt examples</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">High attention</p><p className="mt-2 text-xl font-semibold tabular-nums sm:text-2xl">{GUARDRAILS.filter((g) => ["high", "critical"].includes(g.severity.toLowerCase())).length}</p><p className="mt-1 text-[11px] text-white/45">High / critical severity tags</p></div>
          <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 sm:col-span-1 sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">Current results</p><p className="mt-2 text-xl font-semibold tabular-nums sm:text-2xl">{visible.length}<span className="ml-1.5 text-xs font-normal text-white/45">/ {GUARDRAILS.length}</span></p><p className="mt-1 text-[11px] text-white/45">Updates as you filter</p></div>
        </div>
      </header>

      <div className="mb-5 rounded-2xl border border-[#e0e9e3] bg-white p-3 shadow-[0_12px_40px_-30px_rgba(16,43,37,0.35)] sm:p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b877b]" />
            <Input aria-label="Search guardrails" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guardrails, tags, risks, or prompt text…" className="h-12 rounded-xl border-[#e0e9e3] bg-[#f8faf9] pl-10 pr-10 focus-visible:ring-[#83bda0]" />
            {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-[#e0e9e3] bg-[#f8faf9] px-3.5 py-2.5 text-xs font-medium text-[#476457]"><strong className="text-[#17392e]">{visible.length}</strong> shown <span className="mx-1 text-[#a7b8ae]">/</span> {GUARDRAILS.length} patterns</span>
            {(activeFilterCount > 0 || search) && <Button variant="ghost" size="sm" onClick={clearAll} className="h-10 rounded-xl">Clear filters</Button>}
          </div>
        </div>
      </div>

      {generatorOpen && <div className="mb-6"><GuardrailGenerator /></div>}

      <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
        <details className="group rounded-2xl border border-[#e0e9e3] bg-white p-4 shadow-sm lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-brand" /> Filters</span><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{activeFilterCount} active</span></summary>
          <div className="mt-5 border-t border-border pt-5"><FilterPanel filters={filters} setFilters={setFilters} counts={{ total: GUARDRAILS.length, visible: visible.length }} /></div>
        </details>
        <div className="sticky top-24 hidden rounded-2xl border border-[#e0e9e3] bg-white p-4 shadow-[0_12px_40px_-30px_rgba(16,43,37,0.35)] lg:block">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4 text-brand" /> Refine results</div>
          <FilterPanel filters={filters} setFilters={setFilters} counts={{ total: GUARDRAILS.length, visible: visible.length }} />
        </div>
        <section className="min-w-0 space-y-4" aria-label="Guardrail results">
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center sm:px-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><Search className="h-5 w-5" /></div>
              <h2 className="mt-4 text-base font-semibold">No guardrails match this search</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Try a broader keyword or clear a few filters to see more results.</p>
              <Button variant="outline" className="mt-5" onClick={clearAll}>Clear search and filters</Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-sm font-semibold">Recommended starting points</p>
                <p className="text-xs text-muted-foreground">Copy and adapt before production use</p>
              </div>
              <div className="grid gap-4 2xl:grid-cols-2">
                {visible.map((g) => <GuardrailCard key={g.id} g={g} />)}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
