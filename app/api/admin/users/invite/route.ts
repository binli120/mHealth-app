/**
 * POST /api/admin/users/invite
 * Admin creates an invitation for a user email, optionally linked to a company.
 * Sends the invitation link via Resend; falls back to console.log in dev.
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createInvitation } from "@/lib/db/invitations"
import { resend } from "@/lib/resend"

export const runtime = "nodejs"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const FROM_EMAIL = process.env.FROM_EMAIL ?? "noreply@healthcompassma.com"

export async function POST(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const body = (await request.json().catch(() => ({}))) as {
    email?: string
    companyId?: string
    role?: string
  }

  if (!body.email?.trim()) {
    return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 })
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(body.email.trim())) {
    return NextResponse.json({ ok: false, error: "Invalid email address" }, { status: 400 })
  }

  const { token } = await createInvitation({
    email: body.email.trim(),
    companyId: body.companyId ?? null,
    role: body.role ?? "applicant",
    invitedBy: authResult.userId,
  })

  const inviteUrl = `${APP_URL}/auth/invite/${token}`

  // Send invitation email via Resend; log to console in dev if no API key
  const hasResend = Boolean(process.env.RESEND_API_KEY)
  if (hasResend) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: body.email.trim(),
        subject: "You've been invited to HealthCompass MA",
        html: buildInviteEmailHtml(inviteUrl),
      })
    } catch (err) {
      console.error("[invite] Resend failed:", err)
      // Don't fail the request — invitation was created, link can be shared manually
    }
  } else {
    console.log(`[invite] No RESEND_API_KEY — invitation link for ${body.email.trim()}:`)
    console.log(`[invite] ${inviteUrl}`)
  }

  return NextResponse.json({ ok: true, inviteUrl })
}

function buildInviteEmailHtml(inviteUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#111;">
      <h2 style="color:#1d4ed8;">You've been invited to HealthCompass MA</h2>
      <p>An administrator has invited you to join HealthCompass MA. Click the button below to set up your account:</p>
      <a href="${inviteUrl}"
         style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
                padding:12px 24px;border-radius:8px;font-weight:600;margin:16px 0;">
        Accept Invitation
      </a>
      <p style="color:#6b7280;font-size:13px;">
        This link expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:12px;">HealthCompass MA · Massachusetts Health Benefits Navigation</p>
    </body>
    </html>
  `
}
