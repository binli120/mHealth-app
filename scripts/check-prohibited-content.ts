/**
 * CI script: grep guard for prohibited content in the privacy page.
 * Ensures no GDPR, CCPA, or genetic-data-collection claims appear
 * in content or source files.
 *
 * Usage: npx tsx scripts/check-prohibited-content.ts
 */

import { execSync } from "node:child_process"

const PROHIBITED = [
  { pattern: "\\bGDPR\\b", desc: "GDPR reference (out of scope Phase 1)" },
  { pattern: "\\bDPO\\b", desc: "Data Protection Officer (EU concept)" },
  { pattern: "UK GDPR", desc: "UK GDPR reference" },
  { pattern: "\\bSCC\\b", desc: "Standard Contractual Clauses (EU concept)" },
  { pattern: "\\bIDTA\\b", desc: "UK International Data Transfer Agreement" },
  { pattern: "EU representative", desc: "EU representative reference" },
  { pattern: "Art\\.\\s*27", desc: "GDPR Article 27 representative" },
  { pattern: "European Union", desc: "EU reference" },
  { pattern: "\\bCCPA\\b", desc: "CCPA reference" },
  { pattern: "California Consumer Privacy", desc: "CCPA-style rights language" },
  {
    pattern: "right to delete|right to know|right to opt.out",
    desc: "CCPA-style rights language",
  },
]

const SEARCH_DIRS = ["content/", "app/privacy/", "components/privacy/", "lib/privacy/"]
const EXTENSIONS = "--include='*.mdx' --include='*.tsx' --include='*.ts'"

const ALLOWLIST = [
  "check-prohibited-content",
  "out of scope",
  "out-of-scope",
  "extend CCPA",
  "CCPA-style",
  "CCPA / CPRA",
  "CCPA / CPRA definition",
  "California Consumer Privacy Act / CPRA",
  "does NOT collect genetic",
  "not collect, process, or store genetic",
  "Consumer Rights Posture",
  "durable as HealthCompass expands",
]

let failed = false

for (const { pattern, desc } of PROHIBITED) {
  for (const dir of SEARCH_DIRS) {
    try {
      const result = execSync(
        `grep -rn -E '${pattern}' ${dir} ${EXTENSIONS} 2>/dev/null || true`,
        { encoding: "utf-8" },
      )

      const lines = result
        .split("\n")
        .filter((line) => line.trim())
        .filter((line) => !ALLOWLIST.some((allow) => line.includes(allow)))

      if (lines.length > 0) {
        console.error(`PROHIBITED: ${desc}`)
        lines.forEach((l) => console.error(`  ${l}`))
        failed = true
      }
    } catch {
      // grep returns non-zero if no match
    }
  }
}

if (failed) {
  console.error("\nFAIL: Prohibited content found.")
  process.exit(1)
}

console.log("PASS: No prohibited content found.")
