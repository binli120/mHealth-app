/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import AdminLoading from "@/app/admin/loading"

describe("AdminLoading", () => {
  it("renders the route loading indicator", () => {
    const { container } = render(<AdminLoading />)

    expect(container.firstChild).toHaveClass("min-h-screen")
    expect(container.querySelector(".animate-spin")).toBeInTheDocument()
  })
})
