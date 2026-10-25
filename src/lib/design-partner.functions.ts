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


/**
 * Owner-only inbox for pilot reports. Non-admins receive an empty result.
 * Contact information is fetched and returned only for explicit follow-up opt-ins.
 */
export const listDesignPartnerReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const allowedUserIds = (process.env.PROMPTLAB_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!allowedUserIds.includes(context.userId)) {
      return { isAdmin: false as const, reports: [] as Array<{
        id: string;
        partnerLabel: string;
        overallRating: number;
        category: string;
        executionMode: string;
        notes: string;
        cases: Array<{ id: string; title: string; status: "pass" | "needs_work" | "not_tested" }>;
        contactOk: boolean;
        contactEmail: string | null;
        displayName: string | null;
        company: string | null;
        createdAt: string;
      }> };
    }

    const { data, error } = await supabaseAdmin
      .from("design_partner_reports")
      .select("id,user_id,overall_rating,category,execution_mode,notes,case_results,contact_ok,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[DesignPartner] Could not list pilot reports", error.code);
      throw new Error("Could not load design-partner feedback.");
    }

    const rows = data ?? [];
    const optedInIds = [...new Set(rows.filter((row) => row.contact_ok).map((row) => row.user_id))];
    const profileById = new Map<string, { email: string | null; display_name: string | null; company: string | null }>();

    if (optedInIds.length > 0) {
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id,email,display_name,company")
        .in("id", optedInIds);
      if (profileError) {
        // Feedback remains useful even if profile lookup fails; never include
        // any contact detail unless it is both opted in and successfully read.
        console.error("[DesignPartner] Could not load opted-in contact details", profileError.code);
      } else {
        for (const profile of profiles ?? []) {
          profileById.set(profile.id, {
            email: profile.email,
            display_name: profile.display_name,
            company: profile.company,
          });
        }
      }
    }

    return {
      isAdmin: true as const,
      reports: rows.map((row) => {
        const contactOk = row.contact_ok === true;
        const profile = contactOk ? profileById.get(row.user_id) : undefined;
        const caseResults = Array.isArray(row.case_results) ? row.case_results : [];
        const cases = caseResults.flatMap((item) => {
          if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
          const itemRecord = item as Record<string, unknown>;
          if (
            typeof itemRecord.id !== "string" ||
            typeof itemRecord.title !== "string" ||
            (itemRecord.status !== "pass" && itemRecord.status !== "needs_work" && itemRecord.status !== "not_tested")
          ) return [];
          return [{
            id: itemRecord.id,
            title: itemRecord.title,
            status: itemRecord.status as "pass" | "needs_work" | "not_tested",
          }];
        });

        return {
          id: row.id,
          // A stable, low-friction label lets the owner spot repeat feedback
          // without exposing the user's full auth UUID in the inbox UI.
          partnerLabel: "Partner " + row.user_id.slice(0, 8),
          overallRating: row.overall_rating,
          category: row.category,
          executionMode: row.execution_mode,
          notes: row.notes,
          cases,
          contactOk,
          contactEmail: profile?.email ?? null,
          displayName: profile?.display_name ?? null,
          company: profile?.company ?? null,
          createdAt: row.created_at,
        };
      }),
    };
  });
