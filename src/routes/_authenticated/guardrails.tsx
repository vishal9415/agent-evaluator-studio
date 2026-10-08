import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GUARDRAILS } from "@/lib/guardrails-data";
import { GuardrailCard } from "@/components/guardrails/GuardrailCard";
import { FilterPanel, type Filters } from "@/components/guardrails/FilterPanel";
import { GuardrailGenerator } from "@/components/guardrails/GuardrailGenerator";

export const Route = createFileRoute("/_authenticated/guardrails")({
  head: () => ({
    meta: [
      { title: "Guardrails Library — PromptLab" },
      { name: "description", content: "Browse ready-to-paste guardrail prompts by industry, use case, model and severity." },
      { property: "og:title", content: "Guardrails Library — PromptLab" },
      { property: "og:description", content: "Ready-to-paste guardrail prompts for AI agents." },
    ],
  }),
  component: GuardrailsPage,
});

function GuardrailsPage() {
  const [filters, setFilters] = useState<Filters>({
    industries: new Set(),
    useCases: new Set(),
    models: new Set(),
    severities: new Set(),
  });
  const visible = useMemo(
    () =>
      GUARDRAILS.filter(
        (g) =>
          (!filters.industries.size || g.industries.some((i) => filters.industries.has(i))) &&
          (!filters.useCases.size || g.useCases.some((u) => filters.useCases.has(u))) &&
          (!filters.models.size || g.models.some((m) => filters.models.has(m))) &&
          (!filters.severities.size || filters.severities.has(g.severity)),
      ),
    [filters],
  );
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 md:grid-cols-[240px_1fr]">
      <FilterPanel filters={filters} setFilters={setFilters} counts={{ total: GUARDRAILS.length, visible: visible.length }} />
      <div className="grid gap-4">
        <GuardrailGenerator />
        {visible.map((g) => (
          <GuardrailCard key={g.id} g={g} />
        ))}
      </div>
    </div>
  );
}
