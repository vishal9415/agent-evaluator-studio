import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getVoiceSessionDeletionBlock } from "@/lib/voice-session-deletion";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const sessionIdSchema = z.string().uuid();
const listEventsInput = z.object({ sessionId: sessionIdSchema });
const recordEventInput = z.object({
  sessionId: sessionIdSchema,
  eventKey: z.string().min(1).max(100),
  eventType: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/),
  source: z.enum(["browser", "provider", "adapter", "simulator"]),
  clientElapsedMs: z.number().int().min(0).max(60 * 60 * 1000).nullable(),
  measurementStatus: z.enum(["measured", "estimated", "unavailable"]),
});
const finishInput = z.object({
  sessionId: sessionIdSchema,
  status: z.enum(["ended", "error", "cancelled"]),
  endReason: z.enum([
    "user_ended",
    "duration_cap_reached",
    "connection_failed",
    "provider_error",
    "browser_unmounted",
    "negotiation_failed",
  ]),
});

export const listVoiceSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data, error } = await db
      .from("voice_sessions")
      .select("id, provider, status, model, voice, started_at, connected_at, ended_at, duration_seconds, end_reason, created_at")
      .eq("user_id", context.userId)
      .order("started_at", { ascending: false })
      .limit(30);
    if (error) throw new Error("Could not load voice session history.");
    return data ?? [];
  });

/**
 * Persist only event metadata. Transcript text, raw audio, provider error bodies,
 * prompt text, and arbitrary event payloads are intentionally not accepted.
 */
export const recordVoiceSessionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => recordEventInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: session, error: sessionError } = await db
      .from("voice_sessions")
      .select("id, connected_at, ended_at")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (sessionError || !session) throw new Error("Voice session not found.");

    const { error } = await db.from("voice_session_events").upsert(
      {
        session_id: data.sessionId,
        user_id: context.userId,
        event_key: data.eventKey,
        event_type: data.eventType,
        source: data.source,
        client_elapsed_ms: data.clientElapsedMs,
        measurement_status: data.measurementStatus,
      },
      { onConflict: "session_id,event_key", ignoreDuplicates: true },
    );
    if (error) throw new Error("Could not save the voice session event.");

    if (
      !session.connected_at &&
      !session.ended_at &&
      (data.eventType === "browser.connection_state.connected" ||
        data.eventType === "browser.data_channel.open")
    ) {
      const now = new Date().toISOString();
      await db
        .from("voice_sessions")
        .update({ connected_at: now, status: "active", updated_at: now })
        .eq("id", data.sessionId)
        .eq("user_id", context.userId)
        .is("connected_at", null)
        .is("ended_at", null);
    }

    return { recorded: true };
  });

/**
 * Idempotently end a session. The server asks OpenAI to hang up by its opaque
 * provider call ID, then records server-side end time and elapsed duration.
 * A failed hangup is reported explicitly rather than silently treated as a
 * confirmed provider termination.
 */
async function reconcileSessionUsage(
  db: Awaited<ReturnType<typeof admin>>,
  userId: string,
  sessionId: string,
  durationSeconds: number,
  conservativeFullReservation = false,
) {
  const consumedSeconds = conservativeFullReservation ? 600 : Math.max(0, Math.floor(durationSeconds));
  const { error } = await db.rpc("reconcile_voice_test_seconds", {
    p_user_id: userId,
    p_session_id: sessionId,
    p_consumed_seconds: consumedSeconds,
    p_idempotency_key: `voice-session:${sessionId}:finish`,
  });
  if (error) {
    // The session is already ended. A later Usage refresh retries held
    // reservations, so don't turn this into an unbounded provider hangup retry.
    throw new Error("The voice session ended, but usage reconciliation is pending. Refresh the Usage panel to retry.");
  }
}

