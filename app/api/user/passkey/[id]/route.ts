/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { deleteUserPasskey } from "@/lib/auth/user-passkeys"

export const runtime = "nodejs"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const { id } = await params
  const deleted = await deleteUserPasskey(authResult.userId, id)
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "Passkey not found." }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
