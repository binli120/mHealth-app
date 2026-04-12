/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"

import { getDbPool } from "@/lib/db/server"
import { isLocalAuthHelperEnabled, normalizeAuthEmail } from "@/lib/auth/local-auth"

interface DevResetPasswordRequestBody {
  email?: string
  password?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export async function POST(request: Request) {
  if (!isLocalAuthHelperEnabled()) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as DevResetPasswordRequestBody
    const email = normalizeAuthEmail(body.email ?? "")
    const password = body.password ?? ""

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { ok: false, error: "A valid email is required." },
        { status: 400 },
      )
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      )
    }

    const pool = getDbPool()
    const result = await pool.query(
      `
        WITH target_user AS (
          SELECT id
          FROM auth.users
          WHERE deleted_at IS NULL
            AND lower(email) = $1
          ORDER BY created_at DESC
          LIMIT 1
        ),
        updated_user AS (
          UPDATE auth.users au
          SET
            encrypted_password = crypt($2, gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(au.email_confirmed_at, now()),
            raw_user_meta_data = jsonb_set(
              COALESCE(au.raw_user_meta_data, '{}'::jsonb),
              '{email_verified}',
              'true'::jsonb,
              true
            ),
            updated_at = now()
          FROM target_user tu
          WHERE au.id = tu.id
          RETURNING au.id
        ),
        updated_identity AS (
          UPDATE auth.identities ai
          SET
            identity_data = jsonb_set(
              COALESCE(ai.identity_data, '{}'::jsonb),
              '{email_verified}',
              'true'::jsonb,
              true
            ),
            updated_at = now()
          FROM target_user tu
          WHERE ai.user_id = tu.id
            AND ai.provider = 'email'
          RETURNING ai.user_id
        )
        SELECT id
        FROM updated_user
      `,
      [email, password],
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { ok: false, error: "User not found in auth.users." },
        { status: 404 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "Unknown server error"
        : "Unable to reset password"

    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
