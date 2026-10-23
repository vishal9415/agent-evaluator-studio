CREATE TABLE IF NOT EXISTS public.voice_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'openai-realtime',
  provider_call_id TEXT,
  status TEXT NOT NULL DEFAULT 'connecting'
    CHECK (status IN ('connecting', 'active', 'ended', 'error', 'cancelled')),
  model TEXT NOT NULL,
  voice TEXT NOT NULL,
  prompt_fingerprint TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  connected_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_sessions_user_started_idx
  ON public.voice_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.voice_session_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.voice_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (length(event_type) <= 100),
  source TEXT NOT NULL CHECK (source IN ('browser', 'provider', 'adapter', 'simulator')),
  client_elapsed_ms INTEGER CHECK (client_elapsed_ms IS NULL OR client_elapsed_ms >= 0),
  measurement_status TEXT NOT NULL DEFAULT 'measured'
    CHECK (measurement_status IN ('measured', 'estimated', 'unavailable')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT voice_session_events_session_event_unique UNIQUE(session_id, event_key)
);

CREATE INDEX IF NOT EXISTS voice_session_events_timeline_idx
  ON public.voice_session_events(session_id, received_at);

ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_session_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voice_sessions FROM anon, authenticated;
REVOKE ALL ON public.voice_session_events FROM anon, authenticated;
GRANT ALL ON public.voice_sessions TO service_role;
GRANT ALL ON public.voice_session_events TO service_role;

COMMENT ON TABLE public.voice_sessions IS
  'Session metadata only. Raw audio and transcript text are not persisted by the MVP.';
COMMENT ON TABLE public.voice_session_events IS
  'Deduplicated timing/event metadata. Event detail and transcript payloads are intentionally not stored.';
