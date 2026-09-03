DROP POLICY IF EXISTS "anon delete prompts" ON public.prompts;
DROP POLICY IF EXISTS "anon update prompts" ON public.prompts;
DROP POLICY IF EXISTS "anon write prompts" ON public.prompts;
DROP POLICY IF EXISTS "anon read prompts" ON public.prompts;
DROP POLICY IF EXISTS "anon all scenarios" ON public.scenarios;
DROP POLICY IF EXISTS "anon all evaluations" ON public.evaluations;

REVOKE ALL ON public.prompts FROM anon, authenticated;
REVOKE ALL ON public.evaluations FROM anon, authenticated;
REVOKE ALL ON public.scenarios FROM anon, authenticated;

GRANT ALL ON public.prompts TO service_role;
GRANT ALL ON public.evaluations TO service_role;
GRANT ALL ON public.scenarios TO service_role;

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;