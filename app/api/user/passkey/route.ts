/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { listPasskeysForUser } from "@/lib/auth/user-passkeys"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  try {
    const passkeys = await listPasskeysForUser(authResult.userId)
    return NextResponse.json({
      ok: true,
      passkeys: passkeys.map((p) => ({
        id: p.id,
        name: p.name,
        device_type: p.device_type,
        backed_up: p.backed_up,
        created_at: p.created_at,
      })),
    })
  } catch {
    // Table may not exist yet if migration hasn't been applied — return empty list.
    return NextResponse.json({ ok: true, passkeys: [] })
  }
}
