import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { saveAdminPasskey } from "@/lib/auth/admin-passkeys"
import {
  ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE,
  clearPasskeyChallengeCookie,
  getPasskeyChallengeState,
  getWebAuthnRp,
} from "@/lib/auth/passkey-webauthn"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const state = getPasskeyChallengeState(request, ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE)
  if (!state || state.userId !== authResult.userId) {
    return NextResponse.json({ ok: false, error: "Passkey registration challenge expired." }, { status: 400 })
  }

  const payload = (await request.json().catch(() => ({}))) as {
    response?: RegistrationResponseJSON
    name?: string
  }
  if (!payload.response) {
    return NextResponse.json({ ok: false, error: "Missing passkey registration response." }, { status: 400 })
  }

  const { origin, rpID } = getWebAuthnRp(request)
  const verification = await verifyRegistrationResponse({
    response: payload.response,
    expectedChallenge: state.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  })

  if (!verification.verified) {
    return NextResponse.json({ ok: false, error: "Unable to verify passkey registration." }, { status: 400 })
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
  await saveAdminPasskey({
    userId: authResult.userId,
    credentialId: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: credential.transports ?? [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    name: payload.name?.trim() || null,
  })

  const response = NextResponse.json({ ok: true })
  clearPasskeyChallengeCookie(response, ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE)
  return response
}
