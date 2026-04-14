/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { ThemeProvider } from "@/components/theme-provider"

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe("ThemeProvider", () => {
  it("renders children", () => {
    render(
      <ThemeProvider>
        <span>Themed content</span>
      </ThemeProvider>,
    )
    expect(screen.getByText("Themed content")).toBeInTheDocument()
  })

  it("passes props through to the underlying NextThemesProvider", () => {
    // Verify rendering doesn't throw with extra props
    expect(() =>
      render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>Content</div>
        </ThemeProvider>,
      ),
    ).not.toThrow()
  })
})
