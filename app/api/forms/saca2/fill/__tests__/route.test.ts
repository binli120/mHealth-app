/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { completeSingleSenior } from "@/lib/masshealth/saca2/__tests__/complete-answers"
import { coupleBoth } from "@/lib/masshealth/saca2/pdf/__tests__/supp-bcd-helpers"
import { Saca2FitError } from "@/lib/masshealth/saca2/pdf/fit-error"
import { SACA2_SCHEMA_VERSION } from "@/lib/masshealth/saca2/types"

const requireAuthenticatedUser = vi.fn()
const getApplicationDraft = vi.fn()
const checkRateLimitAsync = vi.fn()
const logServerError = vi.fn()
const isSaca2Enabled = vi.fn()
const loadSaca2Template = vi.fn()
const fillSaca2Pdf = vi.fn()
const writeFile = vi.fn()
const dbQuery = vi.fn()

vi.mock("@/lib/auth/require-auth", () => ({ requireAuthenticatedUser: (...a: unknown[]) => requireAuthenticatedUser(...a) }))
vi.mock("@/lib/db/application-drafts", () => ({ getApplicationDraft: (...a: unknown[]) => getApplicationDraft(...a) }))
vi.mock("@/lib/server/logger", () => ({ logServerError: (...a: unknown[]) => logServerError(...a) }))
vi.mock("@/lib/server/rate-limit", () => ({
  saca2FillLimiter: { name: "saca2FillLimiter" },
  checkRateLimitAsync: (...a: unknown[]) => checkRateLimitAsync(...a),
}))
vi.mock("@/lib/masshealth/saca2/flag", () => ({ isSaca2Enabled: () => isSaca2Enabled() }))
vi.mock("@/lib/masshealth/saca2/pdf/template", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/masshealth/saca2/pdf/template")>()
  return { ...actual, loadSaca2Template: (...a: unknown[]) => loadSaca2Template(...a) }
})
vi.mock("@/lib/masshealth/saca2/pdf/pdf-fill", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/masshealth/saca2/pdf/pdf-fill")>()
  return { ...actual, fillSaca2Pdf: (...a: unknown[]) => fillSaca2Pdf(...a) }
})
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return { ...actual, writeFile: (...a: unknown[]) => writeFile(...a) }
})
vi.mock("@/lib/db/server", () => ({ getDbPool: () => ({ query: (...a: unknown[]) => dbQuery(...a) }) }))

import { POST } from "../route"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const APP_ID = "22222222-2222-4222-8222-222222222222"
const SENTINEL = "Zyxwvuts-Sentinel-Name"

function validState(): Record<string, unknown> {
  const data = completeSingleSenior()
  data.persons[0].firstName = SENTINEL
  return { schemaVersion: SACA2_SCHEMA_VERSION, data }
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  const text = typeof body === "string" ? body : JSON.stringify(body)
  return new Request("http://localhost/api/forms/saca2/fill", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: text })
}

const goodBody = () => ({ applicationId: APP_ID, wizardState: validState() })

beforeEach(async () => {
  for (const m of [requireAuthenticatedUser, getApplicationDraft, checkRateLimitAsync, logServerError, isSaca2Enabled, loadSaca2Template, fillSaca2Pdf, writeFile, dbQuery]) m.mockReset()
  requireAuthenticatedUser.mockResolvedValue({ ok: true, userId: USER_ID })
  isSaca2Enabled.mockReturnValue(true)
  checkRateLimitAsync.mockResolvedValue(null)
  getApplicationDraft.mockResolvedValue({ id: APP_ID, applicationType: "saca2" })
  const actualTemplate = await vi.importActual<typeof import("@/lib/masshealth/saca2/pdf/template")>("@/lib/masshealth/saca2/pdf/template")
  const actualFill = await vi.importActual<typeof import("@/lib/masshealth/saca2/pdf/pdf-fill")>("@/lib/masshealth/saca2/pdf/pdf-fill")
  loadSaca2Template.mockImplementation(() => actualTemplate.loadSaca2Template())
  fillSaca2Pdf.mockImplementation((...a: Parameters<typeof actualFill.fillSaca2Pdf>) => actualFill.fillSaca2Pdf(...a))
})

