import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const caseResultSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(180),
  status: z.enum(["pass", "needs_work", "not_tested"]),
});

const reportInput = z.object({
  overallRating: z.number().int().min(1).max(5),
  category: z.enum([
    "General feedback",
    "Critical detail preservation",
    "Speech recognition",
    "Turn-taking and latency",
    "Voice naturalness",
    "Unsupported claims",
    "Setup and reliability",
    "User experience",
  ]),
  executionMode: z.enum(["OpenAI Realtime", "Local Ollama", "Other / not tested"]),
  notes: z.string().max(4000).default(""),
  cases: z.array(caseResultSchema).max(12),
  contactOk: z.boolean().default(false),
});

/**
 * Submit a pilot report under the authenticated user's identity.
 * We intentionally accept structured case outcomes and feedback only—not
 * conversation transcripts, audio, prompt contents, or arbitrary event logs.
 */
export const saveDesignPartnerReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reportInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("design_partner_reports")
      .insert({
        user_id: context.userId,
        report_kind: "design_partner_feedback",
        overall_rating: data.overallRating,
        category: data.category,
        execution_mode: data.executionMode,
        notes: data.notes.trim(),
        case_results: data.cases,
        contact_ok: data.contactOk,
      })
      .select("id, created_at")
      .single();

    if (error || !row) {
      console.error("[DesignPartner] Could not save pilot report", error?.code);
      throw new Error("Your report could not be saved. Please try again.");
    }

    return { id: row.id, createdAt: row.created_at };
  });
