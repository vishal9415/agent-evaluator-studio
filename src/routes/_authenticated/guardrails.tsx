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
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-6 flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand"><ShieldCheck className="h-3.5 w-3.5" /> Prompt safety toolkit</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Guardrails library</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Find a starting point, tailor it to your agent, and test the resulting instructions in the evaluation studio. Review generated content before using it in production.</p>
        </div>
        <Button onClick={() => setGeneratorOpen((value) => !value)} className="h-10 shrink-0 bg-brand text-brand-foreground hover:bg-brand/90">
          <Sparkles className="mr-2 h-4 w-4" /> {generatorOpen ? "Hide generator" : "Generate for my use case"}
        </Button>
      </header>

      <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search guardrails" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guardrails, tags, risks, or prompt text…" className="h-11 bg-card pl-9 pr-10" />
          {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground"><strong className="text-foreground">{visible.length}</strong> of {GUARDRAILS.length} guardrails</span>
          {(activeFilterCount > 0 || search) && <Button variant="ghost" size="sm" onClick={clearAll} className="h-9">Clear filters</Button>}
        </div>
      </div>

      {generatorOpen && <div className="mb-6"><GuardrailGenerator /></div>}

      <div className="grid items-start gap-5 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-7">
        <details className="group rounded-xl border border-border bg-card p-4 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-brand" /> Filters</span><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{activeFilterCount} active</span></summary>
          <div className="mt-5 border-t border-border pt-5"><FilterPanel filters={filters} setFilters={setFilters} counts={{ total: GUARDRAILS.length, visible: visible.length }} /></div>
        </details>
        <div className="sticky top-24 hidden rounded-xl border border-border bg-card p-4 lg:block">
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
