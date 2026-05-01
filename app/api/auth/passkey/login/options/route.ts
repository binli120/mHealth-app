import { generateAuthenticationOptions } from "@simplewebauthn/server"
import { NextResponse } from "next/server"
import { getAdminUserByEmail, listAdminPasskeysForUser } from "@/lib/auth/admin-passkeys"
import {
  ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE,
  getWebAuthnRp,
  setPasskeyChallengeCookie,
} from "@/lib/auth/passkey-webauthn"
import { normalizeAuthEmail } from "@/lib/auth/local-auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { email?: string }
  const email = normalizeAuthEmail(payload.email ?? "")
  if (!email) {
    return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 })
  }

  const admin = await getAdminUserByEmail(email)
  if (!admin) {
    return NextResponse.json({ ok: false, error: "No admin passkey is available for this email." }, { status: 404 })
  }

  const credentials = await listAdminPasskeysForUser(admin.id)
  if (credentials.length === 0) {
    return NextResponse.json({ ok: false, error: "No admin passkey is available for this email." }, { status: 404 })
  }

  const { rpID } = getWebAuthnRp(request)
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: credentials.map((credential) => ({
      id: credential.credential_id,
      transports: credential.transports as never,
    })),
  })

  const response = NextResponse.json({ ok: true, options })
  setPasskeyChallengeCookie(response, ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE, {
    challenge: options.challenge,
    email: admin.email,
    userId: admin.id,
  })
  return response
}
