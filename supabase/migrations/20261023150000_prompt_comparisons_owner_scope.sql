CREATE TABLE IF NOT EXISTS public.prompt_comparisons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Prompt comparison',
  suite TEXT NOT NULL CHECK (suite IN ('balanced', 'redteam', 'pii', 'regulatory', 'voice')),
  agent_type TEXT NOT NULL CHECK (agent_type IN ('chat', 'voice')),
  variant_a JSONB NOT NULL CHECK (jsonb_typeof(variant_a) = 'object'),
  variant_b JSONB NOT NULL CHECK (jsonb_typeof(variant_b) = 'object'),
  scenarios JSONB NOT NULL CHECK (jsonb_typeof(scenarios) = 'array'),
  scenario_count INTEGER NOT NULL CHECK (scenario_count > 0),
  results JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(results) = 'array'),
  completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'running', 'done', 'error')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prompt_comparisons_completed_le_count CHECK (completed_count <= scenario_count)
);

CREATE INDEX IF NOT EXISTS prompt_comparisons_user_created_idx
  ON public.prompt_comparisons(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS prompt_comparisons_user_status_idx
  ON public.prompt_comparisons(user_id, status, updated_at DESC);

ALTER TABLE public.prompt_comparisons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prompt_comparisons FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_comparisons TO authenticated;
GRANT ALL ON public.prompt_comparisons TO service_role;

CREATE POLICY "Users can read their own prompt comparisons"
  ON public.prompt_comparisons
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own prompt comparisons"
  ON public.prompt_comparisons
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own prompt comparisons"
  ON public.prompt_comparisons
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own prompt comparisons"
  ON public.prompt_comparisons
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
