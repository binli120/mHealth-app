import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/require-auth'
import { logServerError } from '@/lib/server/logger'
import { checkRateLimitAsync, helpAnswerLimiter } from '@/lib/server/rate-limit'
import { createHelpAnswer } from '@/lib/help/db'

export const runtime = 'nodejs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const rateLimitRes = await checkRateLimitAsync(helpAnswerLimiter, `help_answer:${auth.userId}`)
  if (rateLimitRes) return rateLimitRes

  try {
    const { id: questionId } = await params
    const body = await request.json() as { body?: string }
    const answerBody = (body.body ?? '').trim()

    if (!answerBody) {
      return NextResponse.json({ ok: false, error: 'Answer body is required.' }, { status: 400 })
    }
    if (answerBody.length > 5000) {
      return NextResponse.json({ ok: false, error: 'Answer must be 5000 characters or fewer.' }, { status: 400 })
    }

    const answer = await createHelpAnswer({ questionId, userId: auth.userId, body: answerBody })
    return NextResponse.json({ ok: true, data: answer }, { status: 201 })
  } catch (err) {
    logServerError('POST /api/help/questions/[id]/answers', err, { userId: auth.userId })
    return NextResponse.json({ ok: false, error: 'Failed to post answer.' }, { status: 500 })
  }
}
