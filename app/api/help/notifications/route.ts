import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/require-auth'
import { logServerError } from '@/lib/server/logger'
import { setNotifyOnAnswer } from '@/lib/help/db'

export const runtime = 'nodejs'

export async function PATCH(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json() as { notify?: boolean }
    if (typeof body.notify !== 'boolean') {
      return NextResponse.json({ ok: false, error: 'notify must be a boolean.' }, { status: 400 })
    }
    await setNotifyOnAnswer(auth.userId, body.notify)
    return NextResponse.json({ ok: true })
  } catch (err) {
    logServerError('PATCH /api/help/notifications', err, { userId: auth.userId })
    return NextResponse.json({ ok: false, error: 'Failed to update notification setting.' }, { status: 500 })
  }
}
