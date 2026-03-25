/**
 * Unit tests for the notifications service dispatch pipeline.
 * All I/O (DB, email, logger) is mocked.
 * @author Bin Lee
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NotificationPrefs } from "@/lib/user-profile/types"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db/notifications", () => ({
  createNotification: vi.fn(),
  markEmailSent:      vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@react-email/components", () => ({
  render: vi.fn().mockResolvedValue("<html>email</html>"),
}))

vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: vi.fn() } },
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

// Email template components — we only care that they are called; render is mocked above
vi.mock("@/lib/notifications/email-templates", () => ({
  StatusChangeEmail:    vi.fn().mockReturnValue(null),
  DocumentRequestEmail: vi.fn().mockReturnValue(null),
  RenewalReminderEmail: vi.fn().mockReturnValue(null),
  SessionInviteEmail:   vi.fn().mockReturnValue(null),
  SessionStartingEmail: vi.fn().mockReturnValue(null),
  DeadlineEmail:        vi.fn().mockReturnValue(null),
}))

// Mock getDbPool so getUserEmailAndPrefs can be controlled per-test
const mockDbQuery = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: () => ({ query: mockDbQuery }),
}))

// ── Import after mocks ─────────────────────────────────────────────────────────

import {
  notifyStatusChange,
  notifyDocumentRequest,
  notifyRenewalReminder,
  notifySessionInvite,
  notifySessionStarting,
  notifyDeadline,
} from "@/lib/notifications/service"
import { createNotification, markEmailSent } from "@/lib/db/notifications"
import { resend } from "@/lib/resend"
import { logServerError } from "@/lib/server/logger"
import {
  StatusChangeEmail,
  DocumentRequestEmail,
  RenewalReminderEmail,
  SessionInviteEmail,
  SessionStartingEmail,
  DeadlineEmail,
} from "@/lib/notifications/email-templates"

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID      = "user-123"
const NOTIF_ID     = "notif-abc"
const DEFAULT_PREFS: NotificationPrefs = {
  deadlineReminders:    true,
  qualificationAlerts:  true,
  regulationUpdates:    false,
  channel:              "email",
  reminderLeadDays:     14,
}

function mockUserFound(email = "patient@example.com", name = "Jane Patient", prefs: NotificationPrefs = DEFAULT_PREFS) {
  mockDbQuery.mockResolvedValue({
    rows: [{ email, first_name: name.split(" ")[0], last_name: name.split(" ")[1] ?? "", profile_data: { notifications: prefs } }],
  })
}

function mockUserNotFound() {
  mockDbQuery.mockResolvedValue({ rows: [] })
}

function mockResendSuccess() {
  vi.mocked(resend.emails.send).mockResolvedValue({ data: { id: "resend-1" }, error: null } as never)
}

function mockResendError(message = "Rate limited") {
  vi.mocked(resend.emails.send).mockResolvedValue({ data: null, error: { message } } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createNotification).mockResolvedValue({
    id:           NOTIF_ID,
    userId:       USER_ID,
    type:         "status_change",
    title:        "",
    body:         "",
    metadata:     {},
    readAt:       null,
    emailSentAt:  null,
    createdAt:    new Date().toISOString(),
  })
})

// ── dispatch core pipeline ────────────────────────────────────────────────────

describe("dispatch core pipeline", () => {
  it("always creates an in-app notification regardless of email pref", async () => {
    mockUserFound("u@x.com", "Jane Patient", { ...DEFAULT_PREFS, channel: "app" })
    mockResendSuccess()

    await notifyStatusChange(USER_ID, "app-1", "approved")

    expect(createNotification).toHaveBeenCalledOnce()
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.userId).toBe(USER_ID)
    expect(args.type).toBe("status_change")
  })

  it("does NOT send email when channel is 'app'", async () => {
    mockUserFound("u@x.com", "Jane Patient", { ...DEFAULT_PREFS, channel: "app" })

    await notifyStatusChange(USER_ID, "app-1", "approved")

    expect(resend.emails.send).not.toHaveBeenCalled()
    expect(markEmailSent).not.toHaveBeenCalled()
  })

  it("sends email when channel is 'email'", async () => {
    mockUserFound()
    mockResendSuccess()

    await notifyStatusChange(USER_ID, "app-1", "approved")

    expect(resend.emails.send).toHaveBeenCalledOnce()
    const { to, subject } = vi.mocked(resend.emails.send).mock.calls[0][0] as { to: string; subject: string }
    expect(to).toBe("patient@example.com")
    expect(subject).toBe("Application approved")
  })

  it("sends email when channel is 'both'", async () => {
    mockUserFound("u@x.com", "Jane Patient", { ...DEFAULT_PREFS, channel: "both" })
    mockResendSuccess()

    await notifyStatusChange(USER_ID, "app-1", "approved")

    expect(resend.emails.send).toHaveBeenCalledOnce()
  })

  it("marks emailSentAt after a successful send", async () => {
    mockUserFound()
    mockResendSuccess()

    await notifyStatusChange(USER_ID, "app-1", "approved")

    expect(markEmailSent).toHaveBeenCalledWith(NOTIF_ID)
  })

  it("does NOT mark emailSentAt when Resend returns an error", async () => {
    mockUserFound()
    mockResendError("Quota exceeded")

    await notifyStatusChange(USER_ID, "app-1", "approved")

    expect(markEmailSent).not.toHaveBeenCalled()
    expect(logServerError).toHaveBeenCalledWith(
      "Resend email send failed",
      expect.anything(),
      expect.objectContaining({ notificationId: NOTIF_ID }),
    )
  })

  it("skips email entirely when the user record is not found", async () => {
    mockUserNotFound()

    await notifyStatusChange(USER_ID, "app-1", "approved")

    expect(resend.emails.send).not.toHaveBeenCalled()
  })

  it("does not throw when Resend throws an unexpected error", async () => {
    mockUserFound()
    vi.mocked(resend.emails.send).mockRejectedValue(new Error("Network error"))

    await expect(notifyStatusChange(USER_ID, "app-1", "approved")).resolves.not.toThrow()
    expect(logServerError).toHaveBeenCalledWith(
      "Unexpected error sending email notification",
      expect.any(Error),
      expect.objectContaining({ notificationId: NOTIF_ID }),
    )
  })
})

// ── notifyStatusChange ────────────────────────────────────────────────────────

describe("notifyStatusChange", () => {
  it.each([
    ["approved",      "Application approved"],
    ["denied",        "Application denied"],
    ["in_review",     "Application under review"],
    ["submitted",     "Application submitted"],
    ["rfi_requested", "Documents requested for your application"],
    ["unknown_xyz",   "Your application status has changed"],
  ])("uses correct title for status '%s'", async (status, expectedTitle) => {
    mockUserFound()
    mockResendSuccess()
    await notifyStatusChange(USER_ID, "app-1", status)
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.title).toBe(expectedTitle)
  })

  it("stores applicationId and newStatus in metadata", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifyStatusChange(USER_ID, "app-42", "approved")
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.metadata).toMatchObject({ applicationId: "app-42", newStatus: "approved" })
  })

  it("passes applicantName override to the email template", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifyStatusChange(USER_ID, "app-1", "approved", "Override Name")
    expect(StatusChangeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ applicantName: "Override Name" }),
    )
  })

  it("falls back to the resolved user name when applicantName is omitted", async () => {
    mockUserFound("u@x.com", "Jane Patient")
    mockResendSuccess()
    await notifyStatusChange(USER_ID, "app-1", "approved")
    expect(StatusChangeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ applicantName: "Jane Patient" }),
    )
  })
})

// ── notifyDocumentRequest ─────────────────────────────────────────────────────

describe("notifyDocumentRequest", () => {
  it("creates notification with document_request type", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifyDocumentRequest(USER_ID, "app-1", "W-2", "2026-03-01")
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.type).toBe("document_request")
    expect(args.title).toContain("W-2")
  })

  it("passes document metadata to createNotification", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifyDocumentRequest(USER_ID, "app-1", "W-2", "2026-03-01")
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.metadata).toMatchObject({ documentType: "W-2", dueDate: "2026-03-01" })
  })

  it("uses the correct email template", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifyDocumentRequest(USER_ID, "app-1", "ID Card", "2026-03-15")
    expect(DocumentRequestEmail).toHaveBeenCalledWith(
      expect.objectContaining({ documentType: "ID Card", dueDate: "2026-03-15" }),
    )
  })
})

// ── notifyRenewalReminder ─────────────────────────────────────────────────────

describe("notifyRenewalReminder", () => {
  it("creates notification with renewal_reminder type", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifyRenewalReminder(USER_ID, "MassHealth", "2026-06-01", 30)
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.type).toBe("renewal_reminder")
  })

  it("title includes program name and days left", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifyRenewalReminder(USER_ID, "MassHealth", "2026-06-01", 30)
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.title).toContain("MassHealth")
    expect(args.title).toContain("30")
  })

  it("skips email when deadlineReminders pref is false", async () => {
    mockUserFound("u@x.com", "Jane Patient", { ...DEFAULT_PREFS, deadlineReminders: false })
    await notifyRenewalReminder(USER_ID, "MassHealth", "2026-06-01", 30)
    expect(resend.emails.send).not.toHaveBeenCalled()
  })

  it("sends email when deadlineReminders pref is true", async () => {
    mockUserFound("u@x.com", "Jane Patient", { ...DEFAULT_PREFS, deadlineReminders: true })
    mockResendSuccess()
    await notifyRenewalReminder(USER_ID, "MassHealth", "2026-06-01", 30)
    expect(resend.emails.send).toHaveBeenCalledOnce()
    expect(RenewalReminderEmail).toHaveBeenCalled()
  })
})

// ── notifySessionInvite ───────────────────────────────────────────────────────

describe("notifySessionInvite", () => {
  it("creates notification with session_invite type", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifySessionInvite(USER_ID, "sess-1", "Dr. Smith")
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.type).toBe("session_invite")
  })

  it("includes swName in the title", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifySessionInvite(USER_ID, "sess-1", "Dr. Smith")
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.title).toContain("Dr. Smith")
  })

  it("body mentions scheduledAt when provided", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifySessionInvite(USER_ID, "sess-1", "Dr. Smith", "2026-04-01T14:00:00Z")
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.body).toContain("2026-04-01T14:00:00Z")
  })

  it("body uses ad-hoc wording when scheduledAt is null", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifySessionInvite(USER_ID, "sess-1", "Dr. Smith", null)
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.body).toContain("wants to meet")
  })

  it("stores sessionId and swName in metadata", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifySessionInvite(USER_ID, "sess-99", "Dr. Smith")
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.metadata).toMatchObject({ sessionId: "sess-99", swName: "Dr. Smith" })
  })

  it("passes invite message to the email template when provided", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifySessionInvite(USER_ID, "sess-1", "Dr. Smith", null, "Let us work together!")
    expect(SessionInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ inviteMessage: "Let us work together!" }),
    )
  })

  it("passes null inviteMessage to template when not provided", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifySessionInvite(USER_ID, "sess-1", "Dr. Smith")
    expect(SessionInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ inviteMessage: null }),
    )
  })
})

// ── notifySessionStarting ─────────────────────────────────────────────────────

describe("notifySessionStarting", () => {
  it("creates notification with session_starting type", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifySessionStarting(USER_ID, "sess-1", "Dr. Smith")
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.type).toBe("session_starting")
  })

  it("title and subject mention the SW name", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifySessionStarting(USER_ID, "sess-1", "Dr. Smith")
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.title).toContain("Dr. Smith")
  })

  it("uses the SessionStartingEmail template", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifySessionStarting(USER_ID, "sess-1", "Dr. Smith")
    expect(SessionStartingEmail).toHaveBeenCalledWith(
      expect.objectContaining({ swName: "Dr. Smith" }),
    )
  })

  it("includes sessionId in metadata", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifySessionStarting(USER_ID, "sess-42", "Dr. Smith")
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.metadata).toMatchObject({ sessionId: "sess-42" })
  })
})

// ── notifyDeadline ────────────────────────────────────────────────────────────

describe("notifyDeadline", () => {
  it("creates notification with deadline type", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifyDeadline(USER_ID, "SNAP", "2026-05-01", "http://localhost/apply")
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.type).toBe("deadline")
  })

  it("title includes program name", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifyDeadline(USER_ID, "SNAP", "2026-05-01", "http://localhost/apply")
    const args = vi.mocked(createNotification).mock.calls[0][0]
    expect(args.title).toContain("SNAP")
  })

  it("skips email when deadlineReminders pref is false", async () => {
    mockUserFound("u@x.com", "Jane", { ...DEFAULT_PREFS, deadlineReminders: false })
    await notifyDeadline(USER_ID, "SNAP", "2026-05-01", "http://localhost/apply")
    expect(resend.emails.send).not.toHaveBeenCalled()
  })

  it("uses DeadlineEmail template", async () => {
    mockUserFound()
    mockResendSuccess()
    await notifyDeadline(USER_ID, "SNAP", "2026-05-01", "http://action.url", "Override Name")
    expect(DeadlineEmail).toHaveBeenCalledWith(
      expect.objectContaining({ programName: "SNAP", applicantName: "Override Name" }),
    )
  })
})
