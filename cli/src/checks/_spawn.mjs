import { spawn } from "node:child_process"

export function exitCodeToStatus(code) {
  return code === 0 ? "pass" : "fail"
}

export function runSpawnCheck(name, command, args, { quiet = false, cwd } = {}) {
  const start = Date.now()
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: quiet ? "ignore" : "inherit",
      shell: false,
      cwd,
    })

    child.on("error", (err) => {
      resolve({
        name,
        status: "fail",
        detail: `failed to start: ${err.message}`,
        durationMs: Date.now() - start,
      })
    })

    child.on("close", (code) => {
      resolve({
        name,
        status: exitCodeToStatus(code),
        detail: code === 0 ? "exited 0" : `exited ${code}`,
        durationMs: Date.now() - start,
      })
    })
  })
}
