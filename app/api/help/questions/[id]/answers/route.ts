import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/require-auth'
import { logServerError } from '@/lib/server/logger'
import { checkRateLimitAsync, helpAnswerLimiter } from '@/lib/server/rate-limit'
import { createHelpAnswer, getQuestionsWithNotifyForQuestion } from '@/lib/help/db'
import { resend } from '@/lib/resend'

export const runtime = 'nodejs'

const FROM_EMAIL = process.env.FROM_EMAIL ?? 'no-reply@healthcompass.cloud'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://healthcompass.cloud'

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

    // Fire-and-forget: notify question owner if notify_on_answer = true
    void sendAnswerNotification(questionId).catch(err =>
      logServerError('sendAnswerNotification failed', err, { questionId }),
    )

    return NextResponse.json({ ok: true, data: answer }, { status: 201 })
  } catch (err) {
    logServerError('POST /api/help/questions/[id]/answers', err, { userId: auth.userId })
    return NextResponse.json({ ok: false, error: 'Failed to post answer.' }, { status: 500 })
  }
}

async function sendAnswerNotification(questionId: string): Promise<void> {
  const notifyRows = await getQuestionsWithNotifyForQuestion(questionId)
  if (!notifyRows.length) return

  await Promise.all(
    notifyRows.map(async ({ email }) => {
      const { error } = await resend.emails.send({
        from: `HealthCompass MA <${FROM_EMAIL}>`,
        to: email,
        subject: `Re: [Help] Your question received an answer`,
        html: `<p>Someone answered your question.</p><p><a href="${APP_URL}/help/${questionId}">View the answer</a></p>`,
      })
      if (error) throw new Error(error.message)
    }),
  )
}
