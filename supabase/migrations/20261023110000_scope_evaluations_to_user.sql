-- New evaluations must have an owner. Existing rows remain nullable so the
-- migration is additive; unowned legacy evaluations are intentionally not
-- exposed to arbitrary users and can be backfilled only after ownership review.
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS evaluations_user_created_idx
  ON public.evaluations(user_id, created_at DESC);

COMMENT ON COLUMN public.evaluations.user_id IS
  'Owner for tenant-scoped reads. NULL is reserved for legacy rows awaiting an audited ownership backfill.';
