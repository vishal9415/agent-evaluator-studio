
CREATE TABLE public.prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Untitled',
  system_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  agent_type TEXT NOT NULL DEFAULT 'chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts TO anon, authenticated;
GRANT ALL ON public.prompts TO service_role;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read prompts" ON public.prompts FOR SELECT USING (true);
CREATE POLICY "anon write prompts" ON public.prompts FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update prompts" ON public.prompts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon delete prompts" ON public.prompts FOR DELETE USING (true);

CREATE TABLE public.evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_id UUID REFERENCES public.prompts(id) ON DELETE CASCADE,
  prompt_snapshot TEXT NOT NULL,
  model TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  scenario_count INT NOT NULL DEFAULT 0,
  completed_count INT NOT NULL DEFAULT 0,
  effectiveness_score NUMERIC,
  hallucination_risk NUMERIC,
  summary JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluations TO anon, authenticated;
GRANT ALL ON public.evaluations TO service_role;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all evaluations" ON public.evaluations FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  idx INT NOT NULL,
  category TEXT,
  user_goal TEXT NOT NULL,
  expected_behavior TEXT,
  conversation JSONB,
  effectiveness NUMERIC,
  hallucination NUMERIC,
  passed BOOLEAN,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenarios TO anon, authenticated;
GRANT ALL ON public.scenarios TO service_role;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all scenarios" ON public.scenarios FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_scenarios_eval ON public.scenarios(evaluation_id, idx);
CREATE INDEX idx_evaluations_prompt ON public.evaluations(prompt_id, created_at DESC);
