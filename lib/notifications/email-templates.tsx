/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

import {
  bodyStyle,
  btnStyle,
  containerStyle,
  footerStyle,
  footerTextStyle,
  h1Style,
  h2Style,
  headerStyle,
  pStyle,
  sectionStyle,
} from "./email-templates.styles"

function Header() {
  return (
    <div style={headerStyle}>
      <h1 style={h1Style}>HealthCompass MA</h1>
    </div>
  )
}

function Footer({ prefsUrl }: Readonly<{ prefsUrl: string }>) {
  return (
    <div style={footerStyle}>
      <Text style={footerTextStyle}>
        HealthCompass MA &bull; Sent because you have notifications enabled.{" "}
        <a href={prefsUrl} style={{ color: "#6b7280" }}>Manage preferences</a>
      </Text>
    </div>
  )
}

// ── Status change ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  submitted:     { label: "Submitted",       color: "#1d4ed8", bg: "#dbeafe" },
  in_review:     { label: "Under Review",    color: "#b45309", bg: "#fef3c7" },
  approved:      { label: "Approved",        color: "#166534", bg: "#dcfce7" },
  denied:        { label: "Denied",          color: "#991b1b", bg: "#fee2e2" },
  pending:       { label: "Action Required", color: "#92400e", bg: "#fef3c7" },
  rfi_requested: { label: "Info Needed",     color: "#92400e", bg: "#fef3c7" },
}

export interface StatusChangeEmailProps {
  applicantName: string
  applicationId: string
  newStatus: string
  dashboardUrl: string
  prefsUrl: string
}

export function StatusChangeEmail({ applicantName, applicationId, newStatus, dashboardUrl, prefsUrl }: Readonly<StatusChangeEmailProps>) {
  const statusInfo = STATUS_LABELS[newStatus] ?? { label: newStatus, color: "#374151", bg: "#f3f4f6" }
  return (
    <Html>
      <Head />
      <Preview>Your application status has changed to {statusInfo.label}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Header />
          <Section style={sectionStyle}>
            <Heading style={h2Style}>Your application status has changed</Heading>
            <Text style={pStyle}>Hi {applicantName},</Text>
            <Text style={pStyle}>Your MassHealth application has been updated.</Text>
            <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: "99px", backgroundColor: statusInfo.bg, color: statusInfo.color, fontSize: "12px", fontWeight: "600", marginBottom: "16px" }}>
              {statusInfo.label}
            </div>
            <Text style={pStyle}>Application ID: <strong>{applicationId}</strong></Text>
            <Text style={pStyle}>Log in to your dashboard to see full details and any required next steps.</Text>
            <Button href={dashboardUrl} style={btnStyle}>View Application</Button>
          </Section>
          <Footer prefsUrl={prefsUrl} />
        </Container>
      </Body>
    </Html>
  )
}

// ── Document request ────────────────────────────────────────────────────────

export interface DocumentRequestEmailProps {
  applicantName: string
  documentType: string
  dueDate: string
  uploadUrl: string
  prefsUrl: string
}

export function DocumentRequestEmail({ applicantName, documentType, dueDate, uploadUrl, prefsUrl }: Readonly<DocumentRequestEmailProps>) {
  return (
    <Html>
      <Head />
      <Preview>Action Required: Please upload {documentType}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Header />
          <Section style={sectionStyle}>
            <Heading style={h2Style}>Document requested for your application</Heading>
            <Text style={pStyle}>Hi {applicantName},</Text>
            <Text style={pStyle}>We need the following document to continue processing your application:</Text>
            <div style={{ backgroundColor: "#f3f4f6", borderRadius: "6px", padding: "12px 16px", marginBottom: "16px" }}>
              <strong style={{ color: "#111827" }}>{documentType}</strong>
            </div>
            <Text style={pStyle}>Please upload this document by <strong>{dueDate}</strong> to avoid delays.</Text>
            <Button href={uploadUrl} style={btnStyle}>Upload Document</Button>
          </Section>
          <Footer prefsUrl={prefsUrl} />
        </Container>
      </Body>
    </Html>
  )
}

// ── Renewal reminder ────────────────────────────────────────────────────────

export interface RenewalReminderEmailProps {
  applicantName: string
  programName: string
  renewalDate: string
  daysLeft: number
  renewalUrl: string
  prefsUrl: string
}

export function RenewalReminderEmail({ applicantName, programName, renewalDate, daysLeft, renewalUrl, prefsUrl }: Readonly<RenewalReminderEmailProps>) {
  return (
    <Html>
      <Head />
      <Preview>{`${programName} renewal due in ${daysLeft} days — act now to keep your coverage`}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Header />
          <Section style={sectionStyle}>
            <Heading style={h2Style}>{programName} renewal coming up</Heading>
            <Text style={pStyle}>Hi {applicantName},</Text>
            <Text style={pStyle}>
              Your <strong>{programName}</strong> coverage is due for renewal on{" "}
              <strong>{renewalDate}</strong> — that&apos;s {daysLeft} days from now.
            </Text>
            <Text style={pStyle}>To avoid a gap in coverage, please complete your renewal before the deadline.</Text>
            <Button href={renewalUrl} style={btnStyle}>Start Renewal</Button>
          </Section>
          <Footer prefsUrl={prefsUrl} />
        </Container>
      </Body>
    </Html>
  )
}

