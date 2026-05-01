import { NextResponse } from "next/server"
import { clearAdminPasskeySessionCookie } from "@/lib/auth/passkey-session"

export const runtime = "nodejs"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  clearAdminPasskeySessionCookie(response)
  return response
}
