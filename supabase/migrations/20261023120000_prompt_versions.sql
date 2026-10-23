CREATE TABLE IF NOT EXISTS public.prompt_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prompt_versions_prompt_version_unique UNIQUE (prompt_id, version_number)
);

CREATE INDEX IF NOT EXISTS prompt_versions_owner_prompt_idx
  ON public.prompt_versions(user_id, prompt_id, version_number DESC);

ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prompt_versions FROM anon, authenticated;
GRANT SELECT ON public.prompt_versions TO authenticated;
GRANT ALL ON public.prompt_versions TO service_role;

CREATE POLICY "Users can read their own prompt versions"
  ON public.prompt_versions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS prompt_version_id UUID
  REFERENCES public.prompt_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS evaluations_prompt_version_idx
  ON public.evaluations(prompt_version_id);

-- The application writes versions through this transaction. The user ID comes
-- from a verified Supabase claim in a server function, never from the browser.
CREATE OR REPLACE FUNCTION public.save_prompt_version(
  p_user_id UUID,
  p_prompt_id UUID,
  p_payload JSONB,
  p_change_note TEXT DEFAULT NULL
)
RETURNS TABLE(prompt_id UUID, version_id UUID, version_number INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prompt_id UUID;
  v_last_version_id UUID;
  v_last_version_number INTEGER;
  v_last_snapshot JSONB;
  v_version_number INTEGER;
  v_version_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_PROMPT_PAYLOAD';
  END IF;

  IF COALESCE(length(trim(p_payload->>'name')), 0) = 0 THEN
    RAISE EXCEPTION 'PROMPT_NAME_REQUIRED';
  END IF;

  IF p_prompt_id IS NULL THEN
    INSERT INTO public.prompts (
      user_id, name, system_prompt, model, agent_type, begin_message, stages, variables
    ) VALUES (
      p_user_id,
      p_payload->>'name',
      COALESCE(p_payload->>'system_prompt', ''),
      COALESCE(p_payload->>'model', 'google/gemini-3-flash-preview'),
      COALESCE(p_payload->>'agent_type', 'chat'),
      COALESCE(p_payload->>'begin_message', ''),
      COALESCE(p_payload->'stages', '[]'::jsonb),
      COALESCE(p_payload->'variables', '{}'::jsonb)
    )
    RETURNING id INTO v_prompt_id;
  ELSE
    UPDATE public.prompts
       SET name = p_payload->>'name',
           system_prompt = COALESCE(p_payload->>'system_prompt', ''),
           model = COALESCE(p_payload->>'model', 'google/gemini-3-flash-preview'),
           agent_type = COALESCE(p_payload->>'agent_type', 'chat'),
           begin_message = COALESCE(p_payload->>'begin_message', ''),
           stages = COALESCE(p_payload->'stages', '[]'::jsonb),
           variables = COALESCE(p_payload->'variables', '{}'::jsonb),
           updated_at = now()
     WHERE id = p_prompt_id AND user_id = p_user_id
     RETURNING id INTO v_prompt_id;

    IF v_prompt_id IS NULL THEN
      RAISE EXCEPTION 'PROMPT_NOT_FOUND';
    END IF;
  END IF;

  SELECT pv.id, pv.version_number, pv.snapshot
    INTO v_last_version_id, v_last_version_number, v_last_snapshot
    FROM public.prompt_versions pv
   WHERE pv.prompt_id = v_prompt_id AND pv.user_id = p_user_id
   ORDER BY pv.version_number DESC
   LIMIT 1;

  -- Repeatedly clicking Save without changing the configuration does not
  -- create meaningless duplicate versions.
  IF v_last_version_id IS NOT NULL AND v_last_snapshot = p_payload THEN
    RETURN QUERY SELECT v_prompt_id, v_last_version_id, v_last_version_number;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(pv.version_number), 0) + 1
    INTO v_version_number
    FROM public.prompt_versions pv
   WHERE pv.prompt_id = v_prompt_id AND pv.user_id = p_user_id;

  INSERT INTO public.prompt_versions (
    prompt_id, user_id, version_number, snapshot, change_note
  ) VALUES (
    v_prompt_id, p_user_id, v_version_number, p_payload, p_change_note
  )
  RETURNING id INTO v_version_id;

  RETURN QUERY SELECT v_prompt_id, v_version_id, v_version_number;
END;
$$;

REVOKE ALL ON FUNCTION public.save_prompt_version(UUID, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_prompt_version(UUID, UUID, JSONB, TEXT) TO service_role;
