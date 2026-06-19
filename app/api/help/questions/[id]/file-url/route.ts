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
    const { rows } = await pool.query<{ file_url: string | null }>(
      'SELECT file_url FROM public.help_questions WHERE id = $1',
      [id],
    )

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 })
    }

    const filePath = rows[0].file_url
    if (!filePath) {
      return NextResponse.json({ ok: false, error: 'No attachment.' }, { status: 404 })
    }

    const url = await getSignedDocumentUrl({ storagePath: filePath, expiresInSeconds: 3600 })
    return NextResponse.json({ ok: true, url })
  } catch (err) {
    logServerError('GET /api/help/questions/[id]/file-url', err)
    return NextResponse.json({ ok: false, error: 'Failed to generate signed URL.' }, { status: 500 })
  }
}
