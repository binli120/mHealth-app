import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
  logServerInfo: vi.fn(),
}))

vi.mock("@/lib/masshealth/benefit-policy-updates-client", () => ({
  fetchBenefitPolicyUpdatesFromAnalysisService: vi.fn(),
  fetchBenefitPolicyUpdatesFromLocalPython: vi.fn(),
}))

import { POST } from "@/app/api/masshealth/benefit-policy-updates/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  fetchBenefitPolicyUpdatesFromAnalysisService,
  fetchBenefitPolicyUpdatesFromLocalPython,
} from "@/lib/masshealth/benefit-policy-updates-client"

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/masshealth/benefit-policy-updates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const upstreamResponse = {
  ok: true,
  findings: [
    {
      source_url: "https://www.mass.gov/example",
      source_title: "MassHealth update",
      disease_profile: "dental",
      profile_name: "dental",
      profile_type: "benefit",
      change_signal: "policy_review",
      benefits: ["dental"],
      programs: [],
      diseases: [],
      treatments: [],
      conditions: ["claims"],
      effective_dates: [],
      evidence: ["Dental claim submission extension."],
      snapshot_status: "new",
      content_hash: "abc123",
    },
  ],
  fetch_failures: [],
  source: "analysis-service",
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
  vi.mocked(fetchBenefitPolicyUpdatesFromAnalysisService).mockResolvedValue(upstreamResponse as never)
  vi.mocked(fetchBenefitPolicyUpdatesFromLocalPython).mockResolvedValue({
    ...upstreamResponse,
    source: "local-python",
    degraded: true,
  } as never)
})

describe("POST /api/masshealth/benefit-policy-updates", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)

    const response = await POST(makeRequest({ benefitNames: ["Dental"] }))

    expect(response.status).toBe(401)
    expect(fetchBenefitPolicyUpdatesFromAnalysisService).not.toHaveBeenCalled()
  })

  it("validates benefitNames", async () => {
    const response = await POST(makeRequest({ benefitNames: [] }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/at least one/i)
  })

  it("proxies valid requests to the analysis service", async () => {
    const response = await POST(makeRequest({ benefitNames: [" Dental ", "Pharmacy"], includeUnchanged: true }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.source).toBe("analysis-service")
    expect(fetchBenefitPolicyUpdatesFromAnalysisService).toHaveBeenCalledWith(
      { benefitNames: ["Dental", "Pharmacy"], includeUnchanged: true },
      expect.objectContaining({ userId: USER_ID }),
    )
  })

  it("falls back to local python monitor when analysis service fails", async () => {
    vi.mocked(fetchBenefitPolicyUpdatesFromAnalysisService).mockRejectedValue(new Error("down"))

    const response = await POST(makeRequest({ benefitNames: ["PCA services"] }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.source).toBe("local-python")
    expect(json.degraded).toBe(true)
    expect(fetchBenefitPolicyUpdatesFromLocalPython).toHaveBeenCalledWith({
      benefitNames: ["PCA services"],
      includeUnchanged: false,
    })
  })
})
