import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pickRecord(...values: unknown[]): JsonRecord {
  for (const value of values) if (isRecord(value)) return value;
  return {};
}

function stringValue(value: unknown, max = 5000): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function dateValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const stamp = typeof value === "number" ? value : Date.parse(value);
  const date = new Date(stamp);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function numberValue(value: unknown, min = 0, max = 1_000_000): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function safeJson(value: unknown, maxChars = 12000): JsonRecord | null {
  if (!isRecord(value)) return null;
  try {
    const text = JSON.stringify(value);
    if (text.length > maxChars) return null;
    return JSON.parse(text) as JsonRecord;
  } catch {
    return null;
  }
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

async function adminDb(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const Route = createFileRoute("/api/vapi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const declaredLength = Number(request.headers.get("content-length") || 0);
        if (declaredLength > 1_000_000) return errorResponse("Webhook payload is too large.", 413);

        const providedSecret = request.headers.get("x-promptlab-secret")?.trim() || "";
        if (!providedSecret || providedSecret.length > 256) {
          return errorResponse("Webhook authentication failed.", 401);
        }

        let rawBody: string;
        try {
          rawBody = await request.text();
        } catch {
          return errorResponse("Could not read webhook payload.", 400);
        }
        if (!rawBody || rawBody.length > 1_000_000) {
          return errorResponse("Webhook payload is empty or too large.", 413);
        }

        let payload: JsonRecord;
        try {
          const parsed: unknown = JSON.parse(rawBody);
          if (!isRecord(parsed)) return errorResponse("Webhook payload must be a JSON object.", 400);
          payload = parsed;
        } catch {
          return errorResponse("Webhook payload must be valid JSON.", 400);
        }

        const message = pickRecord(payload.message, payload);
        const eventType = stringValue(message.type, 120) ?? "unknown";
        const call = pickRecord(message.call, payload.call);
        const artifact = pickRecord(message.artifact, call.artifact, payload.artifact);
        const analysis = pickRecord(message.analysis, call.analysis, payload.analysis);

        const { createHash } = await import("node:crypto");
        const secretHash = createHash("sha256").update(providedSecret, "utf8").digest("hex");

        let db: any;
        try {
          db = await adminDb();
        } catch {
          return errorResponse("Webhook receiver is not configured with its server-side database credentials.", 503);
        }

        const { data: integration, error: integrationError } = await db
          .from("voice_agent_integrations")
          .select("id, user_id, store_transcripts")
          .eq("provider", "vapi")
          .eq("webhook_secret_hash", secretHash)
          .maybeSingle();

        if (integrationError) {
          console.error("[Vapi webhook] Integration lookup failed", integrationError.code);
          return errorResponse("Could not authenticate webhook.", 500);
        }
        if (!integration) return errorResponse("Webhook authentication failed.", 401);

        const receivedAt = new Date().toISOString();
        const { error: eventUpdateError } = await db
          .from("voice_agent_integrations")
          .update({
            status: "active",
            last_event_at: receivedAt,
            last_event_type: eventType,
            updated_at: receivedAt,
          })
          .eq("id", integration.id)
          .eq("user_id", integration.user_id);

        if (eventUpdateError) {
          console.error("[Vapi webhook] Integration status update failed", eventUpdateError.code);
          return errorResponse("Could not record webhook receipt.", 500);
        }

        // The first release imports completed-call reports. Other authenticated
        // Vapi event types acknowledge delivery but are not stored as call rows.
        if (eventType !== "end-of-call-report") {
          return Response.json({ received: true, stored: false, eventType }, { status: 200 });
        }

        const providerCallId = stringValue(call.id, 200);
        if (!providerCallId) return errorResponse("Completed-call event is missing message.call.id.", 400);

        const startedAt = dateValue(call.startedAt ?? call.started_at);
        const endedAt = dateValue(call.endedAt ?? call.ended_at) ?? receivedAt;
        const suppliedDuration = numberValue(call.durationSeconds ?? call.duration_seconds ?? call.duration, 0, 7 * 24 * 3600);
        const durationSeconds = suppliedDuration !== null
          ? Math.ceil(suppliedDuration)
          : startedAt
            ? Math.max(0, Math.ceil((Date.parse(endedAt) - Date.parse(startedAt)) / 1000))
            : null;
        const endedReason = stringValue(message.endedReason ?? message.ended_reason ?? call.endedReason ?? call.ended_reason, 240);
        const failedReason = /fail|error|busy|no.answer|unavailable/i.test(endedReason ?? "");
        const summary = integration.store_transcripts ? stringValue(analysis.summary ?? message.summary ?? call.summary, 10000) : null;
        const transcript = integration.store_transcripts ? stringValue(artifact.transcript ?? message.transcript, 50000) : null;
        const analysisData = integration.store_transcripts
          ? safeJson({
              ...(isRecord(analysis.structuredData) ? { structuredData: analysis.structuredData } : {}),
              ...(isRecord(analysis.successEvaluation) ? { successEvaluation: analysis.successEvaluation } : {}),
            })
          : null;
        const cost = numberValue(call.cost ?? message.cost ?? analysis.cost, 0, 100_000);
        const callRow: Record<string, unknown> = {
          integration_id: integration.id,
          user_id: integration.user_id,
          provider: "vapi",
          provider_call_id: providerCallId,
          assistant_id: stringValue(call.assistantId ?? call.assistant_id ?? message.assistantId ?? payload.assistantId, 200),
          call_type: stringValue(call.type ?? message.callType, 100),
          status: failedReason ? "failed" : "ended",
          started_at: startedAt,
          ended_at: endedAt,
          duration_seconds: durationSeconds,
          ended_reason: endedReason,
          cost,
          updated_at: receivedAt,
        };

        // Do not persist call text unless the user explicitly opted in.
        if (integration.store_transcripts) {
          callRow.summary = summary;
          callRow.transcript = transcript;
          callRow.analysis_data = analysisData;
        }

        const { error: upsertError } = await db
          .from("voice_agent_calls")
          .upsert(callRow, { onConflict: "integration_id,provider_call_id" });

        if (upsertError) {
          console.error("[Vapi webhook] Call upsert failed", upsertError.code);
          return errorResponse("Could not save completed call.", 500);
        }

        return Response.json({ received: true, stored: true, providerCallId }, { status: 200 });
      },
    },
  },
});
