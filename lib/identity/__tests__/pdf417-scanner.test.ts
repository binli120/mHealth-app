import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { startPdf417Scan } from "../pdf417-scanner"

vi.mock("zxing-wasm/reader", () => ({ prepareZXingModule: vi.fn(), readBarcodes: vi.fn() }))

let worker: FakeWorker
class FakeWorker {
  onmessage: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { worker = this }
}
let release: ReturnType<typeof vi.fn>
let video: HTMLVideoElement
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("Worker", FakeWorker)
  release = vi.fn()
  const stream = { getTracks: () => [{ stop: release }], getVideoTracks: () => [] }
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } })
  video = document.createElement("video")
  Object.defineProperties(video, { videoWidth: { value: 1280 }, videoHeight: { value: 720 } })
  vi.spyOn(video, "play").mockResolvedValue()
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  } as unknown as CanvasRenderingContext2D)
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it("ends a scan and reports an actionable error when the worker never replies", async () => {
  const onError = vi.fn()
  const controls = await startPdf417Scan({ video, onResult: vi.fn(), onError })
  await vi.advanceTimersByTimeAsync(15_000)
  expect(onError).toHaveBeenCalledTimes(1)
  expect(release).toHaveBeenCalled()
  expect(worker.terminate).toHaveBeenCalled()
  controls.stop()
})

it("stops after a worker failure instead of repeatedly scanning a broken decoder", async () => {
  const onError = vi.fn()
  const controls = await startPdf417Scan({ video, onResult: vi.fn(), onError })
  worker.onerror?.({ message: "worker failed" })
  await vi.advanceTimersByTimeAsync(1000)
  expect(onError).toHaveBeenCalledTimes(1)
  expect(release).toHaveBeenCalled()
  expect(worker.postMessage).toHaveBeenCalledTimes(1)
  controls.stop()
})

it("stops an unreadable barcode scan within one minute", async () => {
  const onError = vi.fn()
  const controls = await startPdf417Scan({ video, onResult: vi.fn(), onError })
  worker.postMessage.mockImplementation((request) => {
    queueMicrotask(() => worker.onmessage?.({ data: { id: request.id, ok: true, text: null } }))
  })
  worker.onmessage?.({ data: { id: 1, ok: true, text: null } })
  await vi.advanceTimersByTimeAsync(60_000)
  expect(onError).toHaveBeenCalledTimes(1)
  expect(release).toHaveBeenCalled()
  controls.stop()
})

it("delivers decoded text once without a later timeout error", async () => {
  const onResult = vi.fn()
  const onError = vi.fn()
  const controls = await startPdf417Scan({ video, onResult, onError })
  worker.onmessage?.({ data: { id: 1, ok: true, text: "synthetic barcode" } })
  await vi.advanceTimersByTimeAsync(60_000)
  expect(onResult).toHaveBeenCalledExactlyOnceWith("synthetic barcode")
  expect(onError).not.toHaveBeenCalled()
  controls.stop()
  expect(release).toHaveBeenCalled()
})

it("silently cancels a pending decode", async () => {
  const onResult = vi.fn()
  const onError = vi.fn()
  const controls = await startPdf417Scan({ video, onResult, onError })
  controls.stop()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(onResult).not.toHaveBeenCalled()
  expect(onError).not.toHaveBeenCalled()
  expect(release).toHaveBeenCalled()
})
