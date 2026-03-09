BEGIN;

INSERT INTO public.users (
  id,
  email,
  password_hash,
  is_active,
  created_at
)
SELECT
  au.id,
  au.email::text,
  'supabase_auth_managed',
  true,
  COALESCE(au.created_at, now())
FROM auth.users au
WHERE au.email IS NOT NULL
  AND au.email <> ''
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  is_active = true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applicants'
      AND column_name = 'user_id'
  ) THEN
    INSERT INTO public.applicants (
      user_id,
      first_name,
      last_name,
      phone,
      created_at
    )
    SELECT
      au.id,
      NULLIF(au.raw_user_meta_data->>'first_name', ''),
      NULLIF(au.raw_user_meta_data->>'last_name', ''),
      NULLIF(au.raw_user_meta_data->>'phone', ''),
      COALESCE(au.created_at, now())
    FROM auth.users au
    INNER JOIN public.users pu
      ON pu.id = au.id
    ON CONFLICT (user_id) DO UPDATE
    SET
      first_name = COALESCE(EXCLUDED.first_name, public.applicants.first_name),
      last_name = COALESCE(EXCLUDED.last_name, public.applicants.last_name),
      phone = COALESCE(EXCLUDED.phone, public.applicants.phone);
  END IF;
END $$;

COMMIT;
