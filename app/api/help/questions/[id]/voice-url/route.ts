/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/require-auth'
import { logServerError } from '@/lib/server/logger'
import { getSignedDocumentUrl } from '@/lib/supabase/storage'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')
    if (!path) {
      return NextResponse.json({ ok: false, error: 'Missing path.' }, { status: 400 })
    }

    const url = await getSignedDocumentUrl({ storagePath: path, expiresInSeconds: 3600 })
    return NextResponse.json({ ok: true, url })
  } catch (err) {
    logServerError('GET /api/help/questions/[id]/voice-url', err)
    return NextResponse.json({ ok: false, error: 'Failed to generate signed URL.' }, { status: 500 })
  }
}
