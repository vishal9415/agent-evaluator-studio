import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Industry, ModelFamily, Severity, UseCase } from "@/lib/guardrails-data";
import { INDUSTRIES, MODELS, USE_CASES } from "@/lib/guardrails-data";

export interface Filters {
  industries: Set<Industry>;
  useCases: Set<UseCase>;
  models: Set<ModelFamily>;
  severities: Set<Severity>;
}

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  counts: { total: number; visible: number };
}

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function Section<T extends string>({
  title,
  items,
  selected,
  onToggle,
  defaultExpanded = false,
}: {
  title: string;
  items: readonly T[];
  selected: Set<T>;
  onToggle: (value: T) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="border-b border-border/70 py-3 last:border-b-0 last:pb-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 rounded-md py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/85">
          {title}
          {selected.size > 0 && <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] normal-case text-brand">{selected.size}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
          {items.map((item) => (
            <Label key={item} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-normal text-foreground transition-colors hover:bg-muted">
              <Checkbox checked={selected.has(item)} onCheckedChange={() => onToggle(item)} />
              <span className="flex-1 break-words leading-5">{item}</span>
            </Label>
          ))}
        </div>
      )}
    </section>
  );
}

export function FilterPanel({ filters, setFilters, counts }: Props) {
  const clear = () => setFilters({
    industries: new Set(),
    useCases: new Set(),
    models: new Set(),
    severities: new Set(),
  });

  const activeCount =
    filters.industries.size + filters.useCases.size + filters.models.size + filters.severities.size;

  return (
    <aside className="space-y-3" aria-label="Guardrail filters">
      <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold"><SlidersHorizontal className="h-3.5 w-3.5 text-brand" /> Filter results</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{counts.visible} of {counts.total} results</p>
        </div>
        {activeCount > 0 && <Button variant="ghost" size="sm" onClick={clear} className="h-7 px-2 text-xs">Clear {activeCount}</Button>}
      </div>
      <Section
        title="Severity"
        items={SEVERITIES}
        selected={filters.severities}
        defaultExpanded
        onToggle={(value) => setFilters({ ...filters, severities: toggle(filters.severities, value) })}
      />
      <Section
        title="Model"
        items={MODELS}
        selected={filters.models}
        defaultExpanded
        onToggle={(value) => setFilters({ ...filters, models: toggle(filters.models, value) })}
      />
      <Section
        title="Industry"
        items={INDUSTRIES}
        selected={filters.industries}
        onToggle={(value) => setFilters({ ...filters, industries: toggle(filters.industries, value) })}
      />
      <Section
        title="Use case"
        items={USE_CASES}
        selected={filters.useCases}
        onToggle={(value) => setFilters({ ...filters, useCases: toggle(filters.useCases, value) })}
      />
    </aside>
  );
}
