/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Utility functions for the Customer Dashboard page.
 * @author: Bin Lee
 */

import { getApplicationTypeLabel as libGetApplicationTypeLabel } from "@/lib/masshealth/application-types"
import type { ApplicationListRecord } from "@/lib/applications/types"
import { formatDate } from "@/lib/utils/format"

export interface DashboardGreeting {
  heading: string
  message: string
  cta?: {
    href: string
    label: string
  }
}

/**
 * Resolve a display label for the given application type id.
 * Delegates to the shared lib utility with the English-only default fallback.
 */
export function getApplicationTypeLabel(type: string | null): string {
  return libGetApplicationTypeLabel(type, "Application")
}

export function getTimeOfDayGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function getRecordTime(record: ApplicationListRecord): number {
  return new Date(record.lastSavedAt ?? record.updatedAt).getTime()
}

export function getLatestDraftApplication(applications: ApplicationListRecord[]): ApplicationListRecord | undefined {
  return applications
    .filter((item) => item.status === "draft")
    .sort((a, b) => getRecordTime(b) - getRecordTime(a))[0]
}

export function buildDashboardGreeting({
  applications,
  greetingName,
  now,
  unreadNotificationCount,
}: {
  applications: ApplicationListRecord[]
  greetingName: string
  now: Date
  unreadNotificationCount: number
}): DashboardGreeting {
  const timeGreeting = getTimeOfDayGreeting(now)
  const firstNameForGreeting = greetingName || "there"
  const needsActionApp = applications.find((item) => item.status === "rfi_requested")
  const draftApplication = getLatestDraftApplication(applications)
  const notificationLabel = unreadNotificationCount === 1 ? "notification" : "notifications"

  if (needsActionApp) {
    return {
      heading: `${timeGreeting}, ${firstNameForGreeting}. MassHealth needs something from you.`,
      message: `Application ${needsActionApp.id} has an action item. Review it so your case can keep moving.`,
      cta: {
        href: `/customer/status/${needsActionApp.id}`,
        label: "Review request",
      },
    }
  }

  if (unreadNotificationCount > 0) {
    return {
      heading: `${timeGreeting}, ${firstNameForGreeting}. You have ${unreadNotificationCount} new ${notificationLabel}.`,
      message: "Check your updates for status changes, messages, document requests, or session invitations.",
      cta: {
        href: "/notifications",
        label: "Check notifications",
      },
    }
  }

  if (draftApplication) {
    return {
      heading: `${timeGreeting}, ${firstNameForGreeting}. Want to continue your unfinished application?`,
      message: `${getApplicationTypeLabel(draftApplication.applicationType)} was last saved ${formatDate(draftApplication.lastSavedAt ?? draftApplication.updatedAt)}.`,
      cta: {
        href: `/application/new?applicationId=${draftApplication.id}`,
        label: "Continue application",
      },
    }
  }

  if (applications.length === 0) {
    return {
      heading: `${timeGreeting}, ${firstNameForGreeting}. How can I help you today?`,
      message: "You can start a MassHealth application, screen for benefits, or invite a social worker to help.",
      cta: {
        href: "/application/type",
        label: "Start application",
      },
    }
  }

  return {
    heading: `${timeGreeting}, ${firstNameForGreeting}. Here is where things stand today.`,
    message: "Your recent applications, activity, and support options are ready below.",
    cta: {
      href: "/customer/status",
      label: "View status",
    },
  }
}
