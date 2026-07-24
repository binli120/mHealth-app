import { execFile } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export function resolveRepoRoot(fileUrl) {
  return fileURLToPath(new URL("../../", fileUrl))
}

export async function getVersionInfo(repoRoot) {
  const pkgPath = path.join(repoRoot, "cli", "package.json")
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))

  let sha = "unknown"
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoRoot, "rev-parse", "--short", "HEAD"])
    sha = stdout.trim()
  } catch {
    // not a git checkout, or git unavailable — version alone is still useful
  }

  return { version: pkg.version, sha }
}

export async function updateSelf({ repoRoot }) {
  try {
    const before = await execFileAsync("git", ["-C", repoRoot, "rev-parse", "--short", "HEAD"])
    await execFileAsync("git", ["-C", repoRoot, "fetch"])
    await execFileAsync("git", ["-C", repoRoot, "pull", "--ff-only"])
    const after = await execFileAsync("git", ["-C", repoRoot, "rev-parse", "--short", "HEAD"])

    const beforeSha = before.stdout.trim()
    const afterSha = after.stdout.trim()
    const message =
      beforeSha === afterSha
        ? `already up to date (${afterSha})`
        : `updated ${beforeSha} → ${afterSha}`

    return { ok: true, message }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `update failed: ${message}` }
  }
}
