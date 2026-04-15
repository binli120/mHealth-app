/**
 * Dev-only endpoint: grants admin role to the currently authenticated user.
 * Only active when local auth helpers are enabled (development mode).
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { isLocalAuthHelperEnabled } from "@/lib/auth/local-auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!isLocalAuthHelperEnabled()) {
    return NextResponse.json({ ok: false, error: "Not available in production." }, { status: 404 })
  }

  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const pool = getDbPool()

  // Ensure public.users row exists
  await pool.query(
    `
      INSERT INTO public.users (id, email, password_hash, is_active, created_at)
      SELECT au.id, au.email, 'supabase_auth_managed', true, COALESCE(au.created_at, now())
      FROM auth.users au
      WHERE au.id = $1::uuid
      ON CONFLICT (id) DO UPDATE SET is_active = true
    `,
    [authResult.userId],
  )

  // Debug: show all existing roles
  const allRoles = await pool.query(`SELECT id, name FROM public.roles`)
  console.log("[dev-grant-admin] all roles in DB:", allRoles.rows)

  // Ensure the 'admin' role row exists
  await pool.query(
    `INSERT INTO public.roles (name) VALUES ('admin') ON CONFLICT (name) DO NOTHING`,
  )

  // Ensure the 'social_worker' role row exists too
  await pool.query(
    `INSERT INTO public.roles (name) VALUES ('social_worker') ON CONFLICT (name) DO NOTHING`,
  )

  // Assign admin role
  const insertResult = await pool.query(
    `
      INSERT INTO public.user_roles (user_id, role_id)
      SELECT $1::uuid, r.id FROM public.roles r WHERE r.name = 'admin'
      ON CONFLICT DO NOTHING
      RETURNING user_id, role_id
    `,
    [authResult.userId],
  )
  console.log("[dev-grant-admin] userId:", authResult.userId)
  console.log("[dev-grant-admin] insert result:", insertResult.rows)
  console.log("[dev-grant-admin] rowCount:", insertResult.rowCount)

  // Verify the role was actually inserted
  const verify = await pool.query(
    `SELECT ur.user_id, r.name FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = $1::uuid`,
    [authResult.userId],
  )
  console.log("[dev-grant-admin] verified roles:", verify.rows)

  return NextResponse.json({ ok: true, message: "Admin role granted.", roles: verify.rows })
}
