/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db/server"
import { isLocalAuthHelperEnabled, normalizeAuthEmail } from "@/lib/auth/local-auth"

interface DevAutoConfirmRequestBody {
  userId?: string
  email?: string
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  if (!isLocalAuthHelperEnabled()) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as DevAutoConfirmRequestBody
    const userId = body.userId?.trim()
    const email = body.email ? normalizeAuthEmail(body.email) : undefined

    if (!userId && !email) {
      return NextResponse.json(
        { ok: false, error: "Either userId or email is required." },
        { status: 400 },
      )
    }

    if (userId && !UUID_PATTERN.test(userId)) {
      return NextResponse.json(
        { ok: false, error: "userId must be a UUID." },
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
            AND (
              ($1::uuid IS NOT NULL AND id = $1::uuid)
              OR ($2::text IS NOT NULL AND lower(email) = lower($2::text))
            )
          ORDER BY created_at DESC
          LIMIT 1
        ),
        updated_user AS (
          UPDATE auth.users au
          SET
            email_confirmed_at = COALESCE(au.email_confirmed_at, now()),
            raw_user_meta_data = jsonb_set(
              COALESCE(au.raw_user_meta_data, '{}'::jsonb),
              '{email_verified}',
              'true'::jsonb,
              true
            )
          FROM target_user tu
          WHERE au.id = tu.id
          RETURNING au.id, au.email_confirmed_at
        ),
        updated_identity AS (
          UPDATE auth.identities ai
          SET identity_data = jsonb_set(
            COALESCE(ai.identity_data, '{}'::jsonb),
            '{email_verified}',
            'true'::jsonb,
            true
          )
          FROM target_user tu
          WHERE ai.user_id = tu.id
            AND ai.provider = 'email'
          RETURNING ai.user_id
        )
        SELECT
          uu.id,
          uu.email_confirmed_at
        FROM updated_user uu
      `,
      [userId ?? null, email ?? null],
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { ok: false, error: "User not found in auth.users." },
        { status: 404 },
      )
    }

    return NextResponse.json({
      ok: true,
      userId: result.rows[0]?.id ?? userId ?? null,
      emailConfirmedAt: result.rows[0]?.email_confirmed_at ?? null,
    })
  } catch (error) {
    const message =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "Unknown server error"
        : "Unable to auto-confirm user"

    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
