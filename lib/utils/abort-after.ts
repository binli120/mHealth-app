/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * An AbortSignal that aborts after `ms`. `AbortSignal.timeout` is missing on Safari 15
 * and older, where calling it throws and would crash the caller, so fall back to an
 * AbortController + setTimeout. Call `cancel()` when the work finishes so the fallback
 * timer does not linger (a no-op for the native signal).
 */
export function abortAfter(ms: number): { signal: AbortSignal; cancel: () => void } {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(ms), cancel: () => {} }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new DOMException("signal timed out", "TimeoutError"))
  }, ms)
  return { signal: controller.signal, cancel: () => clearTimeout(timer) }
}
