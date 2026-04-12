BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT;

UPDATE public.users
SET lifecycle_status = CASE
  WHEN is_active THEN 'active'
  ELSE 'inactive'
END
WHERE lifecycle_status IS NULL;

ALTER TABLE public.users
  ALTER COLUMN lifecycle_status SET DEFAULT 'active';

ALTER TABLE public.users
  ALTER COLUMN lifecycle_status SET NOT NULL;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_lifecycle_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_lifecycle_status_check
  CHECK (lifecycle_status IN ('active', 'inactive', 'deleted'));

CREATE INDEX IF NOT EXISTS idx_users_lifecycle_status
  ON public.users(lifecycle_status);

COMMIT;
