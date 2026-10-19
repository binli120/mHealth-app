/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ApplicationChecksPanel } from "@/components/application/ApplicationChecksPanel"

describe("ApplicationChecksPanel", () => {
  it("renders a result's action as a link and omits it when absent", () => {
    render(
      <ApplicationChecksPanel
        results={[
          { id: "age.0.senior", severity: "warning", category: "age_thresholds", title: "Senior applicant", message: "m", actionHref: "/application/type?recommended=saca2", actionLabel: "Start a SACA-2 application" },
          { id: "age.1.minor", severity: "info", category: "age_thresholds", title: "Minor applicant", message: "n" },
        ]}
      />,
    )
    expect(screen.getByRole("link", { name: "Start a SACA-2 application" })).toHaveAttribute("href", "/application/type?recommended=saca2")
    expect(screen.getAllByRole("link")).toHaveLength(1)
  })
})
