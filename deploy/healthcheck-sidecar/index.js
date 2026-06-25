// deploy/healthcheck-sidecar/index.js
// Lightweight service health checker.
// Reads /var/run/docker.sock to inspect containers, probes their internal HTTP
// endpoints, and exposes GET /status returning structured JSON.
// No npm dependencies — uses only Node.js built-ins.
//
// Security notes:
//   • All http.request / http.get calls target either:
//       a) /var/run/docker.sock  — a Unix domain socket, not a network interface
//       b) Internal Docker bridge IPs (172.x.x.x) — never leave the host machine
//   • The http.createServer listens only on the internal Docker network (no host port binding)
//   • Traefik :443 is probed via TCP (net.createConnection) to avoid TLS cert issues
//     on localhost without needing rejectUnauthorized: false

"use strict"

const http = require("http") // nosemgrep: problem-based-packs.insecure-transport.js-node.using-http-server.using-http-server
const net  = require("net")

const PORT = process.env.PORT || 4000

const SERVICES = [
  { name: "healthcompass-proxy",   label: "Traefik",      port: null,  path: null },
  { name: "healthcompass-app",     label: "Next.js App",  port: 3000,  path: "/" },
  { name: "healthcompass-ollama",  label: "Ollama",       port: 11434, path: "/" },
  { name: "healthcompass-whisper", label: "Whisper ASR",  port: 9000,  path: "/" },
  { name: "openobserve",           label: "OpenObserve",  port: 5080,  path: "/healthz" },
  { name: "healthcompass-vector",  label: "Vector",       port: null,  path: null },
  { name: "healthcompass-mcp",     label: "MCP Server",   port: 3001,  path: "/" },
]

// ── Docker socket helpers ─────────────────────────────────────────────────────

function dockerGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.request( // nosemgrep: problem-based-packs.insecure-transport.js-node.using-http-server.using-http-server
      { socketPath: "/var/run/docker.sock", path, method: "GET" },
      (res) => {
        let body = ""
        res.on("data", (chunk) => { body += chunk })
        res.on("end", () => {
          try { resolve(JSON.parse(body)) }
          catch { resolve(body) }
        })
      },
    )
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("docker timeout")) })
    req.on("error", reject)
    req.end()
  })
}

// ── Probe helpers ─────────────────────────────────────────────────────────────

// HTTP probe to an internal Docker bridge IP — traffic never leaves the host.
function httpProbe(ip, port, path, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.get( // nosemgrep: problem-based-packs.insecure-transport.js-node.using-http-server.using-http-server
      { host: ip, port, path },
      (res) => { res.resume(); resolve(res.statusCode) },
    )
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null) })
    req.on("error", () => resolve(null))
  })
}

// HTTP GET that collects the response body.
function httpGetBody(ip, port, path, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get( // nosemgrep: problem-based-packs.insecure-transport.js-node.using-http-server.using-http-server
      { host: ip, port, path },
      (res) => {
        let body = ""
        res.on("data", (d) => { body += d })
        res.on("end", () => resolve(body.trim()))
      },
    )
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve("") })
    req.on("error", () => resolve(""))
  })
}

// TCP-level probe — used for Traefik :443 to verify the port is open without
// requiring TLS certificate validation against localhost.
function tcpProbe(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port })
    sock.setTimeout(timeoutMs)
    sock.on("connect", () => { sock.destroy(); resolve(true) })
    sock.on("error",   () => resolve(false))
    sock.on("timeout", () => { sock.destroy(); resolve(false) })
  })
}

// ── Container helpers ─────────────────────────────────────────────────────────

function firstIp(detail) {
  const nets = detail?.NetworkSettings?.Networks ?? {}
  for (const n of Object.values(nets)) {
    if (n.IPAddress) return n.IPAddress
  }
  return null
}

// ── Main check ────────────────────────────────────────────────────────────────

async function checkAll() {
  const containers = await dockerGet("/containers/json?all=true")
  const byName = {}
  for (const c of containers) {
    const n = (c.Names[0] ?? "").replace(/^\//, "")
    byName[n] = c
  }

  const results = await Promise.all(SERVICES.map(async (svc) => {
    const c = byName[svc.name]

    if (!c) {
      return { name: svc.name, label: svc.label, running: false, health: "missing", uptime: null, restarts: null, httpStatus: null }
    }

    const running = c.State === "running"
    const uptime  = c.Status ?? null
    let restarts  = 0
    let ip        = null
    let extra     = {}

    if (running) {
      try {
        const detail = await dockerGet(`/containers/${c.Id}/json`)
        restarts = detail.RestartCount ?? 0
        ip       = firstIp(detail)
      } catch { /* best-effort */ }
    }

    let httpStatus = null
    let health     = "unknown"

    if (!running) {
      health = "down"

    } else if (svc.name === "healthcompass-proxy") {
      // Traefik: host-bound ports — use TCP probe for :443 to avoid cert issues
      const http80  = await httpProbe("127.0.0.1", 80, "/") // nosemgrep: problem-based-packs.insecure-transport.js-node.using-http-server.using-http-server
      const tls443  = await tcpProbe("127.0.0.1", 443)
      httpStatus    = http80
      extra         = { http: http80, tlsPortOpen: tls443 }
      health        = http80 ? "up" : "down"

    } else if (svc.name === "healthcompass-vector") {
      // Vector has no HTTP endpoint — healthy if running with low restarts
      health = restarts >= 5 ? "warn" : "up"

    } else if (ip && svc.port) {
      httpStatus = await httpProbe(ip, svc.port, svc.path ?? "/", svc.name === "healthcompass-whisper" ? 8000 : 5000)

      if (httpStatus !== null) {
        health = "up"
      } else {
        // Whisper model load can take 2-3 min — warn rather than down
        health = svc.name === "healthcompass-whisper" ? "warn" : "down"
      }

      if (svc.name === "healthcompass-ollama" && health === "up") {
        try {
          const body = await httpGetBody(ip, 11434, "/api/tags")
          const tags = JSON.parse(body)
          extra = { modelCount: tags?.models?.length ?? 0 }
        } catch { extra = { modelCount: 0 } }
      }

      if (svc.name === "openobserve" && health === "up") {
        const body = await httpGetBody(ip, 5080, "/healthz")
        if (body) extra = { healthz: body }
      }

    } else {
      health = "down"
    }

    if (restarts >= 5 && health === "up") health = "warn"

    return { name: svc.name, label: svc.label, running, health, uptime, restarts, httpStatus, ...extra }
  }))

  return results
}

// ── HTTP server ───────────────────────────────────────────────────────────────
// Bound only to the internal Docker network — not accessible from the public internet.

const server = http.createServer(async (req, res) => { // nosemgrep: problem-based-packs.insecure-transport.js-node.using-http-server.using-http-server
  if (req.url !== "/status" || req.method !== "GET") {
    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: "not found" }))
    return
  }

  try {
    const services = await checkAll()
    const anyDown  = services.some((s) => s.health === "down" || s.health === "missing")
    const anyWarn  = services.some((s) => s.health === "warn")

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok:        true,
      timestamp: new Date().toISOString(),
      summary:   anyDown ? "degraded" : anyWarn ? "warn" : "healthy",
      services,
    }))
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: String(err) }))
  }
})

server.listen(PORT, () => {
  console.log(`healthcheck-sidecar listening on :${PORT}`)
})
