/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const query = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: () => ({ query }),
}))

import { MAX_APPLICATION_DRAFT_STEP, upsertApplicationDraft } from "@/lib/db/application-drafts"
import { SERVER_DRAFT_MAX_STEP } from "@/lib/masshealth/saca2/wizard-state"

const USER_ID = "07d7e11d-6a3d-41a8-826d-66e38470c830"
const APPLICANT_ID = "11111111-1111-4111-8111-111111111111"
const APPLICATION_ID = "88cbe518-ea42-476b-a8e9-12207573ff2c"

const DRAFT_ROW = {
  id: APPLICATION_ID,
  status: "draft",
  application_type: "saca2",
  draft_state: {},
  draft_step: 2,
  last_saved_at: "2026-10-13T00:00:00.000Z",
  submitted_at: null,
  created_at: "2026-10-13T00:00:00.000Z",
  updated_at: "2026-10-13T00:00:00.000Z",
  phi_draft_resume_id: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ id: APPLICANT_ID }] })
    .mockResolvedValueOnce({ rows: [DRAFT_ROW] })
})

describe("upsertApplicationDraft PHI stripping", () => {
  it("keeps the client and server draft step caps in sync", () => {
    expect(SERVER_DRAFT_MAX_STEP).toBe(MAX_APPLICATION_DRAFT_STEP)
  })

  it("removes every SACA-2 PHI key from the persisted draft_state but keeps server-safe keys", async () => {
    await upsertApplicationDraft({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      applicationType: "saca2",
      wizardState: {
        schemaVersion: "saca2-2026-08",
        currentStep: 2,
        data: {
          intake: { programs: { longTermCare: true } },
          signature: { signedBy: "applicant" },
          screening: { commonHealthTenYears: "yes" },
          persons: [{ firstName: "Ada", ssn: "123456789" }],
          aian: { anyMember: "yes" },
          previousMedicalBills: { hasBills: "yes" },
          assets: { bankAccounts: [{ accountNumber: "9999" }] },
          transfers: [{ amount: 1 }],
          health: { employerOfferedCoverage: "yes" },
          pca: { needsPca: "yes" },
          supplements: { a: {} },
          signing: { responsibleParty: { ssn: "987654321", firstName: "Pat" } },
          attachments: { ard: { repName: "Quinn Rep" }, irs4506: { taxpayerId: "900701234" } },
        },
      },
    })

    const call = query.mock.calls.find((c) => /INSERT INTO public\.applications \(/.test(String(c[0])))
    const saved = JSON.parse(String((call?.[1] as unknown[])[4])) as { data: Record<string, unknown> }
    expect(Object.keys(saved.data).sort()).toEqual(["intake", "signature"])
    expect(JSON.stringify(saved)).not.toMatch(/Ada|123456789|9999|987654321|Pat|Quinn|900701234/)
  })

  it("treats a differing schemaVersion as a different document in the ON CONFLICT guard", async () => {
    await upsertApplicationDraft({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      applicationType: "saca2",
      wizardState: { schemaVersion: "saca2-2026-08", currentStep: 2, data: { intake: {} } },
    })

    const call = query.mock.calls.find((c) => /INSERT INTO public\.applications \(/.test(String(c[0])))
    const sql = String(call?.[0]).replace(/\s+/g, " ")
    const versionDiffers =
      "(public.applications.draft_state->>'schemaVersion') IS DISTINCT FROM ($5::jsonb->>'schemaVersion')"
    expect(sql).toContain(
      `draft_state = CASE WHEN ${versionDiffers} OR COALESCE(public.applications.draft_step, 0) <= $6::int THEN $5::jsonb ELSE public.applications.draft_state END`,
    )
    expect(sql).toContain(
      `draft_step = CASE WHEN ${versionDiffers} THEN $6::int ELSE GREATEST(COALESCE(public.applications.draft_step, 0), $6::int) END`,
    )

    const params = call?.[1] as unknown[]
    expect(params).toHaveLength(7)
    expect(JSON.parse(String(params[4])).schemaVersion).toBe("saca2-2026-08")
    expect(params[5]).toBe(2)
  })
})
