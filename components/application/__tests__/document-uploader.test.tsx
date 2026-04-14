/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { DocumentUploader } from "@/components/application/document-uploader"

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}))

function renderUploader(overrides: Partial<Parameters<typeof DocumentUploader>[0]> = {}) {
  return render(
    <DocumentUploader
      title="Upload your ID"
      description="A clear photo of your government-issued ID."
      {...overrides}
    />,
  )
}

describe("DocumentUploader", () => {
  it("renders the title", () => {
    renderUploader()
    expect(screen.getByText("Upload your ID")).toBeInTheDocument()
  })

  it("renders the description", () => {
    renderUploader()
    expect(screen.getByText("A clear photo of your government-issued ID.")).toBeInTheDocument()
  })

  it("renders the Browse Files button", () => {
    renderUploader()
    expect(screen.getByRole("button", { name: /browse files/i })).toBeInTheDocument()
  })

  it("renders the Use Camera button", () => {
    renderUploader()
    expect(screen.getByRole("button", { name: /use camera/i })).toBeInTheDocument()
  })

  it("renders the accepted file type hint", () => {
    renderUploader()
    expect(screen.getByText(/PDF, JPG, PNG/i)).toBeInTheDocument()
  })

  it("renders a hidden file input", () => {
    renderUploader()
    const input = document.querySelector('input[type="file"]')
    expect(input).toBeTruthy()
    expect(input).toHaveClass("hidden")
  })

  it("uses the accept prop on the file input", () => {
    renderUploader({ accept: "image/jpeg,image/png" })
    const input = document.querySelector('input[type="file"]')
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png")
  })
})
