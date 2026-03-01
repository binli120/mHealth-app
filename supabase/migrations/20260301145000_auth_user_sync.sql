BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applicants'
      AND column_name = 'user_id'
  ) THEN
    BEGIN
      ALTER TABLE public.applicants
        ADD CONSTRAINT applicants_user_id_key UNIQUE (user_id);
    EXCEPTION
      WHEN duplicate_object OR duplicate_table THEN NULL;
    END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    password_hash,
    is_active,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    'supabase_auth_managed',
    true,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    is_active = true;

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
    VALUES (
      NEW.id,
      NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.created_at, now())
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      first_name = COALESCE(EXCLUDED.first_name, public.applicants.first_name),
      last_name = COALESCE(EXCLUDED.last_name, public.applicants.last_name),
      phone = COALESCE(EXCLUDED.phone, public.applicants.phone);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

COMMIT;
