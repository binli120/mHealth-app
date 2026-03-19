/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"

import { appReducer } from "@/lib/redux/features/app-slice"
import { applicationReducer } from "@/lib/redux/features/application-slice"

// Heavy deps mocked at module level
vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn(),
}))
vi.mock("@/lib/supabase/client", () => ({
  getSafeSupabaseSession: vi.fn().mockResolvedValue({ session: null }),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { IntakeChat } from "@/components/application/aca3/intake-chat"

function makeStore() {
  return configureStore({
    reducer: { app: appReducer, application: applicationReducer },
  })
}

function renderChat(props: Parameters<typeof IntakeChat>[0] = {}) {
  return render(
    <Provider store={makeStore()}>
      <IntakeChat {...props} />
    </Provider>,
  )
}

describe("IntakeChat", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
  })

  it("renders without crashing", () => {
    const { container } = renderChat()
    expect(container.firstChild).toBeTruthy()
  })

  it("renders the chat panel with a Send button by default", () => {
    renderChat()
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument()
  })

  it("renders the language selector", () => {
    renderChat()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("renders the Reset button", () => {
    renderChat()
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument()
  })

  it("renders the Switch to Form Wizard button", () => {
    renderChat()
    expect(screen.getByRole("button", { name: /switch to form wizard/i })).toBeInTheDocument()
  })
})
