import { runHttpCheck } from "./_http.mjs"

export function checkDb({ domain, timeoutMs }) {
  return runHttpCheck("db", `https://${domain}/api/health/db`, { timeoutMs })
}
