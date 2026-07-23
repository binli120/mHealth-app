export function classifyHttpResult({ name, elapsedMs, response, error, expectedStatuses = [200] }) {
  if (error) {
    return { name, status: "fail", detail: `request failed: ${error.message}`, durationMs: elapsedMs }
  }
  if (expectedStatuses.includes(response.status)) {
    return { name, status: "pass", detail: `HTTP ${response.status}`, durationMs: elapsedMs }
  }
  return { name, status: "fail", detail: `unexpected HTTP ${response.status}`, durationMs: elapsedMs }
}

export async function runHttpCheck(name, url, { timeoutMs = 8000, expectedStatuses = [200] } = {}) {
  const start = Date.now()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    return classifyHttpResult({ name, elapsedMs: Date.now() - start, response, error: null, expectedStatuses })
  } catch (error) {
    return classifyHttpResult({ name, elapsedMs: Date.now() - start, response: null, error, expectedStatuses })
  }
}
