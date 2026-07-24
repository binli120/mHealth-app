import { runHttpCheck } from "./_http.mjs"

export function checkApp({ domain, timeoutMs }) {
  return runHttpCheck("app", `https://${domain}/api/health`, { timeoutMs })
}
