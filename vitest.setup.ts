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

// pdfjs-dist (loaded transitively by pdf-parse) references DOMMatrix for
// transform calculations. jsdom doesn't implement it — stub the minimum
// surface needed so the module evaluates without crashing in tests.
if (typeof globalThis.DOMMatrix === "undefined") {
  class DOMMatrixStub {
    a=1; b=0; c=0; d=1; e=0; f=0
    is2D=true; isIdentity=true
    constructor(_init?: string | number[]) {}
    multiply(_other?: unknown): DOMMatrixStub { return new DOMMatrixStub() }
    translate(_tx?: number, _ty?: number, _tz?: number): DOMMatrixStub { return new DOMMatrixStub() }
    scale(_s?: number): DOMMatrixStub { return new DOMMatrixStub() }
    inverse(): DOMMatrixStub { return new DOMMatrixStub() }
    transformPoint(_p?: unknown) { return { x: 0, y: 0, z: 0, w: 1 } }
    toJSON() { return {} }
    static fromMatrix(_other?: unknown): DOMMatrixStub { return new DOMMatrixStub() }
  }
  // @ts-expect-error — intentional minimal stub for test environment only
  globalThis.DOMMatrix = DOMMatrixStub
}

afterEach(() => {
  cleanup()
  // Clear Web Storage between tests so component-written localStorage/sessionStorage
  // values don't leak into subsequent tests and corrupt their initial state.
  window.localStorage.clear()
  window.sessionStorage.clear()
})
