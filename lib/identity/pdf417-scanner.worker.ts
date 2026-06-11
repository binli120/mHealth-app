/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Dedicated worker for PDF417 decoding (zxing-wasm).
 *
 * Decoding a 1080p frame with tryHarder takes 100–500ms on mobile CPUs.
 * Running it here keeps the main thread free so the scan page stays
 * responsive (buttons, consent banner, React updates) while scanning.
 */

import { prepareZXingModule, readBarcodes, type ReaderOptions } from "zxing-wasm/reader"

prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith(".wasm") ? "/wasm/zxing_reader.wasm" : prefix + path,
  },
})

export interface DecodeRequest {
  id: number
  imageData: ImageData
  options: ReaderOptions
}

export type DecodeResponse =
  | { id: number; ok: true; text: string | null }
  | { id: number; ok: false; error: string }

// tsconfig doesn't include the "webworker" lib, so type the worker global
// through the structural pieces we actually use.
const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<DecodeRequest>) => void) | null
  postMessage: (message: DecodeResponse) => void
}

workerScope.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const { id, imageData, options } = event.data
  try {
    const results = await readBarcodes(imageData, options)
    const hit = results.find((r) => r.isValid && r.text.trim().length > 0)
    workerScope.postMessage({ id, ok: true, text: hit ? hit.text : null })
  } catch (err) {
    workerScope.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
