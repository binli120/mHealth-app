/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import { createNotification, notificationExistsForPolicyUpdate } from "@/lib/db/notifications"
import {
  fetchBenefitPolicyUpdatesFromAnalysisService,
  fetchBenefitPolicyUpdatesFromLocalPython,
  type BenefitPolicyFinding,
} from "@/lib/masshealth/benefit-policy-updates-client"

const ANALYSIS_BASE = process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL ?? "http://localhost:8000"
const MASSHEALTH_API_TOKEN = process.env.MASSHEALTH_API_TOKEN ?? ""
const MAX_BENEFIT_NAMES = 20
const BENEFIT_UPDATE_NOTIFICATION_LIMIT = 5

const BENEFIT_NAME_KEYS = new Set([
  "appliedBenefit",
  "appliedBenefits",
  "benefit",
  "benefitName",
  "benefitNames",
  "benefits",
  "eligible_program",
  "eligibleProgram",
  "program",
  "programName",
  "programNames",
  "selectedBenefit",
  "selectedBenefits",
])

const MASSHEALTH_APPLICATION_TYPE_BENEFITS: Record<string, string[]> = {
  "aca_3": ["MassHealth", "Dental Benefits", "Pharmacy"],
  "aca3": ["MassHealth", "Dental Benefits", "Pharmacy"],
  "aca_3_ap": ["MassHealth", "Dental Benefits", "Pharmacy"],
  "aca3ap": ["MassHealth", "Dental Benefits", "Pharmacy"],
  "saca_2": ["MassHealth", "PCA services", "Long-term services and supports"],
  "saca2": ["MassHealth", "PCA services", "Long-term services and supports"],
}

export interface NotifyBenefitPolicyUpdatesInput {
  userId: string
  applicationId: string
  applicationType?: string | null
  wizardState?: Record<string, unknown> | null
  benefitNames?: string[]
}

export interface NotifyBenefitPolicyUpdatesResult {
  checked: boolean
  notified: boolean
  benefitNames: string[]
  findingCount: number
  reason?: "no_benefits" | "no_new_findings" | "duplicate"
}

export async function notifyBenefitPolicyUpdatesForApplication(
  input: NotifyBenefitPolicyUpdatesInput,
): Promise<NotifyBenefitPolicyUpdatesResult> {
  const benefitNames = collectAppliedBenefitNames(input)
  if (benefitNames.length === 0) {
    return { checked: false, notified: false, benefitNames, findingCount: 0, reason: "no_benefits" }
  }

  const response = await fetchPolicyUpdates(input.userId, benefitNames)
  const findings = response.findings.filter(isNotificationWorthyFinding)
  if (findings.length === 0) {
    return { checked: true, notified: false, benefitNames, findingCount: 0, reason: "no_new_findings" }
  }

  const contentHashes = uniqueStrings(findings.map((finding) => finding.content_hash).filter(Boolean))
  if (
    await notificationExistsForPolicyUpdate({
      userId: input.userId,
      applicationId: input.applicationId,
      contentHashes,
    })
  ) {
    return { checked: true, notified: false, benefitNames, findingCount: findings.length, reason: "duplicate" }
  }

  const topFindings = findings.slice(0, BENEFIT_UPDATE_NOTIFICATION_LIMIT)
  const title = buildNotificationTitle(topFindings)
  const body = buildNotificationBody(topFindings, findings.length)

  await createNotification({
    userId: input.userId,
    type: "general",
    title,
    body,
    metadata: {
      kind: "benefit_policy_update",
      applicationId: input.applicationId,
      benefitNames,
      contentHashes,
      findingCount: findings.length,
      findings: topFindings.map(toNotificationFinding),
    },
  })

  return { checked: true, notified: true, benefitNames, findingCount: findings.length }
}

export function collectAppliedBenefitNames(input: {
  applicationType?: string | null
  wizardState?: Record<string, unknown> | null
  benefitNames?: string[]
}): string[] {
  const names: string[] = []
  addStrings(names, input.benefitNames)

  const normalizedType = normalizeKey(input.applicationType)
  if (normalizedType && MASSHEALTH_APPLICATION_TYPE_BENEFITS[normalizedType]) {
    addStrings(names, MASSHEALTH_APPLICATION_TYPE_BENEFITS[normalizedType])
  }

  collectFromAllowedBenefitKeys(input.wizardState, names)
  return uniqueStrings(names).slice(0, MAX_BENEFIT_NAMES)
}

async function fetchPolicyUpdates(userId: string, benefitNames: string[]) {
  try {
    return await fetchBenefitPolicyUpdatesFromAnalysisService(
      { benefitNames, includeUnchanged: false },
      {
        baseUrl: ANALYSIS_BASE,
        apiToken: MASSHEALTH_API_TOKEN,
        userId,
      },
    )
  } catch {
    return fetchBenefitPolicyUpdatesFromLocalPython({ benefitNames, includeUnchanged: false })
  }
}

function collectFromAllowedBenefitKeys(value: unknown, names: string[]): void {
  if (!value || typeof value !== "object") {
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectFromAllowedBenefitKeys(item, names)
    }
    return
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (BENEFIT_NAME_KEYS.has(key)) {
      addStrings(names, child)
    }
    if (child && typeof child === "object") {
      collectFromAllowedBenefitKeys(child, names)
    }
  }
}

function addStrings(target: string[], value: unknown): void {
  if (typeof value === "string") {
    const cleaned = cleanBenefitName(value)
    if (cleaned) {
      target.push(cleaned)
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      addStrings(target, item)
    }
  }
}

function cleanBenefitName(value: string): string | null {
  const cleaned = value.trim().replace(/\s+/g, " ")
  if (!cleaned || cleaned.length > 120) {
    return null
  }
  return cleaned
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(value)
  }
  return result
}

function normalizeKey(value?: string | null): string | null {
  if (!value) {
    return null
  }
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

function isNotificationWorthyFinding(finding: BenefitPolicyFinding): boolean {
  return finding.snapshot_status !== "unchanged" && finding.change_signal !== "none"
}

function buildNotificationTitle(findings: BenefitPolicyFinding[]): string {
  const first = findings[0]
  if (!first) {
    return "MassHealth benefit policy updates"
  }
  const name = first.profile_name || first.disease_profile || first.benefits[0] || "benefit"
  return `MassHealth update for ${name.replace(/_/g, " ")}`
}

function buildNotificationBody(findings: BenefitPolicyFinding[], totalCount: number): string {
  const first = findings[0]
  const source = first?.source_title || "MassHealth"
  const extra = totalCount > findings.length ? ` and ${totalCount - findings.length} more` : ""
  return `New MassHealth policy information may affect applied benefits. Review ${findings.length}${extra} update(s), starting with ${source}.`
}

function toNotificationFinding(finding: BenefitPolicyFinding) {
  return {
    source_url: finding.source_url,
    source_title: finding.source_title,
    profile_name: finding.profile_name,
    profile_type: finding.profile_type,
    change_signal: finding.change_signal,
    benefits: finding.benefits,
    programs: finding.programs,
    diseases: finding.diseases,
    treatments: finding.treatments,
    conditions: finding.conditions,
    effective_dates: finding.effective_dates,
    evidence: finding.evidence.slice(0, 3),
    snapshot_status: finding.snapshot_status,
    content_hash: finding.content_hash,
  }
}
