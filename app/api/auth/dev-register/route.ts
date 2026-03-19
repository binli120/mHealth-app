/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db/server"
import { isLocalAuthHelperEnabled, normalizeAuthEmail } from "@/lib/auth/local-auth"

interface DevRegisterRequestBody {
  email?: string
  password?: string
  firstName?: string
  lastName?: string
  phone?: string
}

const MIN_PASSWORD_LENGTH = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_INSTANCE_ID = "00000000-0000-0000-0000-000000000000"

function sanitizeText(value?: string): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!isLocalAuthHelperEnabled()) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as DevRegisterRequestBody
  const emailRaw = body.email ?? ""
  const password = body.password ?? ""
  const firstName = sanitizeText(body.firstName)
  const lastName = sanitizeText(body.lastName)
  const phone = sanitizeText(body.phone)
  const email = normalizeAuthEmail(emailRaw)

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 })
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    )
  }

  const pool = getDbPool()
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const existingResult = await client.query<{ id: string }>(
      `
        SELECT id
        FROM auth.users
        WHERE deleted_at IS NULL
          AND lower(email) = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [email],
    )

    const userId = existingResult.rows[0]?.id ?? null
    const appMeta = {
      provider: "email",
      providers: ["email"],
    }
    const userMeta = {
      sub: userId ?? undefined,
      email,
      phone: phone ?? "",
      first_name: firstName ?? "",
      last_name: lastName ?? "",
      email_verified: true,
      phone_verified: false,
    }

    let resolvedUserId = userId

    if (!resolvedUserId) {
      const createResult = await client.query<{ id: string }>(
        `
          INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change_token_current,
            reauthentication_token,
            email_change,
            phone_change,
            phone_change_token,
            email_change_confirm_status,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            phone,
            is_sso_user,
            is_anonymous
          )
          VALUES (
            $1::uuid,
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            $2,
            crypt($3, gen_salt('bf', 10)),
            now(),
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            0,
            $4::jsonb,
            $5::jsonb,
            now(),
            now(),
            NULLIF($6, ''),
            false,
            false
          )
          RETURNING id
        `,
        [
          DEFAULT_INSTANCE_ID,
          email,
          password,
          JSON.stringify(appMeta),
          JSON.stringify(userMeta),
          phone ?? "",
        ],
      )

      resolvedUserId = createResult.rows[0]?.id ?? null
    } else {
      const mergedUserMeta = {
        ...userMeta,
        sub: resolvedUserId,
      }

      await client.query(
        `
          UPDATE auth.users
          SET
            instance_id = COALESCE(instance_id, $2::uuid),
            aud = 'authenticated',
            role = 'authenticated',
            encrypted_password = crypt($3, gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            confirmation_token = COALESCE(confirmation_token, ''),
            recovery_token = COALESCE(recovery_token, ''),
            email_change_token_new = COALESCE(email_change_token_new, ''),
            email_change_token_current = COALESCE(email_change_token_current, ''),
            reauthentication_token = COALESCE(reauthentication_token, ''),
            email_change = COALESCE(email_change, ''),
            phone_change = COALESCE(phone_change, ''),
            phone_change_token = COALESCE(phone_change_token, ''),
            email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
            raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || $4::jsonb,
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || $5::jsonb,
            updated_at = now(),
            phone = NULLIF($6, ''),
            is_sso_user = COALESCE(is_sso_user, false),
            is_anonymous = COALESCE(is_anonymous, false)
          WHERE id = $1::uuid
        `,
        [
          resolvedUserId,
          DEFAULT_INSTANCE_ID,
          password,
          JSON.stringify(appMeta),
          JSON.stringify(mergedUserMeta),
          phone ?? "",
        ],
      )
    }

    if (!resolvedUserId) {
      throw new Error("Unable to create local auth user.")
    }

    await client.query(
      `
        INSERT INTO auth.identities (
          id,
          provider_id,
          user_id,
          identity_data,
          provider,
          created_at,
          updated_at
        )
        VALUES (
          gen_random_uuid(),
          $1::text,
          $1::uuid,
          $2::jsonb,
          'email',
          now(),
          now()
        )
        ON CONFLICT (provider_id, provider)
        DO UPDATE SET
          identity_data = EXCLUDED.identity_data,
          updated_at = now()
      `,
      [
        resolvedUserId,
        JSON.stringify({
          sub: resolvedUserId,
          email,
          phone: phone ?? "",
          first_name: firstName ?? "",
          last_name: lastName ?? "",
          email_verified: true,
          phone_verified: false,
        }),
      ],
    )

    // Ensure app tables are in sync even if trigger was missed.
    await client.query(
      `
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
        WHERE au.id = $1::uuid
        ON CONFLICT (id) DO UPDATE
        SET
          email = EXCLUDED.email,
          is_active = true
      `,
      [resolvedUserId],
    )

    await client.query(
      `
        INSERT INTO public.applicants (
          user_id,
          first_name,
          last_name,
          phone,
          created_at
        )
        VALUES (
          $1::uuid,
          NULLIF($2, ''),
          NULLIF($3, ''),
          NULLIF($4, ''),
          now()
        )
        ON CONFLICT (user_id) DO UPDATE
        SET
          first_name = COALESCE(EXCLUDED.first_name, public.applicants.first_name),
          last_name = COALESCE(EXCLUDED.last_name, public.applicants.last_name),
          phone = COALESCE(EXCLUDED.phone, public.applicants.phone)
      `,
      [resolvedUserId, firstName ?? "", lastName ?? "", phone ?? ""],
    )

    await client.query("COMMIT")

    return NextResponse.json({
      ok: true,
      userId: resolvedUserId,
      email,
    })
  } catch (error) {
    await client.query("ROLLBACK")
    const message =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "Unknown server error"
        : "Unable to create local user"

    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  } finally {
    client.release()
  }
}
