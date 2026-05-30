/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"

const MAX_MESSAGE_LENGTH = 500
const MAX_DIGEST_LENGTH = 64

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 })
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).message !== "string"
  ) {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 })
  }

  const { message, digest } = body as { message: string; digest?: unknown }

  const trimmedMessage = message.slice(0, MAX_MESSAGE_LENGTH)
  const trimmedDigest = typeof digest === "string" ? digest.slice(0, MAX_DIGEST_LENGTH) : undefined

  logServerError("client-side error boundary triggered", new Error(trimmedMessage), {
    module: "api/log/client-error",
    userId: auth.userId,
    ...(trimmedDigest !== undefined ? { digest: trimmedDigest } : {}),
  })

  return NextResponse.json({ ok: true })
}
