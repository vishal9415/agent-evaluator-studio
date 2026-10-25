-- Design-partner pilot feedback. Store structured outcomes only, never raw audio or transcripts.
CREATE TABLE IF NOT EXISTS public.design_partner_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_kind TEXT NOT NULL DEFAULT 'design_partner_feedback'
    CHECK (report_kind IN ('design_partner_feedback')),
  overall_rating SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  category TEXT NOT NULL CHECK (category IN (
    'General feedback',
    'Critical detail preservation',
    'Speech recognition',
    'Turn-taking and latency',
    'Voice naturalness',
    'Unsupported claims',
    'Setup and reliability',
    'User experience'
  )),
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('OpenAI Realtime', 'Local Ollama', 'Other / not tested')),
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
  case_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_ok BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS design_partner_reports_user_created_idx
  ON public.design_partner_reports (user_id, created_at DESC);

ALTER TABLE public.design_partner_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own design partner reports" ON public.design_partner_reports;
CREATE POLICY "Users can view their own design partner reports"
  ON public.design_partner_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can submit their own design partner reports" ON public.design_partner_reports;
CREATE POLICY "Users can submit their own design partner reports"
  ON public.design_partner_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own design partner reports" ON public.design_partner_reports;
CREATE POLICY "Users can delete their own design partner reports"
  ON public.design_partner_reports FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.design_partner_reports TO authenticated;
GRANT ALL ON public.design_partner_reports TO service_role;
