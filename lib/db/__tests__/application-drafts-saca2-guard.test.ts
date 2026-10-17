/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const query = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: () => ({ query }),
}))

import {
  ApplicationDraftAccessError,
  ApplicationDraftTypeConflictError,
  upsertApplicationDraft,
} from "@/lib/db/application-drafts"

const USER_ID = "07d7e11d-6a3d-41a8-826d-66e38470c830"
const APPLICANT_ID = "11111111-1111-4111-8111-111111111111"
const APPLICATION_ID = "88cbe518-ea42-476b-a8e9-12207573ff2c"

const DRAFT_ROW = {
  id: APPLICATION_ID,
  status: "draft",
  application_type: "saca2",
  draft_state: { schemaVersion: 2 },
  draft_step: 2,
  last_saved_at: "2026-10-17T00:00:00.000Z",
  submitted_at: null,
  created_at: "2026-10-17T00:00:00.000Z",
  updated_at: "2026-10-17T00:00:00.000Z",
  phi_draft_resume_id: null,
}

// Applicant lookups (profile + applicant id) precede the upsert statement.
function primeApplicantLookups() {
  query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: APPLICANT_ID }] })
}

const ACA3_STATE = { currentStep: 2, submitted: false, data: {} }
const SACA2_STATE = { schemaVersion: 2, currentStep: 2, submitted: false, data: {} }

beforeEach(() => {
  vi.resetAllMocks()
})

// Three-valued mirror of the guard predicate (null = SQL NULL) for the truth table.
type Tri = boolean | null
const or3 = (a: Tri, b: Tri): Tri => (a === true || b === true ? true : a === null || b === null ? null : false)
const and3 = (a: Tri, b: Tri): Tri => (a === false || b === false ? false : a === null || b === null ? null : true)
const guardAllowsWrite = (storedIsSaca2Type: Tri, storedHasVersion: Tri, incomingHasVersion: boolean) =>
  and3(or3(storedIsSaca2Type, storedHasVersion), !incomingHasVersion) !== true

describe("SACA-2 guard truth table (NULL-safe)", () => {
  it("allows ACA-3 writes onto rows with NULL application_type / draft_state", () => {
    expect(guardAllowsWrite(null, null, false)).toBe(true)
    expect(guardAllowsWrite(false, null, false)).toBe(true)
  })
  it("blocks ACA-3 writes onto SACA-2 rows and never blocks SACA-2 writes", () => {
    expect(guardAllowsWrite(true, null, false)).toBe(false)
    expect(guardAllowsWrite(null, true, false)).toBe(false)
    expect(guardAllowsWrite(true, true, true)).toBe(true)
    expect(guardAllowsWrite(null, null, true)).toBe(true)
  })
})

describe("upsertApplicationDraft SACA-2 guard", () => {
  it("pins a guard that blocks schemaVersion-less writes onto a stored SACA-2 row", async () => {
    primeApplicantLookups()
    query.mockResolvedValueOnce({ rows: [DRAFT_ROW] })

    await upsertApplicationDraft({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      wizardState: ACA3_STATE,
    })

    const sql = String(query.mock.calls[2]?.[0])
    expect(sql).toContain("public.applications.application_type = 'saca2'")
    expect(sql).toContain("jsonb_exists(public.applications.draft_state, 'schemaVersion')")
    expect(sql).toContain("NOT jsonb_exists($5::jsonb, 'schemaVersion')")
    // NULL truth table (do not simplify to NOT(...)): a freshly created row has
    // application_type and/or draft_state NULL, so A (type = 'saca2') is NULL/FALSE and
    // B (jsonb_exists(draft_state, ...)) is NULL. (A OR B) AND NOT incoming is then NULL,
    // and NOT(NULL) is NULL -> the ON CONFLICT WHERE would not be TRUE and block a
    // legitimate ACA-3 save. "IS NOT TRUE" maps NULL to allow.
    expect(sql).toMatch(
      /AND \(\s*\(\s*public\.applications\.application_type = 'saca2'[\s\S]*?\)\s*IS NOT TRUE/,
    )
    expect(sql).not.toMatch(/AND NOT \(\s*\(\s*public\.applications\.application_type/)
  })

  it("throws ApplicationDraftTypeConflictError when the guard blocks an owned row", async () => {
    primeApplicantLookups()
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: APPLICATION_ID }] })

    const promise = upsertApplicationDraft({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      wizardState: ACA3_STATE,
    })
    await expect(promise).rejects.toBeInstanceOf(ApplicationDraftTypeConflictError)
    await expect(promise).rejects.toMatchObject({
      name: "ApplicationDraftTypeConflictError",
      message: "This application is a SACA-2 application and cannot be changed by this form.",
    })

    const lookup = query.mock.calls[3]
    expect(String(lookup?.[0])).toMatch(/SELECT\s+id\s+FROM public\.applications/)
    expect(lookup?.[1]).toEqual([APPLICATION_ID, APPLICANT_ID])
  })

  it("still throws ApplicationDraftAccessError when the row is missing or not owned", async () => {
    primeApplicantLookups()
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })

    await expect(
      upsertApplicationDraft({
        userId: USER_ID,
        applicationId: APPLICATION_ID,
        wizardState: ACA3_STATE,
      }),
    ).rejects.toBeInstanceOf(ApplicationDraftAccessError)
  })

  it("issues exactly one upsert query on the happy path (no extra read)", async () => {
    primeApplicantLookups()
    query.mockResolvedValueOnce({ rows: [DRAFT_ROW] })

    await expect(
      upsertApplicationDraft({
        userId: USER_ID,
        applicationId: APPLICATION_ID,
        wizardState: SACA2_STATE,
      }),
    ).resolves.toMatchObject({ id: APPLICATION_ID })

    expect(query).toHaveBeenCalledTimes(3)
  })

  it("keeps the upsert params order for a SACA-2 write", async () => {
    primeApplicantLookups()
    query.mockResolvedValueOnce({ rows: [DRAFT_ROW] })

    await upsertApplicationDraft({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      applicationType: "saca2",
      wizardState: SACA2_STATE,
    })

    const params = query.mock.calls[2]?.[1] as unknown[]
    expect(params).toHaveLength(7)
    expect(params[0]).toBe(APPLICATION_ID)
    expect(params[1]).toBe(APPLICANT_ID)
    expect(params[2]).toBe("draft")
    expect(params[3]).toBe("saca2")
    expect(JSON.parse(String(params[4]))).toMatchObject({ schemaVersion: 2 })
    expect(params[5]).toBe(2)
    expect(params[6]).toBeNull()
  })
})
