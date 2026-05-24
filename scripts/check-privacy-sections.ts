/**
 * CI script: verify all 18 required privacy section anchors exist in the
 * built HTML output of /privacy, or in the MDX source as headings.
 *
 * Usage: npx tsx scripts/check-privacy-sections.ts
 */

import fs from "node:fs"
import path from "node:path"

const REQUIRED_SECTIONS: Array<{ id: string; heading: string }> = [
  { id: "overview", heading: "Overview" },
  { id: "who-uses-the-platform", heading: "Who Uses the Platform" },
  { id: "data-we-collect", heading: "Data We Collect" },
  { id: "how-we-use-data", heading: "How We Use Data" },
  { id: "ai-use", heading: "AI Use, Boundaries, and Limitations" },
  { id: "hipaa", heading: "HIPAA Compliance" },
  { id: "eligibility-boundaries", heading: "Eligibility and Plan Recommendation Boundaries" },
  { id: "hix-ies-boundaries", heading: "HIX/IES System Interaction Boundaries" },
  { id: "conflict-of-interest", heading: "Conflict of Interest" },
  { id: "language-access", heading: "Language Access" },
  { id: "data-retention", heading: "Data Retention" },
  { id: "security", heading: "Security" },
  { id: "massachusetts", heading: "Massachusetts Law" },
  { id: "sharing-and-disclosure", heading: "Sharing & Disclosure" },
  { id: "changes", heading: "Changes to This Statement" },
  { id: "your-rights", heading: "Your Rights" },
  { id: "service-region", heading: "Service Region" },
  { id: "contact", heading: "Contact" },
]

const htmlCandidates = [
  path.resolve(".next/server/app/privacy.html"),
  path.resolve(".next/server/app/privacy/index.html"),
  path.resolve("out/privacy.html"),
  path.resolve("out/privacy/index.html"),
]

let source = ""
let mode: "html" | "mdx" = "html"

for (const candidate of htmlCandidates) {
  if (fs.existsSync(candidate)) {
    source = fs.readFileSync(candidate, "utf-8")
    console.log(`Reading from: ${candidate}`)
    break
  }
}

if (!source) {
  const mdxPath = path.resolve("content/privacy.mdx")
  if (fs.existsSync(mdxPath)) {
    source = fs.readFileSync(mdxPath, "utf-8")
    mode = "mdx"
    console.log("Falling back to content/privacy.mdx source")
  } else {
    console.error("No built HTML or MDX source found. Run `pnpm build` first.")
    process.exit(1)
  }
}

const missing: string[] = []

for (const section of REQUIRED_SECTIONS) {
  if (mode === "html") {
    if (!source.includes(`id="${section.id}"`)) {
      missing.push(section.id)
    }
  } else {
    if (!source.includes(`## ${section.heading}`)) {
      missing.push(`${section.id} (heading: "## ${section.heading}")`)
    }
  }
}

if (missing.length > 0) {
  console.error(`FAIL: Missing required privacy sections: ${missing.join(", ")}`)
  process.exit(1)
}

console.log(`PASS: All ${REQUIRED_SECTIONS.length} required privacy sections present.`)
