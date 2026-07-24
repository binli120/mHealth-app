import tls from "node:tls"

export function certStatus(validTo, now = new Date(), warnDays = 14) {
  const msRemaining = validTo.getTime() - now.getTime()
  if (msRemaining <= 0) return "fail"
  const daysRemaining = msRemaining / (1000 * 60 * 60 * 24)
  return daysRemaining < warnDays ? "warn" : "pass"
}

export function checkEdge({ domain, timeoutMs = 8000 }) {
  const start = Date.now()
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: domain, port: 443, servername: domain, timeout: timeoutMs },
      () => {
        const cert = socket.getPeerCertificate()
        socket.end()

        if (!cert || !cert.valid_to) {
          resolve({ name: "edge", status: "fail", detail: "no certificate returned", durationMs: Date.now() - start })
          return
        }

        const validTo = new Date(cert.valid_to)
        const status = certStatus(validTo, new Date())
        const daysLeft = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        resolve({
          name: "edge",
          status,
          detail: `cert valid to ${cert.valid_to} (${daysLeft}d remaining)`,
          durationMs: Date.now() - start,
        })
      },
    )

    socket.on("timeout", () => {
      socket.destroy()
      resolve({ name: "edge", status: "fail", detail: "TLS connect timed out", durationMs: Date.now() - start })
    })

    socket.on("error", (err) => {
      resolve({ name: "edge", status: "fail", detail: `TLS connect failed: ${err.message}`, durationMs: Date.now() - start })
    })
  })
}
