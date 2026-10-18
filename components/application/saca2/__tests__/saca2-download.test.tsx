/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }))
vi.mock("@/lib/supabase/authenticated-fetch", () => ({ authenticatedFetch: mocks.authenticatedFetch }))

import { Saca2Download } from "@/components/application/saca2/saca2-download"

const APP_ID = "88cbe518-ea42-476b-a8e9-12207573ff2c"
const STATE = { schemaVersion: "saca2-2026-08", data: { persons: [{ firstName: "Ada" }] } }
const NOTE = "Print, sign, and date the form yourself — signatures and consents are never filled in for you."

function pdfResponse() {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob(["%PDF-1.7"], { type: "application/pdf" }),
  } as unknown as Response
}

function errorResponse(status: number, error = "x") {
  return { ok: false, status, json: async () => ({ ok: false, error }) } as unknown as Response
}

const createObjectURL = vi.fn(() => "blob:fake-url")
const revokeObjectURL = vi.fn()
let clickSpy: ReturnType<typeof vi.spyOn>
let clickedAnchors: HTMLAnchorElement[]

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: createObjectURL })
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: revokeObjectURL })
  clickedAnchors = []
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clickedAnchors.push(this)
  })
})

afterEach(() => clickSpy.mockRestore())

function lastRequest() {
  const [url, init] = mocks.authenticatedFetch.mock.calls.at(-1) as [string, { method: string; headers: Record<string, string>; body: string }]
  return { url, init, body: JSON.parse(init.body) }
}

describe("Saca2Download", () => {
  it("shows the signature note before and after downloading", async () => {
    mocks.authenticatedFetch.mockResolvedValue(pdfResponse())
    render(<Saca2Download applicationId={APP_ID} wizardState={STATE} />)
    expect(screen.getByRole("note")).toHaveTextContent(NOTE)
    await userEvent.click(screen.getByRole("button", { name: "Download your filled SACA-2 (PDF)" }))
    await waitFor(() => expect(clickedAnchors).toHaveLength(1))
    expect(screen.getByRole("note")).toHaveTextContent(NOTE)
  })

  it("posts the answers and downloads the returned PDF, then revokes the object URL", async () => {
    mocks.authenticatedFetch.mockResolvedValue(pdfResponse())
    render(<Saca2Download applicationId={APP_ID} wizardState={STATE} />)
    await userEvent.click(screen.getByRole("button", { name: "Download your filled SACA-2 (PDF)" }))

    await waitFor(() => expect(clickedAnchors).toHaveLength(1))
    const { url, init, body } = lastRequest()
    expect(url).toBe("/api/forms/saca2/fill")
    expect(init.method).toBe("POST")
    expect(body).toEqual({ applicationId: APP_ID, wizardState: STATE })
    expect(url).not.toContain("Ada")
    expect(clickedAnchors[0].href).toBe("blob:fake-url")
    expect(clickedAnchors[0].download).toBe("SACA-2-application.pdf")
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url"))
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it("sends the acting-for header only when given", async () => {
    mocks.authenticatedFetch.mockResolvedValue(pdfResponse())
    const { unmount } = render(<Saca2Download applicationId={APP_ID} wizardState={STATE} actingForPatientId="p-1" />)
    await userEvent.click(screen.getByRole("button", { name: /Download your filled/ }))
    await waitFor(() => expect(clickedAnchors).toHaveLength(1))
    expect(lastRequest().init.headers["X-Acting-For-Patient"]).toBe("p-1")
    unmount()

    mocks.authenticatedFetch.mockClear()
    render(<Saca2Download applicationId={APP_ID} wizardState={STATE} />)
    await userEvent.click(screen.getByRole("button", { name: /Download your filled/ }))
    await waitFor(() => expect(mocks.authenticatedFetch).toHaveBeenCalled())
    expect(lastRequest().init.headers["X-Acting-For-Patient"]).toBeUndefined()
  })

  it("is disabled and says it is preparing while the request is pending", async () => {
    let resolve!: (r: Response) => void
    mocks.authenticatedFetch.mockReturnValue(new Promise<Response>((r) => (resolve = r)))
    render(<Saca2Download applicationId={APP_ID} wizardState={STATE} />)
    await userEvent.click(screen.getByRole("button", { name: /Download your filled/ }))
    const busy = await screen.findByRole("button", { name: "Preparing your PDF…" })
    expect(busy).toBeDisabled()
    await userEvent.click(busy)
    expect(mocks.authenticatedFetch).toHaveBeenCalledTimes(1)

    resolve(pdfResponse())
    expect(await screen.findByRole("button", { name: "Download your filled SACA-2 (PDF)" })).toBeEnabled()
  })

  it("explains the rate limit on 429", async () => {
    mocks.authenticatedFetch.mockResolvedValue(errorResponse(429, "Too many requests"))
    render(<Saca2Download applicationId={APP_ID} wizardState={STATE} />)
    await userEvent.click(screen.getByRole("button", { name: /Download your filled/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many downloads, try again in a few minutes.")
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it("shows the long-list advice on 422 without echoing answer content", async () => {
    mocks.authenticatedFetch.mockResolvedValue(errorResponse(422, "Some answers could not be placed on the form."))
    render(<Saca2Download applicationId={APP_ID} wizardState={STATE} />)
    await userEvent.click(screen.getByRole("button", { name: /Download your filled/ }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Some answers could not be placed on the form.")
    expect(alert).toHaveTextContent(/IRS years, Supplement B people, or Supplement D jobs/)
    expect(alert).toHaveTextContent(/contact support/i)
    expect(alert).not.toHaveTextContent("Ada")
  })

  it.each([500, 413, 404, 401])("shows a retryable alert on %i", async (status) => {
    mocks.authenticatedFetch.mockResolvedValueOnce(errorResponse(status, "server detail"))
    render(<Saca2Download applicationId={APP_ID} wizardState={STATE} />)
    await userEvent.click(screen.getByRole("button", { name: /Download your filled/ }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("We couldn’t prepare your PDF. Please try again.")
    expect(alert).not.toHaveTextContent("server detail")

    mocks.authenticatedFetch.mockResolvedValueOnce(pdfResponse())
    await userEvent.click(screen.getByRole("button", { name: /Download your filled/ }))
    await waitFor(() => expect(clickedAnchors).toHaveLength(1))
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("shows the retryable alert when the network fails", async () => {
    mocks.authenticatedFetch.mockRejectedValue(new Error("offline"))
    render(<Saca2Download applicationId={APP_ID} wizardState={STATE} />)
    await userEvent.click(screen.getByRole("button", { name: /Download your filled/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t prepare your PDF. Please try again.")
    expect(screen.getByRole("button", { name: /Download your filled/ })).toBeEnabled()
  })
})
