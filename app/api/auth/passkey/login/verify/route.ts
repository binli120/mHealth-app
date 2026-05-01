import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server"
import { NextResponse } from "next/server"
import {
  getAdminPasskeyByCredentialId,
  isAdminUser,
  toWebAuthnCredential,
  updateAdminPasskeyCounter,
} from "@/lib/auth/admin-passkeys"
import { setAdminPasskeySessionCookie } from "@/lib/auth/passkey-session"
import {
  ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE,
  clearPasskeyChallengeCookie,
  getPasskeyChallengeState,
  getWebAuthnRp,
} from "@/lib/auth/passkey-webauthn"
import { logLoginEvent } from "@/lib/db/admin-access"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const state = getPasskeyChallengeState(request, ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE)
  if (!state?.userId || !state.email) {
    return NextResponse.json({ ok: false, error: "Passkey login challenge expired." }, { status: 400 })
  }

  const payload = (await request.json().catch(() => ({}))) as { response?: AuthenticationResponseJSON }
  if (!payload.response?.id) {
    return NextResponse.json({ ok: false, error: "Missing passkey authentication response." }, { status: 400 })
  }

  const passkey = await getAdminPasskeyByCredentialId(payload.response.id)
  if (!passkey || passkey.user_id !== state.userId || !(await isAdminUser(passkey.user_id))) {
    return NextResponse.json({ ok: false, error: "Passkey is not authorized for admin login." }, { status: 403 })
  }

  const { origin, rpID } = getWebAuthnRp(request)
  const verification = await verifyAuthenticationResponse({
    response: payload.response,
    expectedChallenge: state.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: toWebAuthnCredential(passkey),
    requireUserVerification: true,
  })

  if (!verification.verified) {
    return NextResponse.json({ ok: false, error: "Unable to verify passkey login." }, { status: 401 })
  }

  await updateAdminPasskeyCounter(passkey.credential_id, verification.authenticationInfo.newCounter)
  void logLoginEvent(
    passkey.user_id,
    "login",
    request.headers.get("x-forwarded-for"),
    request.headers.get("user-agent"),
  )

  const response = NextResponse.json({ ok: true, redirectTo: "/admin" })
  clearPasskeyChallengeCookie(response, ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE)
  setAdminPasskeySessionCookie(response, passkey.user_id)
  return response
}
