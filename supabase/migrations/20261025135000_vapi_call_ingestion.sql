CREATE TABLE IF NOT EXISTS public.voice_agent_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'vapi' CHECK (provider = 'vapi'),
  display_name TEXT NOT NULL DEFAULT 'Vapi',
  webhook_secret_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  store_transcripts BOOLEAN NOT NULL DEFAULT false,
  last_event_at TIMESTAMPTZ,
  last_event_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT voice_agent_integrations_user_provider_unique UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS voice_agent_integrations_provider_status_idx
  ON public.voice_agent_integrations(provider, status);

CREATE TABLE IF NOT EXISTS public.voice_agent_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.voice_agent_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'vapi' CHECK (provider = 'vapi'),
  provider_call_id TEXT NOT NULL,
  assistant_id TEXT,
  call_type TEXT,
  status TEXT NOT NULL DEFAULT 'ended' CHECK (status IN ('ended', 'failed', 'unknown')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  ended_reason TEXT,
  cost NUMERIC(12, 6) CHECK (cost IS NULL OR cost >= 0),
  summary TEXT,
  analysis_data JSONB,
  transcript TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT voice_agent_calls_integration_call_unique UNIQUE (integration_id, provider_call_id)
);

CREATE INDEX IF NOT EXISTS voice_agent_calls_user_ended_idx
  ON public.voice_agent_calls(user_id, ended_at DESC);

CREATE INDEX IF NOT EXISTS voice_agent_calls_assistant_idx
  ON public.voice_agent_calls(user_id, assistant_id, ended_at DESC);

ALTER TABLE public.voice_agent_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_agent_calls ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.voice_agent_integrations FROM anon, authenticated;
REVOKE ALL ON public.voice_agent_calls FROM anon, authenticated;
GRANT ALL ON public.voice_agent_integrations TO service_role;
GRANT ALL ON public.voice_agent_calls TO service_role;

COMMENT ON TABLE public.voice_agent_integrations IS
  'User-owned Vapi integration settings. Only a SHA-256 digest of the webhook secret is stored.';
COMMENT ON COLUMN public.voice_agent_integrations.store_transcripts IS
  'Explicit user opt-in to persist completed-call transcript text from the Vapi webhook.';
COMMENT ON TABLE public.voice_agent_calls IS
  'User-owned imported Vapi end-of-call reports. Recording URLs and raw webhook bodies are intentionally not stored.';
