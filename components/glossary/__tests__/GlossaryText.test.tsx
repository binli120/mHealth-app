import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { GlossaryText } from "../GlossaryText"

vi.mock("@/lib/glossary/GlossaryContext", () => ({
  useGlossaryIndex: vi.fn(),
}))

vi.mock("../GlossaryTerm", () => ({
  GlossaryTerm: ({ content }: { content: string }) => (
    <strong data-testid="glossary-term">{content}</strong>
  ),
}))

import { useGlossaryIndex } from "@/lib/glossary/GlossaryContext"

const mockUseGlossaryIndex = vi.mocked(useGlossaryIndex)

describe("GlossaryText", () => {
  it("renders plain text when no terms match", () => {
    mockUseGlossaryIndex.mockReturnValue({
      index: [],
      loading: false,
    })

    render(<GlossaryText text="Hello world" />)
    expect(screen.getByText("Hello world")).toBeInTheDocument()
    expect(screen.queryByTestId("glossary-term")).not.toBeInTheDocument()
  })

  it("renders GlossaryTerm when a term is found", () => {
    mockUseGlossaryIndex.mockReturnValue({
      index: [{ slug: "deductible", term_en: "deductible", aliases: [] }],
      loading: false,
    })

    render(<GlossaryText text="Your deductible applies here." />)
    expect(screen.getByTestId("glossary-term")).toBeInTheDocument()
    expect(screen.getByTestId("glossary-term")).toHaveTextContent("deductible")
  })

  it("renders plain text while loading", () => {
    mockUseGlossaryIndex.mockReturnValue({
      index: [{ slug: "deductible", term_en: "deductible", aliases: [] }],
      loading: true,
    })

    render(<GlossaryText text="Your deductible applies here." />)
    expect(screen.queryByTestId("glossary-term")).not.toBeInTheDocument()
    expect(screen.getByText("Your deductible applies here.")).toBeInTheDocument()
  })
})
