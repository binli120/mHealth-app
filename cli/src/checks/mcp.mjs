import { runHttpCheck } from "./_http.mjs"

export function checkMcp({ domain, timeoutMs }) {
  return runHttpCheck("mcp", `https://${domain}/.well-known/oauth-authorization-server`, { timeoutMs })
}
