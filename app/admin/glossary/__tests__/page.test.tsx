/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AdminGlossaryPage from "@/app/admin/glossary/page"

const { mockAuthenticatedFetch } = vi.hoisted(() => ({
  mockAuthenticatedFetch: vi.fn(),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}))

describe("AdminGlossaryPage", () => {
  beforeEach(() => {
    mockAuthenticatedFetch.mockReset()
    mockAuthenticatedFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method) return { ok: true, json: async () => ({ term: {} }) }
      return {
        json: async () => ({
          terms: [
            {
              id: "term-1",
              slug: "premium",
              term_en: "Premium",
              definition_en: "Monthly insurance cost",
              definition_es: "Costo mensual",
              definition_zh_cn: null,
              definition_ht: null,
              definition_pt_br: null,
              definition_vi: null,
              category: "insurance",
              aliases: ["monthly cost"],
              related_slugs: ["deductible"],
            },
          ],
        }),
      }
    })
  })

  it("loads and filters glossary terms", async () => {
    render(<AdminGlossaryPage />)

    expect(await screen.findByText("Premium")).toBeInTheDocument()
    expect(screen.getByText("premium")).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/search by term or slug/i), { target: { value: "missing" } })
    expect(screen.getByText("No terms found")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /clear/i }))
    expect(screen.getByText("Premium")).toBeInTheDocument()
  })

  it("creates a new glossary term", async () => {
    render(<AdminGlossaryPage />)

    fireEvent.click(await screen.findByRole("button", { name: /add term/i }))
    fireEvent.change(screen.getByPlaceholderText("e.g. copay"), { target: { value: "copay" } })
    fireEvent.change(screen.getByPlaceholderText("e.g. Copay"), { target: { value: "Copay" } })
    fireEvent.change(screen.getByPlaceholderText("English definition..."), {
      target: { value: "Fixed cost for a covered service" },
    })
    fireEvent.click(screen.getAllByRole("button", { name: /^add term$/i }).at(-1)!)

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/glossary",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"slug":"copay"'),
        }),
      )
    })
  })

  it("edits an existing glossary term", async () => {
    render(<AdminGlossaryPage />)

    fireEvent.click(await screen.findByTitle("Edit"))
    fireEvent.change(screen.getByPlaceholderText("English definition..."), {
      target: { value: "Updated premium definition" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/glossary/premium",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("Updated premium definition"),
        }),
      )
    })
  })

  it("deletes an existing glossary term", async () => {
    render(<AdminGlossaryPage />)

    fireEvent.click(await screen.findByTitle("Delete"))
    fireEvent.click(screen.getAllByRole("button", { name: /^delete$/i }).at(-1)!)

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/glossary/premium",
        expect.objectContaining({ method: "DELETE" }),
      )
    })
  })
})
