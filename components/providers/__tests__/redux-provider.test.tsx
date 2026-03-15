import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import { ReduxProvider } from "@/components/providers/redux-provider"

describe("ReduxProvider", () => {
  it("renders children", () => {
    render(
      <ReduxProvider>
        <span>Hello from store</span>
      </ReduxProvider>,
    )
    expect(screen.getByText("Hello from store")).toBeInTheDocument()
  })

  it("renders multiple children", () => {
    render(
      <ReduxProvider>
        <span>Child A</span>
        <span>Child B</span>
      </ReduxProvider>,
    )
    expect(screen.getByText("Child A")).toBeInTheDocument()
    expect(screen.getByText("Child B")).toBeInTheDocument()
  })
})
