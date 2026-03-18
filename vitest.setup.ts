import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// jsdom does not implement window.scrollTo — stub it so components that call
// scrollTo (e.g. form-wizard step transitions) don't throw in tests.
Object.defineProperty(window, "scrollTo", {
  value: vi.fn(),
  writable: true,
})

afterEach(() => {
  cleanup()
})
