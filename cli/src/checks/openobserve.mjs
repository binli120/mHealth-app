import { runHttpCheck } from "./_http.mjs"

export function checkOpenobserve({ domain, timeoutMs }) {
  return runHttpCheck("openobserve", `https://observe.${domain}/healthz`, { timeoutMs })
}
