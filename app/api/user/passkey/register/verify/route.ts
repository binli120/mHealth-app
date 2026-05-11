/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server"
import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { saveUserPasskey } from "@/lib/auth/user-passkeys"
import {
  clearPasskeyChallengeCookie,
  getPasskeyChallengeState,
  getWebAuthnRp,
} from "@/lib/auth/passkey-webauthn"

export const runtime = "nodejs"

const USER_PASSKEY_REGISTER_CHALLENGE_COOKIE = "hc-user-passkey-register"

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const state = getPasskeyChallengeState(request, USER_PASSKEY_REGISTER_CHALLENGE_COOKIE)
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
    requireUserVerification: false,
  })

  if (!verification.verified) {
    return NextResponse.json({ ok: false, error: "Unable to verify passkey." }, { status: 400 })
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

  try {
    await saveUserPasskey({
      userId: authResult.userId,
      credentialId: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: payload.name?.trim() || null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("user_passkey_credentials") || msg.includes("42P01")) {
      return NextResponse.json(
        { ok: false, error: "Passkey storage is not ready. Run the database migration first." },
        { status: 503 },
      )
    }
    throw err
  }

  const response = NextResponse.json({ ok: true })
  clearPasskeyChallengeCookie(response, USER_PASSKEY_REGISTER_CHALLENGE_COOKIE)
  return response
}
