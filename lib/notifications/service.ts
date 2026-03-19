/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import "server-only"

import { render } from "@react-email/components"

import { createNotification, markEmailSent } from "@/lib/db/notifications"
import { getDbPool } from "@/lib/db/server"
import {
  DeadlineEmail,
  DocumentRequestEmail,
  RenewalReminderEmail,
  StatusChangeEmail,
} from "@/lib/notifications/email-templates"
import type { NotificationType } from "@/lib/notifications/types"
import { resend } from "@/lib/resend"
import { logServerError } from "@/lib/server/logger"
import type { NotificationPrefs } from "@/lib/user-profile/types"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const FROM_EMAIL = process.env.FROM_EMAIL ?? "noreply@healthcompassma.com"

// ── Fetch user email + notification prefs ────────────────────────────────────

async function getUserEmailAndPrefs(
  userId: string,
): Promise<{ email: string; name: string; prefs: NotificationPrefs } | null> {
  const pool = getDbPool()
  const { rows } = await pool.query<{
    email: string
    first_name: string
    last_name: string
    profile_data: { notifications?: NotificationPrefs } | null
  }>(
    `SELECT
       u.email,
       a.first_name,
       a.last_name,
       up.profile_data
     FROM auth.users u
     LEFT JOIN applicants a ON a.user_id = u.id
     LEFT JOIN user_profiles up ON up.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [userId],
  )

  const row = rows[0]
  if (!row?.email) return null

  const defaultPrefs: NotificationPrefs = {
    deadlineReminders: true,
    qualificationAlerts: true,
    regulationUpdates: false,
    channel: "email",
    reminderLeadDays: 14,
  }

  return {
    email: row.email,
    name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Applicant",
    prefs: row.profile_data?.notifications ?? defaultPrefs,
  }
}

function wantsEmail(prefs: NotificationPrefs): boolean {
  return prefs.channel === "email" || prefs.channel === "both"
}

// ── Core email dispatch ──────────────────────────────────────────────────────

async function sendEmailNotification(
  notificationId: string,
  recipientEmail: string,
  subject: string,
  reactElement: React.ReactElement,
): Promise<void> {
  try {
    const html = await render(reactElement)
    const { error } = await resend.emails.send({
      from: `HealthCompass MA <${FROM_EMAIL}>`,
      to: recipientEmail,
      subject,
      html,
    })
    if (error) {
      logServerError("Resend email send failed", error, { module: "notifications/service", notificationId })
      return
    }
    await markEmailSent(notificationId)
  } catch (err) {
    logServerError("Unexpected error sending email notification", err, { module: "notifications/service", notificationId })
  }
}

// ── Shared dispatch pipeline ─────────────────────────────────────────────────
//
// All four public triggers share the same steps:
//   1. Create in-app DB notification
//   2. Fetch user email + prefs
//   3. Guard: wants email + optional pref check
//   4. Render and send email
//
// Each trigger only differs in the content (title, body, metadata, email element).

interface NotifyPayload {
  userId: string
  type: NotificationType
  title: string
  body: string
  metadata: Record<string, unknown>
  subject: string
  /** Return the React email element given the resolved recipient name. */
  buildEmail: (recipientName: string) => React.ReactElement
  /** Extra pref guard beyond wantsEmail (e.g. deadlineReminders). */
  prefGuard?: (prefs: NotificationPrefs) => boolean
}

async function dispatch(payload: NotifyPayload): Promise<void> {
  const notification = await createNotification({
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    metadata: payload.metadata,
  })

  const user = await getUserEmailAndPrefs(payload.userId)
  if (!user) return
  if (!wantsEmail(user.prefs)) return
  if (payload.prefGuard && !payload.prefGuard(user.prefs)) return

  await sendEmailNotification(
    notification.id,
    user.email,
    payload.subject,
    payload.buildEmail(user.name),
  )
}

// ── Public convenience triggers ─────────────────────────────────────────────

export async function notifyStatusChange(
  userId: string,
  applicationId: string,
  newStatus: string,
  applicantName?: string,
): Promise<void> {
  const STATUS_TITLES: Record<string, string> = {
    submitted:     "Application submitted",
    in_review:     "Application under review",
    approved:      "Application approved",
    denied:        "Application denied",
    pending:       "Action required on your application",
    rfi_requested: "Documents requested for your application",
  }

  const title = STATUS_TITLES[newStatus] ?? "Your application status has changed"
  const body = `Your MassHealth application (${applicationId}) status is now: ${newStatus.replace(/_/g, " ")}.`
  const dashboardUrl = `${APP_URL}/customer/dashboard`
  const prefsUrl = `${APP_URL}/customer/profile#notifications`

  await dispatch({
    userId,
    type: "status_change",
    title,
    body,
    metadata: { applicationId, newStatus },
    subject: title,
    buildEmail: (name) =>
      StatusChangeEmail({
        applicantName: applicantName ?? name,
        applicationId,
        newStatus,
        dashboardUrl,
        prefsUrl,
      }),
  })
}

export async function notifyDocumentRequest(
  userId: string,
  applicationId: string,
  documentType: string,
  dueDate: string,
  applicantName?: string,
): Promise<void> {
  const title = `Document requested: ${documentType}`
  const body = `Please upload ${documentType} for your application (${applicationId}) by ${dueDate}.`
  const uploadUrl = `${APP_URL}/customer/dashboard`
  const prefsUrl = `${APP_URL}/customer/profile#notifications`

  await dispatch({
    userId,
    type: "document_request",
    title,
    body,
    metadata: { applicationId, documentType, dueDate },
    subject: "Action Required: Document Requested",
    buildEmail: (name) =>
      DocumentRequestEmail({
        applicantName: applicantName ?? name,
        documentType,
        dueDate,
        uploadUrl,
        prefsUrl,
      }),
  })
}

export async function notifyRenewalReminder(
  userId: string,
  programName: string,
  renewalDate: string,
  daysLeft: number,
  applicantName?: string,
): Promise<void> {
  const title = `${programName} renewal due in ${daysLeft} days`
  const body = `Your ${programName} coverage renews on ${renewalDate}. Complete your renewal to avoid a gap.`
  const renewalUrl = `${APP_URL}/customer/dashboard`
  const prefsUrl = `${APP_URL}/customer/profile#notifications`

  await dispatch({
    userId,
    type: "renewal_reminder",
    title,
    body,
    metadata: { programName, renewalDate, daysLeft },
    subject: `${programName} Renewal Due in ${daysLeft} Days`,
    prefGuard: (prefs) => prefs.deadlineReminders,
    buildEmail: (name) =>
      RenewalReminderEmail({
        applicantName: applicantName ?? name,
        programName,
        renewalDate,
        daysLeft,
        renewalUrl,
        prefsUrl,
      }),
  })
}

export async function notifyDeadline(
  userId: string,
  programName: string,
  deadline: string,
  actionUrl: string,
  applicantName?: string,
): Promise<void> {
  const title = `Deadline approaching: ${programName}`
  const body = `There is an important deadline for ${programName} on ${deadline}.`
  const prefsUrl = `${APP_URL}/customer/profile#notifications`

  await dispatch({
    userId,
    type: "deadline",
    title,
    body,
    metadata: { programName, deadline, actionUrl },
    subject: `Deadline Reminder: ${programName}`,
    prefGuard: (prefs) => prefs.deadlineReminders,
    buildEmail: (name) =>
      DeadlineEmail({
        applicantName: applicantName ?? name,
        programName,
        deadline,
        actionUrl,
        prefsUrl,
      }),
  })
}
