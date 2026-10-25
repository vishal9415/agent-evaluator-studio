import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminDb(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const configureSchema = z.object({
  storeTranscripts: z.boolean(),
  rotateSecret: z.boolean().default(false),
});

function secretHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export const getVapiIntegrationOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const { data: integration, error: integrationError } = await db
      .from("voice_agent_integrations")
      .select("id, provider, display_name, status, store_transcripts, last_event_at, last_event_type, created_at, updated_at")
      .eq("user_id", context.userId)
      .eq("provider", "vapi")
      .maybeSingle();

    if (integrationError) {
      console.error("[Integrations] Could not load Vapi integration", integrationError.code);
      throw new Error("Could not load the Vapi integration.");
    }

    if (!integration) return { integration: null, calls: [] };

    const { data: calls, error: callsError } = await db
      .from("voice_agent_calls")
      .select("id, provider_call_id, assistant_id, call_type, status, started_at, ended_at, duration_seconds, ended_reason, cost, summary, analysis_data, transcript, created_at")
      .eq("user_id", context.userId)
      .eq("integration_id", integration.id)
      .order("ended_at", { ascending: false, nullsFirst: false })
      .limit(25);

    if (callsError) {
      console.error("[Integrations] Could not load Vapi calls", callsError.code);
      throw new Error("The integration is connected, but call history could not be loaded.");
    }

    return {
      integration: {
        id: integration.id,
        provider: integration.provider,
        displayName: integration.display_name,
        status: integration.status,
        storeTranscripts: integration.store_transcripts,
        lastEventAt: integration.last_event_at,
        lastEventType: integration.last_event_type,
        createdAt: integration.created_at,
        updatedAt: integration.updated_at,
      },
      calls: (calls ?? []).map((call: any) => ({
        id: call.id,
        providerCallId: call.provider_call_id,
        assistantId: call.assistant_id,
        callType: call.call_type,
        status: call.status,
        startedAt: call.started_at,
        endedAt: call.ended_at,
        durationSeconds: call.duration_seconds,
        endedReason: call.ended_reason,
        cost: call.cost === null ? null : Number(call.cost),
        summary: call.summary,
        analysisData: call.analysis_data,
        transcript: call.transcript,
        createdAt: call.created_at,
      })),
    };
  });

export const configureVapiIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => configureSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const { data: existing, error: lookupError } = await db
      .from("voice_agent_integrations")
      .select("id, status, store_transcripts")
      .eq("user_id", context.userId)
      .eq("provider", "vapi")
      .maybeSingle();

    if (lookupError) {
      console.error("[Integrations] Could not inspect Vapi integration", lookupError.code);
      throw new Error("Could not update the Vapi integration.");
    }

    const shouldRotate = data.rotateSecret || !existing;
    const rawSecret = shouldRotate ? randomBytes(32).toString("base64url") : null;
    const now = new Date().toISOString();

    if (!existing) {
      const { error } = await db.from("voice_agent_integrations").insert({
        user_id: context.userId,
        provider: "vapi",
        display_name: "Vapi",
        webhook_secret_hash: secretHash(rawSecret!),
        status: "pending",
        store_transcripts: data.storeTranscripts,
        updated_at: now,
      });
      if (error) {
        console.error("[Integrations] Could not create Vapi integration", error.code);
        throw new Error("Could not create the Vapi integration. Please retry.");
      }
    } else {
      const update: Record<string, unknown> = {
        store_transcripts: data.storeTranscripts,
        updated_at: now,
      };
      if (rawSecret) {
        update.webhook_secret_hash = secretHash(rawSecret);
        update.status = "pending";
        update.last_event_at = null;
        update.last_event_type = null;
      }

      const { error } = await db
        .from("voice_agent_integrations")
        .update(update)
        .eq("id", existing.id)
        .eq("user_id", context.userId);
      if (error) {
        console.error("[Integrations] Could not update Vapi integration", error.code);
        throw new Error("Could not update the Vapi integration.");
      }

      // Turning off content retention also erases previously retained call text.
      if (existing.store_transcripts && !data.storeTranscripts) {
        const { error: clearError } = await db
          .from("voice_agent_calls")
          .update({ summary: null, transcript: null, analysis_data: null, updated_at: now })
          .eq("integration_id", existing.id)
          .eq("user_id", context.userId);
        if (clearError) {
          console.error("[Integrations] Could not clear retained Vapi call content", clearError.code);
          throw new Error("Retention is now disabled, but historical call text could not be cleared. Please retry saving preferences.");
        }
      }
    }

    const { data: integration, error: refreshError } = await db
      .from("voice_agent_integrations")
      .select("id, provider, display_name, status, store_transcripts, last_event_at, last_event_type, created_at, updated_at")
      .eq("user_id", context.userId)
      .eq("provider", "vapi")
      .single();

    if (refreshError || !integration) throw new Error("The Vapi connection was saved, but its status could not be refreshed.");

    return {
      integration: {
        id: integration.id,
        provider: integration.provider,
        displayName: integration.display_name,
        status: integration.status,
        storeTranscripts: integration.store_transcripts,
        lastEventAt: integration.last_event_at,
        lastEventType: integration.last_event_type,
        createdAt: integration.created_at,
        updatedAt: integration.updated_at,
      },
      webhookSecret: rawSecret,
    };
  });