describe("POST /api/forms/saca2/fill", () => {
  it("exports the node runtime and force-dynamic", async () => {
    const route = await import("../route")
    expect(route.runtime).toBe("nodejs")
    expect(route.dynamic).toBe("force-dynamic")
  })

  it("returns the auth response when unauthenticated", async () => {
    requireAuthenticatedUser.mockResolvedValue({ ok: false, response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) })
    const res = await POST(post(goodBody()))
    expect(res.status).toBe(401)
    expect(getApplicationDraft).not.toHaveBeenCalled()
  })

  it("is a 404 when the flag is off", async () => {
    isSaca2Enabled.mockReturnValue(false)
    const res = await POST(post(goodBody()))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ ok: false, error: "Not found." })
    expect(getApplicationDraft).not.toHaveBeenCalled()
  })

  it("is a 429 when rate limited, keyed per user", async () => {
    checkRateLimitAsync.mockResolvedValue(NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 }))
    const res = await POST(post(goodBody()))
    expect(res.status).toBe(429)
    expect(checkRateLimitAsync).toHaveBeenCalledWith({ name: "saca2FillLimiter" }, `saca2-fill:${USER_ID}`)
    expect(getApplicationDraft).not.toHaveBeenCalled()
  })

  it("is a 404 when the draft is missing or not owned, and does not fill", async () => {
    getApplicationDraft.mockResolvedValue(null)
    const res = await POST(post(goodBody()))
    expect(res.status).toBe(404)
    expect(fillSaca2Pdf).not.toHaveBeenCalled()
  })

  it("is a 409 for a non-SACA-2 application", async () => {
    getApplicationDraft.mockResolvedValue({ id: APP_ID, applicationType: "aca3" })
    const res = await POST(post(goodBody()))
    expect(res.status).toBe(409)
    expect(fillSaca2Pdf).not.toHaveBeenCalled()
  })

  it("forwards the acting-for header and the ids to getApplicationDraft", async () => {
    await POST(post(goodBody(), { "X-Acting-For-Patient": "33333333-3333-4333-8333-333333333333" }))
    expect(getApplicationDraft).toHaveBeenCalledWith(USER_ID, APP_ID, "33333333-3333-4333-8333-333333333333")
    getApplicationDraft.mockClear()
    await POST(post(goodBody()))
    expect(getApplicationDraft).toHaveBeenCalledWith(USER_ID, APP_ID, undefined)
  })

  it("is a 413 when Content-Length is over 200 KB, before reading the body", async () => {
    const res = await POST(post(goodBody(), { "content-length": String(250 * 1024) }))
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ ok: false, error: "Request body too large." })
    expect(getApplicationDraft).not.toHaveBeenCalled()
  })

  it("is a 413 for a 250 KB body with no Content-Length header", async () => {
    const body = { ...goodBody(), padding: "x".repeat(250 * 1024) }
    const res = await POST(post(body))
    expect(res.status).toBe(413)
    expect(getApplicationDraft).not.toHaveBeenCalled()
    expect(fillSaca2Pdf).not.toHaveBeenCalled()
  })

  it("is a 413 when Content-Length lies low, and counts bytes not characters", async () => {
    const wide = { ...goodBody(), padding: "é".repeat(110 * 1024) } // ~110K chars, ~220 KB bytes
    const res = await POST(post(wide, { "content-length": "100" }))
    expect(res.status).toBe(413)
  })

  it("is a 400 for a body that is not JSON", async () => {
    const res = await POST(post("{nope"))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ ok: false })
  })

  it.each([
    ["a string", "text"],
    ["an array", []],
    ["a missing value", undefined],
  ])("is a 422 when wizardState is %s", async (_label, wizardState) => {
    const res = await POST(post({ applicationId: APP_ID, wizardState }))
    expect(res.status).toBe(422)
    expect(getApplicationDraft).not.toHaveBeenCalled()
  })

  it("is a 422 for an application id that is not a uuid", async () => {
    const res = await POST(post({ applicationId: "nope", wizardState: validState() }))
    expect(res.status).toBe(422)
  })

  it("is a 422 for the wrong schemaVersion", async () => {
    const res = await POST(post({ applicationId: APP_ID, wizardState: { ...validState(), schemaVersion: 999 } }))
    expect(res.status).toBe(422)
    expect(fillSaca2Pdf).not.toHaveBeenCalled()
  })

  it("is a 422 when wizardState has no data object", async () => {
    const res = await POST(post({ applicationId: APP_ID, wizardState: { schemaVersion: SACA2_SCHEMA_VERSION } }))
    expect(res.status).toBe(422)
  })

  it("returns a filled PDF for the real template", async () => {
    const res = await POST(post(goodBody()))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="SACA-2-application.pdf"')
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-")
    expect(logServerError).not.toHaveBeenCalled()
  }, 60_000)

  it("maps a template mismatch to the exact 500 message, with no answers in the response or the log", async () => {
    const { Saca2TemplateIntegrityError } = await import("@/lib/masshealth/saca2/pdf/template")
    loadSaca2Template.mockRejectedValue(new Saca2TemplateIntegrityError("a".repeat(64), "b".repeat(64)))
    const res = await POST(post(goodBody()))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ ok: false, error: "The application template could not be verified." })
    expect(logServerError).toHaveBeenCalledTimes(1)
    const [, error, context] = logServerError.mock.calls[0]
    expect(error).toBeInstanceOf(Saca2TemplateIntegrityError)
    expect(context).toEqual({ module: "saca2-fill", userId: USER_ID, applicationId: APP_ID })
    expect(JSON.stringify(logServerError.mock.calls)).not.toContain(SENTINEL)
  })

  it("maps a fit error to a 422 with a fixed message and logs only ids", async () => {
    fillSaca2Pdf.mockRejectedValue(new Saca2FitError("Supplement B has more people than the 6 the form pages and their copies hold"))
    const res = await POST(post(goodBody()))
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ ok: false, error: "Some answers could not be placed on the form." })
    expect(logServerError.mock.calls[0][2]).toEqual({ module: "saca2-fill", userId: USER_ID, applicationId: APP_ID })
    expect(JSON.stringify(logServerError.mock.calls)).not.toContain(SENTINEL)
  })

  it("returns a generic 500 for any other failure without leaking its message", async () => {
    fillSaca2Pdf.mockRejectedValue(new Error(`boom ${SENTINEL}`))
    const res = await POST(post(goodBody()))
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).not.toContain(SENTINEL)
    expect(JSON.parse(text)).toEqual({ ok: false, error: "Unable to generate the SACA-2 PDF." })
    expect(logServerError.mock.calls[0][2]).toEqual({ module: "saca2-fill", userId: USER_ID, applicationId: APP_ID })
  })

  it("never writes: no file or database write is made", async () => {
    await POST(post(goodBody()))
    expect(writeFile).not.toHaveBeenCalled()
    expect(dbQuery).not.toHaveBeenCalled()
  }, 60_000)

  it("nine IRS 4506 years from the client reach the 422 path through the real fill", async () => {
    const data = coupleBoth()
    data.signature.signedBy = "authorizedRepresentative"
    data.attachments.ard = { ...data.attachments.ard, section: "applicantDesignates", repKind: "person", repName: SENTINEL, repPhone: "6175550101", repStreet: "3 Example St", repCity: "Testville", repState: "MA", repZip: "02101" }
    data.supplements.a.taxReturnsFiled = "bothYears"
    data.supplements.a.hasCopiesOfTaxReturns = "no"
    data.persons[0].hasSsn = "yes"
    data.persons[0].ssn = "123-45-6789"
    data.attachments.irs4506.jointReturn = "yes"
    data.attachments.irs4506.yearsRequested = Array.from({ length: 9 }, (_, i) => ({ periodEnd: `20${10 + i}-12-31` }))
    const res = await POST(post({ applicationId: APP_ID, wizardState: { schemaVersion: SACA2_SCHEMA_VERSION, data } }))
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ ok: false, error: "Some answers could not be placed on the form." })
    expect(JSON.stringify(logServerError.mock.calls)).not.toContain(SENTINEL)
  }, 60_000)

  it("sends no substitution header when every character can be printed", async () => {
    const res = await POST(post(goodBody()))
    expect(res.status).toBe(200)
    expect(res.headers.get("X-Saca2-Substituted-Chars")).toBeNull()
  })

  it("adds X-Saca2-Substituted-Chars with a count only when characters were replaced", async () => {
    const body = goodBody() as { wizardState: { data: { persons: Array<{ firstName: string }> } } }
    body.wizardState.data.persons[0].firstName = "Hương"
    const res = await POST(post(body))
    expect(res.status).toBe(200)
    expect(Number(res.headers.get("X-Saca2-Substituted-Chars"))).toBeGreaterThanOrEqual(2)
    expect(res.headers.get("Cache-Control")).toBe("no-store")
    expect(res.headers.get("Content-Type")).toBe("application/pdf")
    expect(JSON.stringify(logServerError.mock.calls)).not.toContain("Hương")
  })
})
