import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const stageSchema = z.object({
  id: z.string(),
  name: z.string(),
  prompt: z.string(),
  transitions: z.array(
    z.object({ id: z.string(), target: z.string(), condition: z.string() }),
  ),
});

const promptPayload = z.object({
  name: z.string().min(1).max(200),
  system_prompt: z.string().max(20000),
  model: z.string().min(1).max(120),
  agent_type: z.enum(["chat", "voice"]),
  begin_message: z.string().max(4000),
  stages: z.array(stageSchema).max(30),
  variables: z.record(z.string(), z.string()),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listPrompts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data, error } = await db
      .from("prompts")
      .select("id, name, system_prompt, model, agent_type, begin_message, stages, variables")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw new Error("Could not load saved prompts.");
    return data ?? [];
  });

export const savePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      id: z.string().uuid().nullable(),
      payload: promptPayload,
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: versions, error } = await db.rpc("save_prompt_version", {
      p_user_id: context.userId,
      p_prompt_id: data.id,
      p_payload: data.payload as unknown as Json,
      p_change_note: "Saved from Prompt Playground",
    });
    if (error || !versions?.length) {
      throw new Error("Could not save a new prompt version.");
    }
    const latest = versions[0];
    return {
      id: latest.prompt_id,
      versionId: latest.version_id,
      versionNumber: latest.version_number,
    };
  });

export const getEvaluation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ evaluationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: evaluation, error: evaluationError } = await db
      .from("evaluations")
      .select("*")
      .eq("id", data.evaluationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (evaluationError || !evaluation) throw new Error("Evaluation not found in your account.");

    const { data: scenarios, error: scenariosError } = await db
      .from("scenarios")
      .select("*")
      .eq("evaluation_id", data.evaluationId)
      .order("idx");
    if (scenariosError) throw new Error("Could not load evaluation scenarios.");
    return { evaluation, scenarios: scenarios ?? [] };
  });


/** List immutable configuration snapshots belonging to the signed-in user. */
export const listPromptVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ promptId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: versions, error } = await db
      .from("prompt_versions")
      .select("id, prompt_id, version_number, snapshot, change_note, created_at")
      .eq("prompt_id", data.promptId)
      .eq("user_id", context.userId)
      .order("version_number", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load prompt version history.");
    return versions ?? [];
  });
