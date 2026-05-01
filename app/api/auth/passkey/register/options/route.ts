import { generateRegistrationOptions } from "@simplewebauthn/server"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { getUserEmail, listAdminPasskeysForUser } from "@/lib/auth/admin-passkeys"
import {
  ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE,
  getWebAuthnRp,
  setPasskeyChallengeCookie,
} from "@/lib/auth/passkey-webauthn"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin(request)
    if (!authResult.ok) return authResult.response

    const email = await getUserEmail(authResult.userId)
    if (!email) {
      return NextResponse.json({ ok: false, error: "Admin user profile not found." }, { status: 404 })
    }

    const { rpName, rpID } = getWebAuthnRp(request)
    const credentials = await listAdminPasskeysForUser(authResult.userId)
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(authResult.userId),
      userName: email,
      userDisplayName: email,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      excludeCredentials: credentials.map((credential) => ({
        id: credential.credential_id,
        transports: credential.transports as never,
      })),
    })

    const response = NextResponse.json({ ok: true, options })
    setPasskeyChallengeCookie(response, ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE, {
      challenge: options.challenge,
      userId: authResult.userId,
    })
    return response
  } catch (error) {
    logServerError("admin_passkey.register_options_failed", error, {
      route: "/api/auth/passkey/register/options",
    })

    const message = error instanceof Error ? error.message : String(error)
    const isMissingTable = message.includes("admin_passkey_credentials") || message.includes("relation")
    return NextResponse.json(
      {
        ok: false,
        error: isMissingTable
          ? "Passkey setup is not ready. Run the admin passkey database migration, then try again."
          : "Unable to start passkey registration.",
      },
      { status: isMissingTable ? 503 : 500 },
    )
  }
}
