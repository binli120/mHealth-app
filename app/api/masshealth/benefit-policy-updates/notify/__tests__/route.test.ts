/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/db/application-drafts", () => ({
  listAppliedApplicationsForPolicyUpdates: vi.fn(),
}))

vi.mock("@/lib/masshealth/benefit-policy-change-notifier", () => ({
  notifyBenefitPolicyUpdatesForApplication: vi.fn(),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
  logServerInfo: vi.fn(),
}))

import { POST } from "@/app/api/masshealth/benefit-policy-updates/notify/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { listAppliedApplicationsForPolicyUpdates } from "@/lib/db/application-drafts"
import { notifyBenefitPolicyUpdatesForApplication } from "@/lib/masshealth/benefit-policy-change-notifier"

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function makeRequest(body: unknown = {}): Request {
  return new Request("http://localhost/api/masshealth/benefit-policy-updates/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
})

describe("POST /api/masshealth/benefit-policy-updates/notify", () => {
  it("returns auth failures before querying applications", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false }), { status: 401 }),
    } as never)

    const response = await POST(makeRequest())

    expect(response.status).toBe(401)
    expect(listAppliedApplicationsForPolicyUpdates).not.toHaveBeenCalled()
  })

  it("does not call the monitor when the user has no saved applications", async () => {
    vi.mocked(listAppliedApplicationsForPolicyUpdates).mockResolvedValue([])

    const response = await POST(makeRequest({ limit: 3 }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      checked: false,
      checkedApplications: 0,
      notificationsCreated: 0,
      reason: "no_applications",
    })
    expect(listAppliedApplicationsForPolicyUpdates).toHaveBeenCalledWith(USER_ID, 3)
    expect(notifyBenefitPolicyUpdatesForApplication).not.toHaveBeenCalled()
  })

  it("checks each saved application and reports created notifications", async () => {
    vi.mocked(listAppliedApplicationsForPolicyUpdates).mockResolvedValue([
      {
        id: "app-1",
        status: "draft",
        applicationType: "ACA-3",
        draftState: { data: { benefitNames: ["Health Safety Net"] } },
        submittedAt: null,
      },
      {
        id: "app-2",
        status: "submitted",
        applicationType: "ACA-3",
        draftState: {},
        submittedAt: "2026-06-01T00:00:00.000Z",
      },
    ])
    vi.mocked(notifyBenefitPolicyUpdatesForApplication)
      .mockResolvedValueOnce({
        checked: true,
        notified: true,
        benefitNames: ["Health Safety Net"],
        findingCount: 2,
      })
      .mockResolvedValueOnce({
        checked: true,
        notified: false,
        benefitNames: ["MassHealth"],
        findingCount: 1,
        reason: "duplicate",
      })

    const response = await POST(makeRequest({ limit: 99 }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.checkedApplications).toBe(2)
    expect(payload.notificationsCreated).toBe(1)
    expect(notifyBenefitPolicyUpdatesForApplication).toHaveBeenCalledWith({
      userId: USER_ID,
      applicationId: "app-1",
      applicationType: "ACA-3",
      wizardState: { data: { benefitNames: ["Health Safety Net"] } },
    })
  })

  it("returns 502 when policy update lookup fails", async () => {
    vi.mocked(listAppliedApplicationsForPolicyUpdates).mockRejectedValue(new Error("db down"))

    const response = await POST(makeRequest())
    const payload = await response.json()

    expect(response.status).toBe(502)
    expect(payload).toMatchObject({
      ok: false,
      error: "Failed to check MassHealth benefit policy updates.",
    })
  })
})
