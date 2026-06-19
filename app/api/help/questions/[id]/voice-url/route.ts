/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/require-auth'
import { logServerError } from '@/lib/server/logger'
import { getDbPool } from '@/lib/db/server'
import { getSignedDocumentUrl } from '@/lib/supabase/storage'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const { id } = await params

    const pool = getDbPool()
    const { rows } = await pool.query<{ voice_url: string | null }>(
      'SELECT voice_url FROM public.help_questions WHERE id = $1',
      [id],
    )

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 })
    }

    const voicePath = rows[0].voice_url
    if (!voicePath) {
      return NextResponse.json({ ok: false, error: 'No voice recording.' }, { status: 404 })
    }

    const url = await getSignedDocumentUrl({ storagePath: voicePath, expiresInSeconds: 3600 })
    return NextResponse.json({ ok: true, url })
  } catch (err) {
    logServerError('GET /api/help/questions/[id]/voice-url', err)
    return NextResponse.json({ ok: false, error: 'Failed to generate signed URL.' }, { status: 500 })
  }
}
