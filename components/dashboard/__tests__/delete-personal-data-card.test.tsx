import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const dispatch = vi.fn()
vi.mock("@/lib/redux/hooks", () => ({ useAppDispatch: () => dispatch }))
vi.mock("@/lib/supabase/authenticated-fetch", () => ({ authenticatedFetch: vi.fn() }))

import { DeletePersonalDataCard } from "@/components/dashboard/delete-personal-data-card"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  vi.mocked(authenticatedFetch).mockResolvedValue(
    new Response(JSON.stringify({ hasPersonalData: true }), { status: 200 }),
  )
})

describe("DeletePersonalDataCard", () => {
  it("shows a neutral loading state until presence is known", async () => {
    let resolvePresence!: (response: Response) => void
    vi.mocked(authenticatedFetch).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolvePresence = resolve
      }),
    )
    render(<DeletePersonalDataCard />)

    expect(screen.getByText("Checking for personal data…")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Delete all personal data" })).not.toBeInTheDocument()

    resolvePresence(new Response(JSON.stringify({ hasPersonalData: true }), { status: 200 }))
    expect(await screen.findByRole("button", { name: "Delete all personal data" })).toBeInTheDocument()
  })

  it("shows the delete action when personal data exists", async () => {
    render(<DeletePersonalDataCard />)

    expect(await screen.findByRole("button", { name: "Delete all personal data" })).toBeInTheDocument()
  })

  it("shows an empty state without a delete button when no personal data exists", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify({ hasPersonalData: false }), { status: 200 }),
    )
    render(<DeletePersonalDataCard />)

    expect(await screen.findByText("No personal data has been entered.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Delete all personal data" })).not.toBeInTheDocument()
  })

  it("shows a retry action instead of claiming the account is empty when the check fails", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ hasPersonalData: false }), { status: 200 }),
      )
    render(<DeletePersonalDataCard />)

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))

    expect(await screen.findByText("No personal data has been entered.")).toBeInTheDocument()
    expect(authenticatedFetch).toHaveBeenCalledTimes(2)
  })

  it("requires the exact confirmation phrase", async () => {
    render(<DeletePersonalDataCard />)
    fireEvent.click(await screen.findByRole("button", { name: "Delete all personal data" }))

    const confirmButton = screen.getByRole("button", { name: "Permanently delete data" })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/type delete all data to confirm/i), {
      target: { value: "delete all data" },
    })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/type delete all data to confirm/i), {
      target: { value: "DELETE ALL DATA" },
    })
    expect(confirmButton).toBeEnabled()
  })

  it("sends only the confirmation phrase and shows safe retry feedback", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ hasPersonalData: true }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error: "internal path" }), { status: 500 }),
      )
    render(<DeletePersonalDataCard />)
    fireEvent.click(await screen.findByRole("button", { name: "Delete all personal data" }))
    fireEvent.change(screen.getByLabelText(/type delete all data to confirm/i), {
      target: { value: "DELETE ALL DATA" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Permanently delete data" }))

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/account/personal-data",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE ALL DATA" }),
      }),
    ))
    expect(await screen.findByText(/nothing is marked complete/i)).toBeInTheDocument()
    expect(screen.queryByText("internal path")).not.toBeInTheDocument()
  })

  it("clears customer browser and Redux state before completing", async () => {
    const onDeleted = vi.fn()
    window.localStorage.setItem("mhealth:aca-03-0325:wizard:v1:app", "private")
    window.localStorage.setItem("unrelated", "keep")
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ hasPersonalData: true }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

    render(<DeletePersonalDataCard onDeleted={onDeleted} />)
    fireEvent.click(await screen.findByRole("button", { name: "Delete all personal data" }))
    fireEvent.change(screen.getByLabelText(/type delete all data to confirm/i), {
      target: { value: "DELETE ALL DATA" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Permanently delete data" }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce())
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(window.localStorage.getItem("mhealth:aca-03-0325:wizard:v1:app")).toBeNull()
    expect(window.localStorage.getItem("unrelated")).toBe("keep")
    expect(screen.getByText("No personal data has been entered.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Permanently delete data" })).not.toBeInTheDocument()
  })
})
