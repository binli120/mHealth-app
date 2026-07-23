import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const SSH_ALIAS = "healthcompass-vps"
const UNREACHABLE_PATTERN = /could not resolve hostname|could not resolve|connection refused|connection timed out|permission denied \(publickey/i

export function classifySshExit({ code, stderr, durationMs }) {
  if (code !== 0 && UNREACHABLE_PATTERN.test(stderr)) {
    return {
      name: "vps",
      status: "skip",
      detail: `SSH alias "${SSH_ALIAS}" not reachable — add it to ~/.ssh/config (see cli/README.md)`,
      durationMs,
    }
  }
  if (code === 0) {
    return { name: "vps", status: "pass", detail: "all containers healthy", durationMs }
  }
  const tail = stderr.trim().split("\n").slice(-3).join(" | ") || "check-services.sh reported failures"
  return { name: "vps", status: "fail", detail: tail, durationMs }
}

export function checkVps({ repoRoot, timeoutMs = 15000 } = {}) {
  const start = Date.now()
  const scriptPath = path.join(repoRoot, "deploy", "check-services.sh")

  return new Promise((resolve) => {
    const child = spawn(
      "ssh",
      ["-o", "ConnectTimeout=8", "-o", "BatchMode=yes", SSH_ALIAS, "bash -s"],
      { stdio: [fs.createReadStream(scriptPath), "pipe", "pipe"] },
    )

    let stderr = ""
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.stdout.pipe(process.stdout)

    const timer = setTimeout(() => {
      child.kill()
      resolve({ name: "vps", status: "fail", detail: "ssh check timed out", durationMs: Date.now() - start })
    }, timeoutMs)

    child.on("error", (err) => {
      clearTimeout(timer)
      resolve({ name: "vps", status: "fail", detail: `ssh spawn failed: ${err.message}`, durationMs: Date.now() - start })
    })

    child.on("close", (code) => {
      clearTimeout(timer)
      resolve(classifySshExit({ code, stderr, durationMs: Date.now() - start }))
    })
  })
}
