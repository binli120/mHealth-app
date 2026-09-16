/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 *
 * Transactional emails for mailing-list signups: a marketing welcome email
 * to the subscriber, and an internal notification so the team knows a new
 * lead came in. Both are best-effort — failures are logged, never thrown,
 * so a mail provider hiccup can't break the signup itself.
 */

import "server-only"

import { resend } from "@/lib/resend"
import { logServerError, logServerInfo } from "@/lib/server/logger"

const FROM_EMAIL = process.env.FROM_EMAIL ?? "no-reply@healthcompass.cloud"
const OWNER_NOTIFY_EMAIL = "blee@comura.ai"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://healthcompass.cloud"

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function sendMailingListWelcomeEmail(email: string): Promise<void> {
  const registerUrl = `${APP_URL}/auth/register`

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:12px;background:#1a3d8f">
          <span style="color:#fff;font-size:24px;line-height:56px">🛡️</span>
        </div>
      </div>
      <h1 style="font-size:24px;text-align:center;margin-bottom:8px">Find every benefit you deserve</h1>
      <p style="text-align:center;color:#4b5563;font-size:15px;margin-bottom:28px">
        Thanks for joining the HealthCompass MA list — here's what we're building.
      </p>

      <p style="font-size:15px;line-height:1.6">
        Massachusetts residents miss thousands of dollars in benefits every year because
        the system is too complex to navigate alone. <strong>HealthCompass MA</strong> is
        a free, AI-powered tool that checks your eligibility across 11+ programs at
        once — MassHealth, SNAP, EITC, LIHEAP, WIC, and more — and walks you through
        every application, in 6 languages, in about 15 minutes.
      </p>

      <ul style="font-size:14px;line-height:1.8;color:#374151;padding-left:20px">
        <li>Free to use, no cost to apply</li>
        <li>11+ programs checked in one pass</li>
        <li>Voice messaging and auto-translation built in</li>
        <li>Guided, step-by-step applications</li>
      </ul>

      <div style="text-align:center;margin:32px 0">
        <a href="${registerUrl}"
           style="background:#1a3d8f;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
          Create your free account
        </a>
      </div>

      <p style="text-align:center;font-size:13px;color:#6b7280">
        Not ready yet? <a href="${APP_URL}" style="color:#1a3d8f">Explore HealthCompass MA</a>
      </p>

      <hr style="margin-top:32px;border:none;border-top:1px solid #eee">
      <p style="color:#9ca3af;font-size:12px;text-align:center">
        HealthCompass MA · You're receiving this because you signed up at healthcompass.cloud.
      </p>
    </div>
  `

  const { error } = await resend.emails.send({
    from: `HealthCompass MA <${FROM_EMAIL}>`,
    to: email,
    subject: "Find every benefit you deserve — welcome to HealthCompass MA",
    html,
  })
  if (error) throw new Error(error.message)
  logServerInfo("growth.mailing_list.welcome_email_sent", { email })
}

export async function sendMailingListSignupNotification(input: {
  email: string
  source: string
  referralCode: string | null
}): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1a3d8f">New mailing-list signup</h2>
      <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
      <p><strong>Source:</strong> ${escapeHtml(input.source)}</p>
      <p><strong>Referral code:</strong> ${input.referralCode ? escapeHtml(input.referralCode) : "—"}</p>
      <hr style="margin-top:24px;border:none;border-top:1px solid #eee">
      <p style="color:#999;font-size:12px">HealthCompass MA · Growth notifications</p>
    </div>
  `

  const { error } = await resend.emails.send({
    from: `HealthCompass MA <${FROM_EMAIL}>`,
    to: OWNER_NOTIFY_EMAIL,
    subject: `[Mailing List] New signup: ${input.email}`,
    html,
  })
  if (error) throw new Error(error.message)
  logServerInfo("growth.mailing_list.owner_notification_sent", { email: input.email })
}

export async function notifyMailingListSignup(input: {
  email: string
  source: string
  referralCode: string | null
}): Promise<void> {
  const results = await Promise.allSettled([
    sendMailingListWelcomeEmail(input.email),
    sendMailingListSignupNotification(input),
  ])

  for (const result of results) {
    if (result.status === "rejected") {
      logServerError("growth.mailing_list.notify_failed", result.reason, { email: input.email })
    }
  }
}
