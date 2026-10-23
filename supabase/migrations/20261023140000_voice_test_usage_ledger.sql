CREATE TABLE IF NOT EXISTS public.voice_credit_accounts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.voice_usage_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'GRANT', 'RESERVATION_HOLD', 'RESERVATION_RELEASE', 'USAGE_CHARGE',
    'ADMIN_ADJUSTMENT', 'REVERSAL'
  )),
  amount_seconds INTEGER NOT NULL,
  session_id UUID REFERENCES public.voice_sessions(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT voice_usage_ledger_user_key_unique UNIQUE(user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS voice_usage_ledger_user_created_idx
  ON public.voice_usage_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.voice_usage_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.voice_sessions(id) ON DELETE CASCADE,
  reserved_seconds INTEGER NOT NULL CHECK (reserved_seconds > 0),
  consumed_seconds INTEGER CHECK (consumed_seconds IS NULL OR consumed_seconds >= 0),
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'reconciled', 'released', 'failed')),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ,
  CONSTRAINT voice_usage_reservation_session_unique UNIQUE(session_id),
  CONSTRAINT voice_usage_reservation_user_key_unique UNIQUE(user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS voice_usage_reservations_user_status_idx
  ON public.voice_usage_reservations(user_id, status, created_at);

ALTER TABLE public.voice_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_usage_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voice_credit_accounts FROM anon, authenticated;
REVOKE ALL ON public.voice_usage_ledger FROM anon, authenticated;
REVOKE ALL ON public.voice_usage_reservations FROM anon, authenticated;
GRANT ALL ON public.voice_credit_accounts TO service_role;
GRANT ALL ON public.voice_usage_ledger TO service_role;
GRANT ALL ON public.voice_usage_reservations TO service_role;

-- Amounts are signed deltas to available pilot test-seconds. A reservation hold
-- subtracts the maximum allowed duration. Finalization posts a negative charge
-- for actual observed duration and returns the full hold; final net usage equals
-- the charge. These seconds are an operational cap, not a dollar/provider-cost
-- estimate. OpenAI usage is billed separately by OpenAI.
CREATE OR REPLACE FUNCTION public.grant_voice_test_seconds(
  p_user_id UUID,
  p_actor_user_id UUID,
  p_amount_seconds INTEGER,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS TABLE(ledger_id UUID, available_seconds BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger_id UUID;
  v_existing_amount INTEGER;
  v_balance BIGINT;
BEGIN
  IF p_user_id IS NULL OR p_actor_user_id IS NULL
     OR p_amount_seconds < 1 OR p_amount_seconds > 86400
     OR length(trim(COALESCE(p_reason, ''))) < 3
     OR length(trim(COALESCE(p_idempotency_key, ''))) < 1 THEN
    RAISE EXCEPTION 'INVALID_CREDIT_GRANT';
  END IF;

  INSERT INTO public.voice_credit_accounts(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.voice_credit_accounts WHERE user_id = p_user_id FOR UPDATE;

  SELECT l.id, l.amount_seconds INTO v_ledger_id, v_existing_amount
    FROM public.voice_usage_ledger l
   WHERE l.user_id = p_user_id AND l.idempotency_key = p_idempotency_key;

  IF v_ledger_id IS NOT NULL AND v_existing_amount <> p_amount_seconds THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_AMOUNT';
  END IF;

  IF v_ledger_id IS NULL THEN
    INSERT INTO public.voice_usage_ledger (
      user_id, entry_type, amount_seconds, idempotency_key, actor_user_id, reason
    ) VALUES (
      p_user_id, 'GRANT', p_amount_seconds, p_idempotency_key, p_actor_user_id, trim(p_reason)
    )
    RETURNING id INTO v_ledger_id;
  END IF;

  SELECT COALESCE(SUM(l.amount_seconds), 0) INTO v_balance
    FROM public.voice_usage_ledger l WHERE l.user_id = p_user_id;
  RETURN QUERY SELECT v_ledger_id, v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_voice_test_seconds(
  p_user_id UUID,
  p_session_id UUID,
  p_reserved_seconds INTEGER,
  p_idempotency_key TEXT
)
RETURNS TABLE(reservation_id UUID, available_seconds BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_id UUID;
  v_balance BIGINT;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL
     OR p_reserved_seconds < 1 OR p_reserved_seconds > 1800
     OR length(trim(COALESCE(p_idempotency_key, ''))) < 1 THEN
    RAISE EXCEPTION 'INVALID_TEST_RESERVATION';
  END IF;

  INSERT INTO public.voice_credit_accounts(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.voice_credit_accounts WHERE user_id = p_user_id FOR UPDATE;

  SELECT r.id INTO v_reservation_id
    FROM public.voice_usage_reservations r
   WHERE r.user_id = p_user_id AND r.session_id = p_session_id;
  IF v_reservation_id IS NOT NULL THEN
    SELECT COALESCE(SUM(l.amount_seconds), 0) INTO v_balance
      FROM public.voice_usage_ledger l WHERE l.user_id = p_user_id;
    RETURN QUERY SELECT v_reservation_id, v_balance;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(l.amount_seconds), 0) INTO v_balance
    FROM public.voice_usage_ledger l WHERE l.user_id = p_user_id;
  IF v_balance < p_reserved_seconds THEN
    RAISE EXCEPTION 'INSUFFICIENT_TEST_SECONDS';
  END IF;

  INSERT INTO public.voice_usage_reservations (
    user_id, session_id, reserved_seconds, status, idempotency_key
  ) VALUES (
    p_user_id, p_session_id, p_reserved_seconds, 'held', p_idempotency_key
  )
  RETURNING id INTO v_reservation_id;

  INSERT INTO public.voice_usage_ledger (
    user_id, entry_type, amount_seconds, session_id, idempotency_key, actor_user_id, reason
  ) VALUES (
    p_user_id, 'RESERVATION_HOLD', -p_reserved_seconds, p_session_id,
    p_idempotency_key || ':hold', p_user_id, 'Reserved maximum live voice test duration'
  );

  SELECT COALESCE(SUM(l.amount_seconds), 0) INTO v_balance
    FROM public.voice_usage_ledger l WHERE l.user_id = p_user_id;
  RETURN QUERY SELECT v_reservation_id, v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_voice_test_seconds(
  p_user_id UUID,
  p_session_id UUID,
  p_consumed_seconds INTEGER,
  p_idempotency_key TEXT
)
RETURNS TABLE(reservation_id UUID, consumed_seconds INTEGER, available_seconds BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.voice_usage_reservations%ROWTYPE;
  v_consumed INTEGER;
  v_balance BIGINT;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_consumed_seconds < 0
     OR length(trim(COALESCE(p_idempotency_key, ''))) < 1 THEN
    RAISE EXCEPTION 'INVALID_TEST_RECONCILIATION';
  END IF;

  INSERT INTO public.voice_credit_accounts(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.voice_credit_accounts WHERE user_id = p_user_id FOR UPDATE;

  SELECT * INTO v_reservation
    FROM public.voice_usage_reservations r
   WHERE r.user_id = p_user_id AND r.session_id = p_session_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEST_RESERVATION_NOT_FOUND'; END IF;

  IF v_reservation.status <> 'held' THEN
    SELECT COALESCE(SUM(l.amount_seconds), 0) INTO v_balance
      FROM public.voice_usage_ledger l WHERE l.user_id = p_user_id;
    RETURN QUERY SELECT v_reservation.id, COALESCE(v_reservation.consumed_seconds, 0), v_balance;
    RETURN;
  END IF;

  v_consumed := LEAST(p_consumed_seconds, v_reservation.reserved_seconds);

  UPDATE public.voice_usage_reservations
     SET status = 'reconciled', consumed_seconds = v_consumed, finalized_at = now()
   WHERE id = v_reservation.id;

  INSERT INTO public.voice_usage_ledger (
    user_id, entry_type, amount_seconds, session_id, idempotency_key, actor_user_id, reason
  ) VALUES (
    p_user_id, 'USAGE_CHARGE', -v_consumed, p_session_id,
    p_idempotency_key || ':charge', p_user_id, 'Observed live voice test duration'
  ) ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  INSERT INTO public.voice_usage_ledger (
    user_id, entry_type, amount_seconds, session_id, idempotency_key, actor_user_id, reason
  ) VALUES (
    p_user_id, 'RESERVATION_RELEASE', v_reservation.reserved_seconds, p_session_id,
    p_idempotency_key || ':release', p_user_id, 'Release unused reserved live voice duration'
  ) ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  SELECT COALESCE(SUM(l.amount_seconds), 0) INTO v_balance
    FROM public.voice_usage_ledger l WHERE l.user_id = p_user_id;
  RETURN QUERY SELECT v_reservation.id, v_consumed, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_voice_test_seconds(UUID, UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_voice_test_seconds(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_voice_test_seconds(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_voice_test_seconds(UUID, UUID, INTEGER, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_voice_test_seconds(UUID, UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_voice_test_seconds(UUID, UUID, INTEGER, TEXT) TO service_role;


CREATE OR REPLACE FUNCTION public.get_voice_usage_summary(p_user_id UUID)
RETURNS TABLE(balance_seconds BIGINT, reserved_seconds BIGINT, granted_seconds BIGINT, used_seconds BIGINT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(l.amount_seconds), 0) AS balance_seconds,
    COALESCE((
      SELECT SUM(r.reserved_seconds)
        FROM public.voice_usage_reservations r
       WHERE r.user_id = p_user_id AND r.status = 'held'
    ), 0) AS reserved_seconds,
    COALESCE(SUM(CASE
      WHEN l.entry_type = 'GRANT' THEN l.amount_seconds
      WHEN l.entry_type = 'ADMIN_ADJUSTMENT' AND l.amount_seconds > 0 THEN l.amount_seconds
      ELSE 0
    END), 0) AS granted_seconds,
    COALESCE(SUM(CASE WHEN l.entry_type = 'USAGE_CHARGE' THEN -l.amount_seconds ELSE 0 END), 0) AS used_seconds
  FROM public.voice_usage_ledger l
  WHERE l.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_voice_usage_summary(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_voice_usage_summary(UUID) TO service_role;
