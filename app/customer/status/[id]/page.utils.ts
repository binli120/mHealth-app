/**
 * Utility functions for the Application Status Detail page.
 * @author Bin Lee
 */

import { getMessage } from "@/lib/i18n/messages"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import { formatDate, formatDateTime } from "@/lib/utils/format"
import { getApplicationTypeLabel as libGetApplicationTypeLabel } from "@/lib/masshealth/application-types"
import type { ApplicationDraftRecord, TimelineEvent } from "./page.types"

// Re-export so page components and existing tests can import from here.
export { formatDate, formatDateTime }

export function readContactField(record: ApplicationDraftRecord | null, key: string): string {
  const data = (record?.draftState?.data as Record<string, unknown> | undefined) ?? {}
  const contact = (data.contact as Record<string, unknown> | undefined) ?? {}
  const raw = contact[key]
  return typeof raw === "string" ? raw.trim() : ""
}

export function readHouseholdSize(record: ApplicationDraftRecord | null): number | null {
  const value = readContactField(record, "p1_num_people")
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function readCurrentIncome(record: ApplicationDraftRecord | null): string {
  const data = (record?.draftState?.data as Record<string, unknown> | undefined) ?? {}
  const persons = (data.persons as Array<Record<string, unknown>> | undefined) ?? []
  const firstPerson = persons[0]
  if (!firstPerson) {
    return "—"
  }

  const incomeSection = (firstPerson.income as Record<string, unknown> | undefined) ?? {}
  const totalCurrentYear = incomeSection.total_income_current_year
  if (typeof totalCurrentYear === "string" && totalCurrentYear.trim()) {
    return totalCurrentYear
  }

  return "—"
}

export function buildTimeline(record: ApplicationDraftRecord | null, language: SupportedLanguage): TimelineEvent[] {
  if (!record) {
    return []
  }

  const events: TimelineEvent[] = [
    {
      id: "started",
      title: getMessage(language, "statusDetailStartedTitle"),
      description: getMessage(language, "statusDetailStartedDesc"),
      date: formatDateTime(record.createdAt, language),
      state: "completed",
    },
  ]

  if (record.lastSavedAt) {
    events.push({
      id: "saved",
      title: getMessage(language, "statusDetailSavedTitle"),
      description: `${getMessage(language, "statusDetailSavedDescPrefix")} ${record.draftStep ?? "—"}.`,
      date: formatDateTime(record.lastSavedAt, language),
      state: record.status === "draft" ? "current" : "completed",
    })
  }

  if (record.submittedAt || record.status !== "draft") {
    events.push({
      id: "submitted",
      title: getMessage(language, "statusDetailSubmittedTitle"),
      description: getMessage(language, "statusDetailSubmittedDesc"),
      date: formatDateTime(record.submittedAt, language),
      state:
        record.status === "draft"
          ? "pending"
          : record.status === "submitted" ||
              record.status === "ai_extracted" ||
              record.status === "needs_review" ||
              record.status === "rfi_requested"
            ? "current"
            : "completed",
    })
  }

  events.push({
    id: "decision",
    title: getMessage(language, "statusDetailDecisionTitle"),
    description: getMessage(language, "statusDetailDecisionDesc"),
    date: record.status === "approved" || record.status === "denied"
      ? getMessage(language, "statusDetailCompleted")
      : getMessage(language, "statusDetailPending"),
    state: record.status === "approved" || record.status === "denied" ? "completed" : "pending",
  })

  return events
}

export function getApplicationTypeLabel(type: string | null, language: SupportedLanguage): string {
  return libGetApplicationTypeLabel(type, getMessage(language, "statusListApplicationFallback"))
}
