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

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set);
  n.has(v) ? n.delete(v) : n.add(v);
  return n;
}

function Section<T extends string>({
  title, items, selected, onToggle,
}: { title: string; items: readonly T[]; selected: Set<T>; onToggle: (v: T) => void }) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="space-y-1.5">
        {items.map((item) => (
          <Label key={item} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm font-normal text-foreground hover:bg-muted">
            <Checkbox checked={selected.has(item)} onCheckedChange={() => onToggle(item)} />
            <span className="flex-1 truncate">{item}</span>
          </Label>
        ))}
      </div>
    </div>
  );
}

export function FilterPanel({ filters, setFilters, counts }: Props) {
  const clear = () =>
    setFilters({
      industries: new Set(), useCases: new Set(),
      models: new Set(), severities: new Set(),
    });

  const activeCount =
    filters.industries.size + filters.useCases.size + filters.models.size + filters.severities.size;

  return (
    <aside className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {counts.visible} / {counts.total} guardrails
          </p>
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clear} className="h-7 px-2 text-xs">
            Clear ({activeCount})
          </Button>
        )}
      </div>

      <Section
        title="Model"
        items={MODELS}
        selected={filters.models}
        onToggle={(v) => setFilters({ ...filters, models: toggle(filters.models, v) })}
      />
      <Section
        title="Industry"
        items={INDUSTRIES}
        selected={filters.industries}
        onToggle={(v) => setFilters({ ...filters, industries: toggle(filters.industries, v) })}
      />
      <Section
        title="Use case"
        items={USE_CASES}
        selected={filters.useCases}
        onToggle={(v) => setFilters({ ...filters, useCases: toggle(filters.useCases, v) })}
      />
      <Section
        title="Severity"
        items={SEVERITIES}
        selected={filters.severities}
        onToggle={(v) => setFilters({ ...filters, severities: toggle(filters.severities, v) })}
      />
    </aside>
  );
}
