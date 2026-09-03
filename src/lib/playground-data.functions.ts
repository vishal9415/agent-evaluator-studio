import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export const listPrompts = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("prompts")
    .select("id, name, system_prompt, model, agent_type, begin_message, stages, variables")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const savePrompt = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ id: z.string().uuid().nullable(), payload: promptPayload }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    if (data.id) {
      const { error } = await db
        .from("prompts")
        .update({ ...data.payload, updated_at: new Date().toISOString() } as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await db
      .from("prompts")
      .insert(data.payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getEvaluation = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ evaluationId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const [ev, sc] = await Promise.all([
      db.from("evaluations").select("*").eq("id", data.evaluationId).single(),
      db.from("scenarios").select("*").eq("evaluation_id", data.evaluationId).order("idx"),
    ]);
    if (ev.error) throw new Error(ev.error.message);
    return { evaluation: ev.data, scenarios: sc.data ?? [] };
  });
