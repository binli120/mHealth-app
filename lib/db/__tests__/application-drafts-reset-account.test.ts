import { beforeEach, describe, expect, it, vi } from "vitest"

const query = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: () => ({ query }),
}))

import { swapPhiDraftResumeId, upsertApplicationDraft } from "@/lib/db/application-drafts"

const USER_ID = "07d7e11d-6a3d-41a8-826d-66e38470c830"
const APPLICANT_ID = "11111111-1111-4111-8111-111111111111"
const APPLICATION_ID = "88cbe518-ea42-476b-a8e9-12207573ff2c"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("upsertApplicationDraft for a reset customer", () => {
  it("recreates the blank applicant shell before saving a new application", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: APPLICANT_ID }] })
      .mockResolvedValueOnce({
        rows: [{
          id: APPLICATION_ID,
          status: "draft",
          application_type: null,
          draft_state: { currentStep: 1 },
          draft_step: 1,
          last_saved_at: "2026-08-07T00:00:00.000Z",
          submitted_at: null,
          created_at: "2026-08-07T00:00:00.000Z",
          updated_at: "2026-08-07T00:00:00.000Z",
          phi_draft_resume_id: null,
        }],
      })

    await expect(upsertApplicationDraft({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      wizardState: { currentStep: 1, submitted: false, data: {} },
    })).resolves.toMatchObject({ id: APPLICATION_ID, status: "draft" })

    expect(String(query.mock.calls[1]?.[0])).toMatch(/INSERT INTO public\.applicants/)
  })

  it("creates the owned application when secure save runs before draft autosave", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: APPLICANT_ID }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ old_id: null }] })

    await expect(swapPhiDraftResumeId({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      newResumeId: "22222222-2222-4222-8222-222222222222",
      keyEnc: "encrypted-key",
    })).resolves.toEqual({ previousResumeId: null })

    expect(String(query.mock.calls[2]?.[0])).toMatch(/INSERT INTO public\.applications/)
  })
})
