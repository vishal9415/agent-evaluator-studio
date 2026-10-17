CREATE TABLE public.prompt_comparisons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 name text NOT NULL DEFAULT 'Prompt comparison',
 status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','running','done','error')),
 suite text NOT NULL,
 agent_type text NOT NULL,
 variant_a jsonb NOT NULL,
 variant_b jsonb NOT NULL,
 scenarios jsonb NOT NULL,
 results jsonb NOT NULL DEFAULT '[]'::jsonb,
 completed_count integer NOT NULL DEFAULT 0,
 scenario_count integer NOT NULL,
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.prompt_comparisons TO authenticated;
GRANT ALL ON public.prompt_comparisons TO service_role;
ALTER TABLE public.prompt_comparisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY comparisons_select_own ON public.prompt_comparisons FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY comparisons_insert_own ON public.prompt_comparisons FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY comparisons_update_own ON public.prompt_comparisons FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX comparisons_owner_created ON public.prompt_comparisons(user_id, created_at DESC);