// ── Deadline ────────────────────────────────────────────────────────────────

export interface DeadlineEmailProps {
  applicantName: string
  programName: string
  deadline: string
  actionUrl: string
  prefsUrl: string
}

export function DeadlineEmail({ applicantName, programName, deadline, actionUrl, prefsUrl }: Readonly<DeadlineEmailProps>) {
  return (
    <Html>
      <Head />
      <Preview>Upcoming deadline for {programName}: {deadline}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Header />
          <Section style={sectionStyle}>
            <Heading style={h2Style}>Upcoming deadline for {programName}</Heading>
            <Text style={pStyle}>Hi {applicantName},</Text>
            <Text style={pStyle}>
              There is an important deadline for <strong>{programName}</strong> on{" "}
              <strong>{deadline}</strong>.
            </Text>
            <Text style={pStyle}>Take action now to make sure you don&apos;t miss out on your benefits.</Text>
            <Button href={actionUrl} style={btnStyle}>Take Action</Button>
          </Section>
          <Footer prefsUrl={prefsUrl} />
        </Container>
      </Body>
    </Html>
  )
}

// ── Session invite ───────────────────────────────────────────────────────────

export interface SessionInviteEmailProps {
  patientName: string
  swName: string
  scheduledAt: string | null
  inviteMessage: string | null
  sessionUrl: string
  prefsUrl: string
}

export function SessionInviteEmail({ patientName, swName, scheduledAt, inviteMessage, sessionUrl, prefsUrl }: Readonly<SessionInviteEmailProps>) {
  return (
    <Html>
      <Head />
      <Preview>{swName} has invited you to a session on HealthCompass MA</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Header />
          <Section style={sectionStyle}>
            <Heading style={h2Style}>You have a session invitation</Heading>
            <Text style={pStyle}>Hi {patientName},</Text>
            <Text style={pStyle}>
              Your social worker <strong>{swName}</strong> has invited you to a
              collaborative session on HealthCompass MA.
            </Text>
            {scheduledAt && (
              <div style={{ backgroundColor: "#eff6ff", borderRadius: "6px", padding: "12px 16px", marginBottom: "16px" }}>
                <Text style={{ ...pStyle, margin: "0", color: "#1d4ed8" }}>
                  Scheduled for: <strong>{scheduledAt}</strong>
                </Text>
              </div>
            )}
            {inviteMessage && (
              <div style={{ backgroundColor: "#f3f4f6", borderRadius: "6px", padding: "12px 16px", marginBottom: "16px", borderLeft: "3px solid #d1d5db" }}>
                <Text style={{ ...pStyle, margin: "0", fontStyle: "italic" }}>
                  &ldquo;{inviteMessage}&rdquo;
                </Text>
              </div>
            )}
            <Text style={pStyle}>During the session, you will be able to see your social worker&apos;s screen and chat with them in real time.</Text>
            <Button href={sessionUrl} style={btnStyle}>View Invitation</Button>
          </Section>
          <Footer prefsUrl={prefsUrl} />
        </Container>
      </Body>
    </Html>
  )
}

// ── Session starting ─────────────────────────────────────────────────────────

export interface SessionStartingEmailProps {
  patientName: string
  swName: string
  sessionUrl: string
  prefsUrl: string
}

export function SessionStartingEmail({ patientName, swName, sessionUrl, prefsUrl }: Readonly<SessionStartingEmailProps>) {
  return (
    <Html>
      <Head />
      <Preview>Your session with {swName} is starting now — join now</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Header />
          <Section style={sectionStyle}>
            <Heading style={h2Style}>Your session is starting now</Heading>
            <Text style={pStyle}>Hi {patientName},</Text>
            <Text style={pStyle}>
              <strong>{swName}</strong> has started your session and is ready to meet with you.
              Join now to connect.
            </Text>
            <div style={{ backgroundColor: "#dcfce7", borderRadius: "6px", padding: "12px 16px", marginBottom: "16px" }}>
              <Text style={{ ...pStyle, margin: "0", color: "#166534", fontWeight: "600" as const }}>
                Session is live — join now
              </Text>
            </div>
            <Button href={sessionUrl} style={{ ...btnStyle, backgroundColor: "#16a34a" }}>Join Session</Button>
          </Section>
          <Footer prefsUrl={prefsUrl} />
        </Container>
      </Body>
    </Html>
  )
}
