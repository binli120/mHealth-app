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
  SessionInviteEmail,
  SessionStartingEmail,
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

export async function notifySessionInvite(
  patientUserId: string,
  sessionId: string,
  swName: string,
  scheduledAt?: string | null,
  message?: string | null,
): Promise<void> {
  const title = `${swName} has invited you to a session`
  const body = scheduledAt
    ? `Your social worker scheduled a session for ${scheduledAt}. Accept to confirm.`
    : `Your social worker wants to meet with you. Click to accept or decline.`
  const sessionUrl = `${APP_URL}/customer/sessions/${sessionId}`
  const prefsUrl = `${APP_URL}/customer/profile#notifications`

  await dispatch({
    userId: patientUserId,
    type: "session_invite",
    title,
    body,
    metadata: { sessionId, swName, scheduledAt: scheduledAt ?? null },
    subject: `${swName} invited you to a HealthCompass session`,
    buildEmail: (name) =>
      SessionInviteEmail({
        patientName: name,
        swName,
        scheduledAt: scheduledAt ?? null,
        inviteMessage: message ?? null,
        sessionUrl,
        prefsUrl,
      }),
  })
}

export async function notifySessionStarting(
  patientUserId: string,
  sessionId: string,
  swName: string,
): Promise<void> {
  const title = `Session starting now — ${swName} is ready`
  const body = `Your social worker has started the session. Join now to connect.`
  const sessionUrl = `${APP_URL}/customer/sessions/${sessionId}`
  const prefsUrl = `${APP_URL}/customer/profile#notifications`

  await dispatch({
    userId: patientUserId,
    type: "session_starting",
    title,
    body,
    metadata: { sessionId, swName },
    subject: `Join your session with ${swName} now`,
    buildEmail: (name) =>
      SessionStartingEmail({
        patientName: name,
        swName,
        sessionUrl,
        prefsUrl,
      }),
  })
}

// ── SW messaging notifications ───────────────────────────────────────────────

/** Notify a SW that a patient has sent them an engagement request. */
export async function notifySwEngagementRequest(
  swUserId: string,
  patientName: string,
  requestId: string,
): Promise<void> {
  const title = `${patientName || "A patient"} wants your help`
  const body = `A patient has requested you as their social worker. Review and respond from your dashboard.`
  const requestUrl = `${APP_URL}/social-worker/messages?tab=requests`

  await dispatch({
    userId: swUserId,
    type: "sw_engagement_request",
    title,
    body,
    metadata: { requestId, patientName },
    subject: title,
    buildEmail: () =>
      StatusChangeEmail({
        applicantName: "Social Worker",
        applicationId: requestId,
        newStatus: "New patient engagement request",
        dashboardUrl: requestUrl,
        prefsUrl: `${APP_URL}/social-worker/profile#notifications`,
      }),
  })
}

/** Notify a patient that their engagement request was accepted. */
export async function notifyEngagementAccepted(
  patientUserId: string,
  swName: string,
  requestId: string,
): Promise<void> {
  const title = `${swName || "A social worker"} accepted your request`
  const body = `Your social worker is now connected with you. You can send them messages any time from the chat window.`
  const chatUrl = `${APP_URL}/customer/dashboard`

  await dispatch({
    userId: patientUserId,
    type: "sw_engagement_accepted",
    title,
    body,
    metadata: { requestId, swName },
    subject: `${swName || "Your social worker"} is ready to help you`,
    buildEmail: () =>
      StatusChangeEmail({
        applicantName: "Applicant",
        applicationId: requestId,
        newStatus: "Social worker accepted your request",
        dashboardUrl: chatUrl,
        prefsUrl: `${APP_URL}/customer/profile#notifications`,
      }),
  })
}

/** Notify a patient that their engagement request was politely declined. */
export async function notifyEngagementRejected(
  patientUserId: string,
  swName: string,
  requestId: string,
  rejectionNote?: string | null,
): Promise<void> {
  const title = `${swName || "A social worker"} is unable to take your request`
  const body =
    rejectionNote
      ? `Message: "${rejectionNote}". You can search for another social worker from the chat window.`
      : `You can search for another social worker from the chat window.`
  const searchUrl = `${APP_URL}/customer/dashboard`

  await dispatch({
    userId: patientUserId,
    type: "sw_engagement_rejected",
    title,
    body,
    metadata: { requestId, swName, rejectionNote: rejectionNote ?? null },
    subject: `Update on your social worker request`,
    buildEmail: () =>
      StatusChangeEmail({
        applicantName: "Applicant",
        applicationId: requestId,
        newStatus: "Social worker request declined",
        dashboardUrl: searchUrl,
        prefsUrl: `${APP_URL}/customer/profile#notifications`,
      }),
  })
}

/** Notify the recipient of a new direct message. */
export async function notifyNewDirectMessage(
  recipientUserId: string,
  senderName: string,
  messageId: string,
  isSenderSw: boolean,
  senderUserId: string,
): Promise<void> {
  const title = `New message from ${senderName || (isSenderSw ? "your social worker" : "your patient")}`
  const body = `You have a new message. Click to view and reply.`
  const chatUrl = isSenderSw
    ? `${APP_URL}/customer/dashboard`
    : `${APP_URL}/social-worker/messages`

  await dispatch({
    userId: recipientUserId,
    type: "new_direct_message",
    title,
    body,
    metadata: { messageId, senderName, senderUserId },
    subject: title,
    buildEmail: () =>
      StatusChangeEmail({
        applicantName: isSenderSw ? "Applicant" : "Social Worker",
        applicationId: messageId,
        newStatus: "New direct message",
        dashboardUrl: chatUrl,
        prefsUrl: isSenderSw
          ? `${APP_URL}/customer/profile#notifications`
          : `${APP_URL}/social-worker/profile#notifications`,
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
