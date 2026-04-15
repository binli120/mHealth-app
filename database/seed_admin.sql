/**
 * Seed admin account: no-reply@healthcompass.cloud / password
 * Run after mHealth_schema.sql in local development
 * @author Bin Lee
 */

DO $$
DECLARE
  v_user_id UUID;
  v_admin_role_id INT;
  v_email TEXT := 'no-reply@healthcompass.cloud';
  v_password TEXT := 'password';
  v_instance_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Create auth user
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change_token_current,
      reauthentication_token, email_change, phone_change, phone_change_token,
      email_change_confirm_status,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, is_sso_user, is_anonymous
    )
    VALUES (
      v_instance_id, gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt(v_password, gen_salt('bf', 10)), now(),
      '', '', '', '', '', '', '', '', 0,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'email', v_email,
        'first_name', 'Admin',
        'last_name', 'User',
        'email_verified', true,
        'phone_verified', false
      ),
      now(), now(), false, false
    )
    RETURNING id INTO v_user_id;

    -- Identity row
    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_user_id::text, v_user_id,
      jsonb_build_object('sub', v_user_id, 'email', v_email, 'email_verified', true),
      'email', now(), now()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;

  ELSE
    -- Update existing auth user password
    UPDATE auth.users
    SET encrypted_password = crypt(v_password, gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Sync public.users
  INSERT INTO public.users (id, email, password_hash, is_active, created_at)
  VALUES (v_user_id, v_email, 'supabase_auth_managed', true, now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, is_active = true;

  -- Assign admin role
  SELECT id INTO v_admin_role_id FROM public.roles WHERE name = 'admin';
  IF v_admin_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_user_id, v_admin_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Admin user seeded: % (id: %)', v_email, v_user_id;
END;
$$;