export const finishVoiceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => finishInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: session, error } = await db
      .from("voice_sessions")
      .select("id, provider, provider_call_id, status, started_at, connected_at, ended_at, duration_seconds, end_reason")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error || !session) throw new Error("Voice session not found.");
    if (session.ended_at) {
      const durationSeconds = session.duration_seconds ?? 0;
      const hangupUnconfirmed = Boolean(session.end_reason?.includes("hangup_unconfirmed"));
      await reconcileSessionUsage(db, context.userId, data.sessionId, durationSeconds, hangupUnconfirmed);
      return {
        ended: true,
        alreadyFinished: true,
        durationSeconds,
        hangupStatus: hangupUnconfirmed ? "unconfirmed" : "not_needed",
      };
    }

    let hangupStatus: "confirmed" | "unconfirmed" | "not_needed" = "not_needed";
    if (session.provider === "openai-realtime" && session.provider_call_id) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        hangupStatus = "unconfirmed";
      } else {
        try {
          const response = await fetch(
            `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(session.provider_call_id)}/hangup`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}` },
              signal: AbortSignal.timeout(8000),
            },
          );
          hangupStatus = response.ok ? "confirmed" : "unconfirmed";
        } catch {
          hangupStatus = "unconfirmed";
        }
      }
    }

    const endedAt = new Date();
    const start = Date.parse(session.connected_at ?? session.started_at);
    const durationSeconds = Number.isFinite(start)
      ? Math.max(0, Math.ceil((endedAt.getTime() - start) / 1000))
      : 0;
    const endReason =
      hangupStatus === "unconfirmed" ? `${data.endReason}_hangup_unconfirmed` : data.endReason;

    const { data: updated, error: updateError } = await db
      .from("voice_sessions")
      .update({
        status: data.status,
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        end_reason: endReason,
        updated_at: endedAt.toISOString(),
      })
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .is("ended_at", null)
      .select("id")
      .maybeSingle();

    if (updateError) throw new Error("Could not finish the voice session.");
    if (!updated) {
      // Another finish request may have won the race. Re-read the owned row;
      // the transition remains idempotent.
      const { data: finalRow, error: readError } = await db
        .from("voice_sessions")
        .select("id, ended_at, duration_seconds, end_reason")
        .eq("id", data.sessionId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (readError || !finalRow?.ended_at) throw new Error("Could not confirm voice session completion.");
      const finalDuration = finalRow.duration_seconds ?? 0;
      const hangupUnconfirmed = Boolean(finalRow.end_reason?.includes("hangup_unconfirmed"));
      await reconcileSessionUsage(db, context.userId, data.sessionId, finalDuration, hangupUnconfirmed);
      return {
        ended: true,
        alreadyFinished: true,
        durationSeconds: finalDuration,
        hangupStatus: hangupUnconfirmed ? "unconfirmed" : hangupStatus,
      };
    }

    // If provider shutdown cannot be confirmed, conservatively consume the
    // full reserved 10-minute test allowance to avoid giving it straight back.
    // This is an internal test cap, not an estimate of provider USD charges.
    await reconcileSessionUsage(
      db,
      context.userId,
      data.sessionId,
      durationSeconds,
      hangupStatus === "unconfirmed",
    );
    return { ended: true, alreadyFinished: false, durationSeconds, hangupStatus };
  });

export const getVoiceSessionEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => listEventsInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: session, error: sessionError } = await db
      .from("voice_sessions")
      .select("id")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (sessionError || !session) throw new Error("Voice session not found.");

    const { data: events, error } = await db
      .from("voice_session_events")
      .select("id, event_type, source, client_elapsed_ms, measurement_status, received_at")
      .eq("session_id", data.sessionId)
      .eq("user_id", context.userId)
      .order("received_at", { ascending: true })
      .limit(300);
    if (error) throw new Error("Could not load the voice session timeline.");
    return events ?? [];
  });

export const deleteVoiceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ sessionId: sessionIdSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: session, error: sessionError } = await db
      .from("voice_sessions")
      .select("id, ended_at")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (sessionError || !session) throw new Error("Voice session not found.");

    // The ledger reservation is separate from the session row. Never delete
    // a live session or cascade-delete a reservation whose usage is unsettled.
    const { data: reservation, error: reservationError } = await db
      .from("voice_usage_reservations")
      .select("status")
      .eq("session_id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (reservationError) throw new Error("Could not verify voice session usage.");

    const deletionBlock = getVoiceSessionDeletionBlock({
      endedAt: session.ended_at,
      reservationStatus: reservation?.status ?? null,
    });
    if (deletionBlock) throw new Error(deletionBlock);

    const { data: deleted, error } = await db
      .from("voice_sessions")
      .delete()
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .not("ended_at", "is", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error("Could not delete the voice session.");
    if (!deleted) {
      throw new Error("The session changed while deleting. Refresh history and retry.");
    }
    return { deleted: true };
  });


const grantInput = z.object({
  targetUserId: z.string().uuid(),
  amountSeconds: z.number().int().min(60).max(86400),
  reason: z.string().trim().min(3).max(200),
  requestId: z.string().uuid(),
});

function isConfiguredAdmin(userId: string): boolean {
  return (process.env.PROMPTLAB_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(userId);
}

/**
 * On-demand stale-session recovery for the pilot. There is no durable background
 * scheduler yet, so this runs when the signed-in user refreshes usage. Unknown
 * duration is treated conservatively as the full reserved test allowance.
 */
async function closeStaleVoiceSessions(
  db: Awaited<ReturnType<typeof admin>>,
  userId: string,
) {
  const staleBefore = new Date(Date.now() - 12 * 60 * 1000).toISOString();
  const { data: staleSessions, error } = await db
    .from("voice_sessions")
    .select("id, provider, provider_call_id")
    .eq("user_id", userId)
    .is("ended_at", null)
    .lt("started_at", staleBefore)
    .order("started_at", { ascending: true })
    .limit(3);
  if (error || !staleSessions?.length) return;

  const apiKey = process.env.OPENAI_API_KEY;
  await Promise.all(staleSessions.map(async (session) => {
    let hangupConfirmed = false;
    if (session.provider === "openai-realtime" && session.provider_call_id && apiKey) {
      try {
        const response = await fetch(
          `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(session.provider_call_id)}/hangup`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(6000),
          },
        );
        hangupConfirmed = response.ok;
      } catch {
        hangupConfirmed = false;
      }
    }

    const now = new Date().toISOString();
    const { data: ended, error: endError } = await db
      .from("voice_sessions")
      .update({
        status: "error",
        ended_at: now,
        // Browser loss makes the actual duration unknowable. Charge the
        // maximum reserved test-seconds rather than silently refunding.
        duration_seconds: 600,
        end_reason: hangupConfirmed ? "stale_session_recovered" : "stale_session_hangup_unconfirmed",
        updated_at: now,
      })
      .eq("id", session.id)
      .eq("user_id", userId)
      .is("ended_at", null)
      .select("id")
      .maybeSingle();

    if (endError || !ended) return;
    // The usage summary below retries any held reservations for ended sessions.
  }));
}

/** Reconcile any already-ended sessions whose prior finish request missed the ledger RPC. */
async function retryEndedSessionReconciliation(
  db: Awaited<ReturnType<typeof admin>>,
  userId: string,
) {
  const { data: reservations, error } = await db
    .from("voice_usage_reservations")
    .select("session_id")
    .eq("user_id", userId)
    .eq("status", "held")
    .limit(50);
  if (error || !reservations?.length) return;

  for (const reservation of reservations) {
    const { data: session } = await db
      .from("voice_sessions")
      .select("ended_at, duration_seconds, end_reason")
      .eq("id", reservation.session_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!session?.ended_at) continue;

    await db.rpc("reconcile_voice_test_seconds", {
      p_user_id: userId,
      p_session_id: reservation.session_id,
      p_consumed_seconds: session.end_reason?.includes("hangup_unconfirmed")
        ? 600
        : session.duration_seconds ?? 0,
      p_idempotency_key: `voice-session:${reservation.session_id}:finish`,
    });
  }
}

export const getVoiceUsageSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    await closeStaleVoiceSessions(db, context.userId);
    await retryEndedSessionReconciliation(db, context.userId);
    const { data, error } = await db.rpc("get_voice_usage_summary", {
      p_user_id: context.userId,
    });
    if (error || !data?.length) throw new Error("Could not load the test usage ledger.");
    const summary = data[0];
    return {
      availableSeconds: Math.max(0, summary.balance_seconds),
      reservedSeconds: Math.max(0, summary.reserved_seconds),
      grantedSeconds: Math.max(0, summary.granted_seconds),
      usedSeconds: Math.max(0, summary.used_seconds),
      isAdmin: isConfiguredAdmin(context.userId),
    };
  });

export const grantVoiceTestCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => grantInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!isConfiguredAdmin(context.userId)) {
      throw new Error("Only a configured PromptLab admin can grant pilot test-seconds.");
    }

    const db = await admin();
    const { data: result, error } = await db.rpc("grant_voice_test_seconds", {
      p_user_id: data.targetUserId,
      p_actor_user_id: context.userId,
      p_amount_seconds: data.amountSeconds,
      p_reason: data.reason,
      p_idempotency_key: `admin-grant:${data.requestId}`,
    });
    if (error || !result?.length) throw new Error("Could not grant pilot test-seconds.");
    return {
      grantedToUserId: data.targetUserId,
      grantedSeconds: data.amountSeconds,
      availableSeconds: result[0].available_seconds,
    };
  });
