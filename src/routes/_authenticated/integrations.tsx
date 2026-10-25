import { createFileRoute } from "@tanstack/react-router";
import { VapiIntegration } from "@/components/integrations/VapiIntegration";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — PromptLab" },
      { name: "description", content: "Connect existing voice agents and import completed call reports into PromptLab." },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return <VapiIntegration />;
}
