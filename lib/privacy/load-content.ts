import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import type { PrivacyFrontmatter } from "./types"

const CONTENT_DIR = path.join(process.cwd(), "content")

export function loadPrivacyContent(versionId?: string) {
  const filePath = versionId
    ? path.join(CONTENT_DIR, "privacy", "versions", `${versionId}.mdx`)
    : path.join(CONTENT_DIR, "privacy.mdx")

  if (!fs.existsSync(filePath)) {
    return null
  }

  const raw = fs.readFileSync(filePath, "utf-8")
  const { data, content } = matter(raw)

  return {
    frontmatter: data as PrivacyFrontmatter,
    source: content,
  }
}

export function listPrivacyVersions(): string[] {
  const versionsDir = path.join(CONTENT_DIR, "privacy", "versions")
  if (!fs.existsSync(versionsDir)) return []

  return fs
    .readdirSync(versionsDir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(".mdx", ""))
    .sort()
    .reverse()
}
