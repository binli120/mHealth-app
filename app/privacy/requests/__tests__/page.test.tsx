/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import PrivacyRequestsPage from "@/app/privacy/requests/page"

describe("PrivacyRequestsPage", () => {
  it("renders a usable privacy request intake form instead of coming-soon copy", () => {
    render(<PrivacyRequestsPage />)

    expect(screen.getByRole("heading", { name: /data subject requests/i })).toBeVisible()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/full name/i)).toBeRequired()
    expect(screen.getByLabelText(/^email$/i)).toBeRequired()
    expect(screen.getByLabelText(/request type/i)).toBeRequired()
    expect(screen.getByLabelText(/request details/i)).toBeRequired()
    expect(screen.getByLabelText(/preferred contact method/i)).toBeVisible()
    expect(screen.getByRole("button", { name: /submit privacy request/i })).toBeVisible()
    expect(screen.getByRole("link", { name: /privacy@healthcompass\.cloud/i })).toHaveAttribute(
      "href",
      "mailto:privacy@healthcompass.cloud",
    )
  })
})
