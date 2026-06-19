import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/require-auth'
import { logServerError } from '@/lib/server/logger'
import { embedText } from '@/lib/help/ai'
import { findSimilarQuestions } from '@/lib/help/db'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim()
    const excludeId = url.searchParams.get('excludeId') ?? undefined

    if (q.length < 3) {
      return NextResponse.json({ ok: true, data: [] })
    }

    const embedding = await embedText(q)
    const similar   = await findSimilarQuestions(embedding, excludeId)
    return NextResponse.json({ ok: true, data: similar })
  } catch (err) {
    logServerError('GET /api/help/questions/similar', err)
    return NextResponse.json({ ok: true, data: [] }) // non-fatal: return empty
  }
}
