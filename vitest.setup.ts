/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// Node.js 22 exposes a global `localStorage` that requires --localstorage-file
// and conflicts with jsdom's implementation. Replace it with a proper
// in-memory stub so components calling localStorage work in all tests.
const createLocalStorageMock = () => {
  const store: Record<string, string> = {}
  return {
    getItem:    (key: string) => store[key] ?? null,
    setItem:    (key: string, value: string) => { store[key] = String(value) },
    removeItem: (key: string) => { delete store[key] },
    clear:      () => { Object.keys(store).forEach((k) => delete store[k]) },
    get length() { return Object.keys(store).length },
    key:        (i: number) => Object.keys(store)[i] ?? null,
  }
}

Object.defineProperty(window, 'localStorage',  { value: createLocalStorageMock(), writable: true })
Object.defineProperty(window, 'sessionStorage', { value: createLocalStorageMock(), writable: true })

// jsdom does not implement window.scrollTo — stub it so components that call
// scrollTo (e.g. form-wizard step transitions) don't throw in tests.
Object.defineProperty(window, "scrollTo", {
  value: vi.fn(),
  writable: true,
})

afterEach(() => {
  cleanup()
  // Clear Web Storage between tests so component-written localStorage/sessionStorage
  // values don't leak into subsequent tests and corrupt their initial state.
  window.localStorage.clear()
  window.sessionStorage.clear()
})
