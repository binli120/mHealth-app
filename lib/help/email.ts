import 'server-only'

import { resend } from '@/lib/resend'
import { logServerError, logServerInfo } from '@/lib/server/logger'
import { HELP_CATEGORY_LABELS } from './constants'
import type { HelpQuestion } from './types'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const FROM_EMAIL = process.env.FROM_EMAIL ?? 'no-reply@healthcompass.cloud'
const NOTIFY_EMAIL = 'no-reply@healthcompass.cloud'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://healthcompass.cloud'

export async function sendNewQuestionEmail(question: HelpQuestion): Promise<void> {
  const questionUrl = `${APP_URL}/help/${question.id}`
  const categoryLabel = HELP_CATEGORY_LABELS[question.category]
  const bodyExcerpt = question.body
    ? question.body.length > 300
      ? question.body.slice(0, 300) + '…'
      : question.body
    : '(no details provided)'

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1a6fa3">New Help Question</h2>
      <p><strong>Category:</strong> ${categoryLabel}</p>
      <h3 style="margin-bottom:4px">${escapeHtml(question.title)}</h3>
      <p style="color:#555;white-space:pre-wrap">${escapeHtml(bodyExcerpt)}</p>
      <p>
        <a href="${questionUrl}"
           style="background:#1a6fa3;color:white;padding:10px 20px;border-radius:4px;text-decoration:none;display:inline-block;margin-top:8px">
          View Question &amp; Answer
        </a>
      </p>
      <hr style="margin-top:24px;border:none;border-top:1px solid #eee">
      <p style="color:#999;font-size:12px">HealthCompass MA · Help Center</p>
    </div>
  `

  try {
    const { error } = await resend.emails.send({
      from: `HealthCompass MA <${FROM_EMAIL}>`,
      to: NOTIFY_EMAIL,
      subject: `[Help] ${question.title}`,
      html,
    })
    if (error) throw new Error(error.message)
    logServerInfo('sendNewQuestionEmail: sent', { questionId: question.id })
  } catch (err) {
    // Non-fatal: log but don't fail the question creation
    logServerError('sendNewQuestionEmail failed', err, { questionId: question.id })
  }
}
