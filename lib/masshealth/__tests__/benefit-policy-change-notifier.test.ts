/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/notifications", () => ({
  createNotification: vi.fn(),
  notificationExistsForPolicyUpdate: vi.fn(),
}))

vi.mock("@/lib/masshealth/benefit-policy-updates-client", () => ({
  fetchBenefitPolicyUpdatesFromAnalysisService: vi.fn(),
  fetchBenefitPolicyUpdatesFromLocalPython: vi.fn(),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

import { createNotification, notificationExistsForPolicyUpdate } from "@/lib/db/notifications"
import {
  fetchBenefitPolicyUpdatesFromAnalysisService,
  fetchBenefitPolicyUpdatesFromLocalPython,
  type BenefitPolicyFinding,
} from "@/lib/masshealth/benefit-policy-updates-client"
import {
  collectAppliedBenefitNames,
  notifyBenefitPolicyUpdatesForApplication,
} from "@/lib/masshealth/benefit-policy-change-notifier"

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const APPLICATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

function makeFinding(overrides: Partial<BenefitPolicyFinding> = {}): BenefitPolicyFinding {
  return {
    source_url: "https://www.mass.gov/example",
    source_title: "MassHealth Pharmacy Facts",
    disease_profile: "pharmacy",
    profile_name: "pharmacy",
    profile_type: "benefit",
    change_signal: "policy_review",
    benefits: ["pharmacy"],
    programs: ["MassHealth"],
    diseases: [],
    treatments: ["GLP-1"],
    conditions: ["prior authorization"],
    effective_dates: [],
    evidence: ["Updated pharmacy coverage language."],
    snapshot_status: "unchanged",
    content_hash: "hash-1",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(notificationExistsForPolicyUpdate).mockResolvedValue(false)
  vi.mocked(fetchBenefitPolicyUpdatesFromAnalysisService).mockResolvedValue({
    ok: true,
    findings: [makeFinding()],
    fetch_failures: [],
    source: "analysis-service",
  })
})

describe("collectAppliedBenefitNames", () => {
  it("maps ACA-3 applications to MassHealth, HSN, dental, and pharmacy benefit names", () => {
    expect(collectAppliedBenefitNames({ applicationType: "ACA-3" })).toEqual([
      "MassHealth",
      "Health Safety Net",
      "Dental Benefits",
      "Pharmacy",
    ])
  })

  it("collects explicit benefit fields and dedupes them case-insensitively", () => {
    const names = collectAppliedBenefitNames({
      applicationType: "hsn",
      wizardState: {
        data: {
          benefitNames: ["health safety net", "Pharmacy"],
          ignoredFreeText: "not a benefit",
        },
      },
      benefitNames: ["Dental Benefits", "dental benefits"],
    })

    expect(names).toEqual(["Dental Benefits", "Health Safety Net", "Pharmacy"])
  })

  it("returns no benefit names when neither application type nor allowed fields are present", () => {
    expect(collectAppliedBenefitNames({ wizardState: { data: { notes: "HSN" } } })).toEqual([])
  })
})

describe("notifyBenefitPolicyUpdatesForApplication", () => {
  it("skips the monitor when no benefit names can be derived", async () => {
    const result = await notifyBenefitPolicyUpdatesForApplication({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      wizardState: { data: { notes: "No structured benefits." } },
    })

    expect(result).toMatchObject({
      checked: false,
      notified: false,
      reason: "no_benefits",
    })
    expect(fetchBenefitPolicyUpdatesFromAnalysisService).not.toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })

  it("creates a policy update notification for relevant analysis-service findings", async () => {
    const result = await notifyBenefitPolicyUpdatesForApplication({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      applicationType: "ACA-3",
    })

    expect(result).toMatchObject({ checked: true, notified: true, findingCount: 1 })
    expect(fetchBenefitPolicyUpdatesFromAnalysisService).toHaveBeenCalledWith(
      { benefitNames: ["MassHealth", "Health Safety Net", "Dental Benefits", "Pharmacy"], includeUnchanged: true },
      expect.objectContaining({ userId: USER_ID }),
    )
    expect(notificationExistsForPolicyUpdate).toHaveBeenCalledWith({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      contentHashes: ["hash-1"],
    })
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        type: "general",
        title: "MassHealth update for pharmacy",
        metadata: expect.objectContaining({
          kind: "benefit_policy_update",
          applicationId: APPLICATION_ID,
          contentHashes: ["hash-1"],
          findingCount: 1,
        }),
      }),
    )
  })

  it("does not create a duplicate notification for already-notified content hashes", async () => {
    vi.mocked(notificationExistsForPolicyUpdate).mockResolvedValue(true)

    const result = await notifyBenefitPolicyUpdatesForApplication({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      applicationType: "ACA-3",
    })

    expect(result).toMatchObject({ checked: true, notified: false, reason: "duplicate" })
    expect(createNotification).not.toHaveBeenCalled()
  })

  it("ignores findings that have no change signal", async () => {
    vi.mocked(fetchBenefitPolicyUpdatesFromAnalysisService).mockResolvedValue({
      ok: true,
      findings: [makeFinding({ change_signal: "none" })],
      fetch_failures: [],
      source: "analysis-service",
    })

    const result = await notifyBenefitPolicyUpdatesForApplication({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      applicationType: "ACA-3",
    })

    expect(result).toMatchObject({
      checked: true,
      notified: false,
      reason: "no_relevant_findings",
    })
    expect(createNotification).not.toHaveBeenCalled()
  })

  it("falls back to the local python monitor when the analysis service fails", async () => {
    vi.mocked(fetchBenefitPolicyUpdatesFromAnalysisService).mockRejectedValue(new Error("analysis down"))
    vi.mocked(fetchBenefitPolicyUpdatesFromLocalPython).mockResolvedValue({
      ok: true,
      findings: [makeFinding({ profile_name: "dental", benefits: ["dental"], content_hash: "hash-2" })],
      fetch_failures: [],
      source: "local-python",
      degraded: true,
    })

    const result = await notifyBenefitPolicyUpdatesForApplication({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      benefitNames: ["Dental Benefits"],
    })

    expect(result).toMatchObject({ checked: true, notified: true, findingCount: 1 })
    expect(fetchBenefitPolicyUpdatesFromLocalPython).toHaveBeenCalledWith({
      benefitNames: ["Dental Benefits"],
      includeUnchanged: true,
    })
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "MassHealth update for dental",
      }),
    )
  })

  it("degrades gracefully when both the analysis service and local monitor fail", async () => {
    vi.mocked(fetchBenefitPolicyUpdatesFromAnalysisService).mockRejectedValue(new Error("analysis down"))
    vi.mocked(fetchBenefitPolicyUpdatesFromLocalPython).mockRejectedValue(new Error("ENOENT: python missing"))

    const result = await notifyBenefitPolicyUpdatesForApplication({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      benefitNames: ["Dental Benefits"],
    })

    expect(result).toMatchObject({ checked: false, notified: false, reason: "unavailable" })
    expect(createNotification).not.toHaveBeenCalled()
  })
})
