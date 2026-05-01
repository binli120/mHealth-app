/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import KnowledgeCenterPage from "@/app/knowledge-center/page"

const { mockGetSafeSupabaseSession } = vi.hoisted(() => ({
  mockGetSafeSupabaseSession: vi.fn(),
}))

vi.mock("@/lib/redux/hooks", () => ({
  useAppSelector: () => "en",
}))

vi.mock("@/lib/supabase/client", () => ({
  getSafeSupabaseSession: mockGetSafeSupabaseSession,
}))

vi.mock("@/components/shared/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}))

vi.mock("next/image", () => ({
  default: ({ alt = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

describe("KnowledgeCenterPage", () => {
  beforeEach(() => {
    mockGetSafeSupabaseSession.mockReset()
  })

  it("keeps the Back link public for unauthenticated homepage visitors", async () => {
    mockGetSafeSupabaseSession.mockResolvedValue({ session: null, error: null })

    render(<KnowledgeCenterPage />)

    const backLink = screen.getByRole("link", { name: /back/i })
    expect(backLink).toHaveAttribute("href", "/")

    await waitFor(() => {
      expect(backLink).toHaveAttribute("href", "/")
    })
  })

  it("points Back to the member dashboard only after a session is confirmed", async () => {
    mockGetSafeSupabaseSession.mockResolvedValue({ session: { user: { id: "user-1" } }, error: null })

    render(<KnowledgeCenterPage />)

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute("href", "/customer/dashboard")
    })
  })
})
