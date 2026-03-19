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

// ── Fetch user email + notification prefs from DB ───────────────────────────

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

// ── Core dispatch function ──────────────────────────────────────────────────

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

  const notification = await createNotification({
    userId,
    type: "status_change" as NotificationType,
    title,
    body,
    metadata: { applicationId, newStatus },
  })

  const user = await getUserEmailAndPrefs(userId)
  if (!user || !wantsEmail(user.prefs)) return

  const name = applicantName ?? user.name
  const prefsUrl = `${APP_URL}/customer/profile#notifications`
  const dashboardUrl = `${APP_URL}/customer/dashboard`

  await sendEmailNotification(
    notification.id,
    user.email,
    title,
    StatusChangeEmail({
      applicantName: name,
      applicationId,
      newStatus,
      dashboardUrl,
      prefsUrl,
    }),
  )
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

  const notification = await createNotification({
    userId,
    type: "document_request" as NotificationType,
    title,
    body,
    metadata: { applicationId, documentType, dueDate },
  })

  const user = await getUserEmailAndPrefs(userId)
  if (!user || !wantsEmail(user.prefs)) return

  const name = applicantName ?? user.name
  const prefsUrl = `${APP_URL}/customer/profile#notifications`
  const uploadUrl = `${APP_URL}/customer/dashboard`

  await sendEmailNotification(
    notification.id,
    user.email,
    "Action Required: Document Requested",
    DocumentRequestEmail({
      applicantName: name,
      documentType,
      dueDate,
      uploadUrl,
      prefsUrl,
    }),
  )
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

  const notification = await createNotification({
    userId,
    type: "renewal_reminder" as NotificationType,
    title,
    body,
    metadata: { programName, renewalDate, daysLeft },
  })

  const user = await getUserEmailAndPrefs(userId)
  if (!user || !user.prefs.deadlineReminders || !wantsEmail(user.prefs)) return

  const name = applicantName ?? user.name
  const prefsUrl = `${APP_URL}/customer/profile#notifications`
  const renewalUrl = `${APP_URL}/customer/dashboard`

  await sendEmailNotification(
    notification.id,
    user.email,
    `${programName} Renewal Due in ${daysLeft} Days`,
    RenewalReminderEmail({
      applicantName: name,
      programName,
      renewalDate,
      daysLeft,
      renewalUrl,
      prefsUrl,
    }),
  )
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

  const notification = await createNotification({
    userId,
    type: "deadline" as NotificationType,
    title,
    body,
    metadata: { programName, deadline, actionUrl },
  })

  const user = await getUserEmailAndPrefs(userId)
  if (!user || !user.prefs.deadlineReminders || !wantsEmail(user.prefs)) return

  const name = applicantName ?? user.name
  const prefsUrl = `${APP_URL}/customer/profile#notifications`

  await sendEmailNotification(
    notification.id,
    user.email,
    `Deadline Reminder: ${programName}`,
    DeadlineEmail({
      applicantName: name,
      programName,
      deadline,
      actionUrl,
      prefsUrl,
    }),
  )
}

