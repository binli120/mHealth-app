/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { UploadToApplicationDialog } from "@/components/dashboard/UploadToApplicationDialog"
import { VISION_UPLOAD_ACCEPT } from "@/lib/uploads/accepted-types"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn(),
}))

describe("UploadToApplicationDialog", () => {
  it("advertises only file types accepted by the parse-application vision validator", () => {
    render(
      <UploadToApplicationDialog>
        <button type="button">Open upload dialog</button>
      </UploadToApplicationDialog>,
    )

    fireEvent.click(screen.getByRole("button", { name: /open upload dialog/i }))

    const input = document.querySelector('input[type="file"]')
    expect(input).toHaveAttribute("accept", VISION_UPLOAD_ACCEPT)
    expect(screen.getByText(/PDF, JPEG, PNG, or WebP - max 10 MB/i)).toBeInTheDocument()
    expect(screen.queryByText(/HEIC|TIFF/i)).not.toBeInTheDocument()
  })
})
