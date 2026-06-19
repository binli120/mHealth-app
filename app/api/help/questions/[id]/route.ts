import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/require-auth'
import { logServerError } from '@/lib/server/logger'
import { getHelpQuestion } from '@/lib/help/db'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const question = await getHelpQuestion(id)
    if (!question) {
      return NextResponse.json({ ok: false, error: 'Question not found.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data: question })
  } catch (err) {
    logServerError('GET /api/help/questions/[id]', err)
    return NextResponse.json({ ok: false, error: 'Failed to load question.' }, { status: 500 })
  }
}
