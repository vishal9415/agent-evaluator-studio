import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { realtimeRequestSchema } from "./openai-realtime.schema";

/**
 * Creates an owner-scoped, privacy-minimized session record and negotiates
 * OpenAI Realtime WebRTC. The standard API key remains on the server. Only
 * provider events and safe metadata are persisted; transcript text/audio
 * are not sent to persistence functions.
 */
export const createOpenAIRealtimeAnswer = createServerFn({ method: "POST" })
  .inputValidator((input) => realtimeRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    const openAiApiKey = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !supabasePublishableKey) {
      throw new Error("Supabase server configuration is missing.");
    }
    if (!openAiApiKey) {
      throw new Error("OPENAI_API_KEY is not configured on the server.");
    }

    const authClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getClaims(data.accessToken);
    const userId = authData?.claims?.sub;
    if (authError || typeof userId !== "string" || !userId) {
      throw new Error("Your session is invalid or expired. Sign in again.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const promptFingerprint = createHash("sha256").update(data.instructions, "utf8").digest("hex");
    const { data: session, error: createError } = await supabaseAdmin
      .from("voice_sessions")
      .insert({
        user_id: userId,
        provider: "openai-realtime",
        status: "connecting",
        model: data.model,
        voice: data.voice,
        prompt_fingerprint: promptFingerprint,
      })
      .select("id")
      .single();

    if (createError || !session) {
      throw new Error("Could not create a voice session record. Check database migrations and retry.");
    }

    // Reserve the maximum normal session duration before opening a provider
    // call. This is an internal test-time allowance, not an estimate of USD cost.
    const { data: reservation, error: reservationError } = await supabaseAdmin.rpc(
      "reserve_voice_test_seconds",
      {
        p_user_id: userId,
        p_session_id: session.id,
        p_reserved_seconds: 600,
        p_idempotency_key: `voice-session:${session.id}:hold`,
      },
    );
    if (reservationError || !reservation?.length) {
      await supabaseAdmin.from("voice_sessions").delete().eq("id", session.id).eq("user_id", userId);
      if (reservationError?.message.includes("INSUFFICIENT_TEST_SECONDS")) {
        throw new Error("There are not enough pilot test-seconds available. Ask your PromptLab admin to grant more allowance.");
      }
      throw new Error("Could not reserve the pilot test allowance. Check the usage-ledger migration.");
    }

    const markNegotiationFailure = async () => {
      const endedAt = new Date().toISOString();
      await supabaseAdmin
        .from("voice_sessions")
        .update({
          status: "error",
          ended_at: endedAt,
          duration_seconds: 0,
          end_reason: "negotiation_failed",
          updated_at: endedAt,
        })
        .eq("id", session.id)
        .eq("user_id", userId)
        .is("ended_at", null);

      // Refund the full hold if OpenAI never established the session.
      await supabaseAdmin.rpc("reconcile_voice_test_seconds", {
        p_user_id: userId,
        p_session_id: session.id,
        p_consumed_seconds: 0,
        p_idempotency_key: `voice-session:${session.id}:finish`,
      });
    };

    let callId: string | null = null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const form = new FormData();
      form.set("sdp", data.sdp);
      form.set(
        "session",
        JSON.stringify({
          type: "realtime",
          model: data.model,
          instructions: data.instructions,
          // Realtime permits either audio or text output for a response, not both.
          output_modalities: ["audio"],
          audio: {
            input: {
              transcription: { model: "gpt-4o-mini-transcribe" },
              turn_detection: {
                type: "server_vad",
                create_response: true,
                interrupt_response: true,
              },
            },
            output: { voice: data.voice },
          },
        }),
      );

      let response: Response;
      try {
        response = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          headers: { Authorization: `Bearer ${openAiApiKey}` },
          body: form,
          signal: controller.signal,
        });
      } catch {
        throw new Error("Could not reach OpenAI Realtime. Check network access and retry.");
      } finally {
        clearTimeout(timeout);
      }

      const location = response.headers.get("location");
      callId = location?.split("/").filter(Boolean).at(-1) ?? null;

      if (!response.ok) {
        // Never forward raw upstream bodies; they may expose diagnostic details.
        throw new Error(`OpenAI Realtime negotiation failed (HTTP ${response.status}). Check model access and server configuration.`);
      }

      const sdpAnswer = await response.text();
      if (!sdpAnswer.startsWith("v=")) {
        throw new Error("OpenAI returned an invalid WebRTC answer.");
      }

      const { error: updateError } = await supabaseAdmin
        .from("voice_sessions")
        .update({ provider_call_id: callId, updated_at: new Date().toISOString() })
        .eq("id", session.id)
        .eq("user_id", userId);
      if (updateError) throw new Error("Could not store the voice provider reference.");

      return { sdp: sdpAnswer, callId, sessionId: session.id };
    } catch (cause) {
      if (callId) {
        try {
          await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`, {
            method: "POST",
            headers: { Authorization: `Bearer ${openAiApiKey}` },
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          // A best-effort cleanup failure must not mask the original error.
        }
      }
      await markNegotiationFailure();
      throw cause instanceof Error ? cause : new Error("OpenAI Realtime session setup failed.");
    } finally {
      clearTimeout(timeout);
    }
  });
