/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { generateRegistrationOptions } from "@simplewebauthn/server"
import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { listPasskeysForUser } from "@/lib/auth/user-passkeys"
import { getUserEmail } from "@/lib/auth/admin-passkeys"
import {
  getWebAuthnRp,
  setPasskeyChallengeCookie,
} from "@/lib/auth/passkey-webauthn"

export const runtime = "nodejs"

export const USER_PASSKEY_REGISTER_CHALLENGE_COOKIE = "hc-user-passkey-register"

async function getEmail(userId: string): Promise<string | null> {
  return getUserEmail(userId)
}

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const email = await getEmail(authResult.userId)
  if (!email) {
    return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 })
  }

  const { rpName, rpID } = getWebAuthnRp(request)
  // If the migration hasn't run yet the table won't exist — treat as no existing passkeys.
  const existing = await listPasskeysForUser(authResult.userId).catch(() => [])

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: Buffer.from(authResult.userId),
    userName: email,
    userDisplayName: email,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credential_id,
      transports: c.transports as never,
    })),
  })

  const response = NextResponse.json({ ok: true, options })
  setPasskeyChallengeCookie(response, USER_PASSKEY_REGISTER_CHALLENGE_COOKIE, {
    challenge: options.challenge,
    userId: authResult.userId,
  })
  return response
}
