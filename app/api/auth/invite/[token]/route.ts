/**
 * GET  /api/auth/invite/[token]  — verify the token is valid (public, no auth needed)
 * POST /api/auth/invite/[token]  — accept the invitation: create account + set password
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db/server"
import { getInvitationByToken, acceptInvitation } from "@/lib/db/invitations"

export const runtime = "nodejs"

const DEFAULT_INSTANCE_ID = "00000000-0000-0000-0000-000000000000"

// ── GET: verify token ─────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    return NextResponse.json({ ok: false, error: "Invitation not found." }, { status: 404 })
  }
  if (invitation.accepted_at) {
    return NextResponse.json({ ok: false, error: "This invitation has already been used." }, { status: 410 })
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "This invitation has expired." }, { status: 410 })
  }

  return NextResponse.json({
    ok: true,
    invitation: {
      email: invitation.email,
      company_id: invitation.company_id,
      company_name: invitation.company_name,
      role: invitation.role,
      expires_at: invitation.expires_at,
    },
  })
}

// ── POST: accept invitation ───────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const body = (await request.json().catch(() => ({}))) as {
    firstName?: string
    lastName?: string
    password?: string
  }

  // Validate inputs
  if (!body.password || body.password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 8 characters." },
      { status: 400 },
    )
  }

  // Verify invitation
  const invitation = await getInvitationByToken(token)
  if (!invitation) {
    return NextResponse.json({ ok: false, error: "Invitation not found." }, { status: 404 })
  }
  if (invitation.accepted_at) {
    return NextResponse.json({ ok: false, error: "This invitation has already been used." }, { status: 410 })
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "This invitation has expired." }, { status: 410 })
  }

  const email = invitation.email
  const firstName = body.firstName?.trim() || null
  const lastName = body.lastName?.trim() || null
  const password = body.password

  const pool = getDbPool()
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // Check if auth user already exists for this email
    const existingAuth = await client.query<{ id: string }>(
      `SELECT id FROM auth.users WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`,
      [email.toLowerCase()],
    )

    let resolvedUserId: string | null = existingAuth.rows[0]?.id ?? null

    const appMeta = { provider: "email", providers: ["email"] }
    const userMeta = {
      email,
      first_name: firstName ?? "",
      last_name: lastName ?? "",
      email_verified: true,
      phone_verified: false,
    }

    if (!resolvedUserId) {
      // Create new Supabase auth user
      const createResult = await client.query<{ id: string }>(
        `
          INSERT INTO auth.users (
            instance_id, id, aud, role, email,
            encrypted_password, email_confirmed_at,
            confirmation_token, recovery_token,
            email_change_token_new, email_change_token_current,
            reauthentication_token, email_change,
            phone_change, phone_change_token,
            email_change_confirm_status,
            raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at,
            is_sso_user, is_anonymous
          ) VALUES (
            $1::uuid, gen_random_uuid(), 'authenticated', 'authenticated', $2,
            crypt($3, gen_salt('bf', 10)), now(),
            '', '', '', '', '', '', '', '', 0,
            $4::jsonb, $5::jsonb,
            now(), now(),
            false, false
          )
          RETURNING id
        `,
        [DEFAULT_INSTANCE_ID, email, password, JSON.stringify(appMeta), JSON.stringify(userMeta)],
      )
      resolvedUserId = createResult.rows[0]?.id ?? null
    } else {
      // Update existing auth user password
      await client.query(
        `
          UPDATE auth.users
          SET encrypted_password = crypt($2, gen_salt('bf', 10)),
              email_confirmed_at  = COALESCE(email_confirmed_at, now()),
              raw_user_meta_data  = COALESCE(raw_user_meta_data, '{}'::jsonb) || $3::jsonb,
              updated_at          = now()
          WHERE id = $1::uuid
        `,
        [resolvedUserId, password, JSON.stringify(userMeta)],
      )
    }

    if (!resolvedUserId) throw new Error("Failed to create auth user.")

    // Upsert auth.identities
    await client.query(
      `
        INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
        VALUES (gen_random_uuid(), $1::text, $1::uuid, $2::jsonb, 'email', now(), now())
        ON CONFLICT (provider_id, provider) DO UPDATE
          SET identity_data = EXCLUDED.identity_data, updated_at = now()
      `,
      [resolvedUserId, JSON.stringify({ sub: resolvedUserId, ...userMeta })],
    )

    // Upsert public.users with company_id from invitation
    await client.query(
      `
        INSERT INTO public.users (id, email, password_hash, is_active, company_id, created_at)
        SELECT $1::uuid, $2, 'supabase_auth_managed', true, $3, now()
        ON CONFLICT (id) DO UPDATE
          SET email      = EXCLUDED.email,
              is_active  = true,
              company_id = COALESCE(EXCLUDED.company_id, public.users.company_id)
      `,
      [resolvedUserId, email, invitation.company_id ?? null],
    )

    // Upsert public.applicants (name)
    await client.query(
      `
        INSERT INTO public.applicants (user_id, first_name, last_name, created_at)
        VALUES ($1::uuid, $2, $3, now())
        ON CONFLICT (user_id) DO UPDATE
          SET first_name = COALESCE(EXCLUDED.first_name, public.applicants.first_name),
              last_name  = COALESCE(EXCLUDED.last_name,  public.applicants.last_name)
      `,
      [resolvedUserId, firstName, lastName],
    )

    // Assign the role from the invitation
    if (invitation.role) {
      await client.query(
        `
          INSERT INTO public.roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING
        `,
        [invitation.role],
      )
      await client.query(
        `
          INSERT INTO public.user_roles (user_id, role_id)
          SELECT $1::uuid, r.id FROM public.roles r WHERE r.name = $2
          ON CONFLICT DO NOTHING
        `,
        [resolvedUserId, invitation.role],
      )
    }

    // Mark invitation accepted
    await acceptInvitation(token)

    await client.query("COMMIT")

    return NextResponse.json({ ok: true, email })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[invite/accept]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create account." },
      { status: 500 },
    )
  } finally {
    client.release()
  }
}
