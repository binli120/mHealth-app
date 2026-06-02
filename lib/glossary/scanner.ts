import type { GlossaryIndex, Segment } from "./types"

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function buildGlossaryRegex(index: GlossaryIndex): RegExp | null {
  if (index.length === 0) return null

  const allTerms = index.flatMap((entry) => [entry.term_en, ...entry.aliases])
  allTerms.sort((a, b) => b.length - a.length)

  const pattern = allTerms.map(escapeRegex).join("|")
  return new RegExp(`\\b(${pattern})\\b`, "gi")
}

function slugForMatch(match: string, index: GlossaryIndex): { slug: string; term_en: string } | null {
  const lower = match.toLowerCase()
  for (const entry of index) {
    if (entry.term_en.toLowerCase() === lower) return entry
    if (entry.aliases.some((a) => a.toLowerCase() === lower)) return entry
  }
  return null
}

export function findTermsInText(text: string, index: GlossaryIndex): Segment[] {
  if (!text) return []
  const regex = buildGlossaryRegex(index)
  if (!regex) return [{ type: "text", content: text }]

  const segments: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Check that the match is not preceded or followed by a hyphen (compound word guard)
    const before = match.index > 0 ? text[match.index - 1] : ""
    const after = match.index + match[0].length < text.length ? text[match.index + match[0].length] : ""
    if (before === "-" || after === "-") {
      continue
    }

    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) })
    }
    const info = slugForMatch(match[0], index)
    if (info) {
      segments.push({ type: "term", content: match[0], slug: info.slug, term_en: info.term_en })
    } else {
      segments.push({ type: "text", content: match[0] })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) })
  }

  return segments
}
