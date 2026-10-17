/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * Developer aid: pairs PDF form widgets with nearby printed text.
 *
 * Input is the XHTML from `pdftotext -bbox-layout` (top-left origin, y grows
 * downward); widget rects come from the field inventory (pdf-lib, bottom-left
 * origin). The rect is flipped with `top = pageHeight - y2`, `bottom = pageHeight - y1`.
 *
 * Heuristic (see nearestLabel):
 *  - "same line" = vertical overlap with the widget greater than 50% of the word height.
 *  - left/right: the nearest same-line word on that side within maxDistance, extended
 *    outward over adjacent words (gap <= 12pt, at most 10 words) to form a short phrase.
 *  - above: up to 2 nearest text lines whose bottom is above the widget within
 *    maxDistance; only words starting left of the widget's right edge are kept.
 *  - label = left || above[0] (or right || left || above[0] when prefer is "right").
 * Never required by tests or CI; only the pure functions here are unit tested.
 */

export type BboxWord = { text: string; x1: number; y1: number; x2: number; y2: number }
export type BboxPage = { width: number; height: number; words: BboxWord[] }
export type NearestLabel = { left: string; right: string; above: string[]; label: string }

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isNaN(code) ? m : String.fromCodePoint(code)
    }
    return ENTITIES[e] ?? m
  })
}

function attr(tag: string, name: string): number {
  const m = new RegExp(`${name}="([^"]+)"`).exec(tag)
  return m ? parseFloat(m[1]) : NaN
}

/** Parses `pdftotext -bbox-layout` XHTML into pages of word boxes (top-left origin). */
export function parseBboxPages(xhtml: string): BboxPage[] {
  const pages: BboxPage[] = []
  const re = /<page\b([^>]*)>|<word\b([^>]*)>([\s\S]*?)<\/word>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xhtml))) {
    if (m[1] !== undefined) {
      pages.push({ width: attr(m[1], "width"), height: attr(m[1], "height"), words: [] })
    } else if (pages.length) {
      pages[pages.length - 1].words.push({
        text: decode(m[3]),
        x1: attr(m[2], "xMin"),
        y1: attr(m[2], "yMin"),
        x2: attr(m[2], "xMax"),
        y2: attr(m[2], "yMax"),
      })
    }
  }
  return pages
}

/** All words from every page, in document order. */
export function parseBboxWords(xhtml: string): BboxWord[] {
  return parseBboxPages(xhtml).flatMap((p) => p.words)
}

function overlapsLine(top: number, bottom: number, w: BboxWord): boolean {
  const overlap = Math.min(bottom, w.y2) - Math.max(top, w.y1)
  return overlap > 0.5 * (w.y2 - w.y1)
}

const JOIN_GAP = 12
const MAX_JOIN_WORDS = 10

/** Walks outward from the nearest word, joining adjacent same-line words. */
function phrase(sorted: BboxWord[], dir: "left" | "right"): string {
  if (!sorted.length) return ""
  const picked = [sorted[0]]
  for (const w of sorted.slice(1)) {
    if (picked.length >= MAX_JOIN_WORDS) break
    const last = picked[picked.length - 1]
    const gap = dir === "left" ? last.x1 - w.x2 : w.x1 - last.x2
    if (gap > JOIN_GAP) break
    picked.push(w)
  }
  if (dir === "left") picked.reverse()
  return picked.map((w) => w.text).join(" ")
}

/**
 * Finds the printed text around a widget.
 * @param rect pdf-lib [x1, y1, x2, y2], bottom-left origin
 * @param pageHeight page height in points (for the y flip)
 */
export function nearestLabel(
  rect: [number, number, number, number],
  pageHeight: number,
  words: BboxWord[],
  opts: { maxDistance?: number; prefer?: "left" | "right" } = {},
): NearestLabel {
  const max = opts.maxDistance ?? 200
  const [rx1, ry1, rx2, ry2] = rect
  const top = pageHeight - ry2
  const bottom = pageHeight - ry1

  const same = words.filter((w) => overlapsLine(top, bottom, w))
  const leftWords = same
    .filter((w) => w.x2 <= rx1 + 1 && rx1 - w.x2 <= max)
    .sort((a, b) => b.x2 - a.x2)
  const rightWords = same
    .filter((w) => w.x1 >= rx2 - 1 && w.x1 - rx2 <= max)
    .sort((a, b) => a.x1 - b.x1)

  // Lines above: group by vertical overlap, nearest first.
  let pool = words
    .filter((w) => w.y2 <= top + 1 && top - w.y2 <= max && w.x1 < rx2)
    .sort((a, b) => b.y2 - a.y2)
  const above: string[] = []
  while (pool.length && above.length < 2) {
    const anchor = pool[0]
    const line = pool.filter((w) => overlapsLine(anchor.y1, anchor.y2, w))
    pool = pool.filter((w) => !line.includes(w))
    above.push(line.sort((a, b) => a.x1 - b.x1).map((w) => w.text).join(" "))
  }

  const left = phrase(leftWords, "left")
  const right = phrase(rightWords, "right")
  const label =
    opts.prefer === "right" ? right || left || above[0] || "" : left || above[0] || ""
  return { left, right, above, label }
}
