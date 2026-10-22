/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * Developer aid: prints each SACA-2 PDF field with its nearby label text.
 * Usage: npx tsx scripts/saca2-field-context.ts [--page <0-based index>] [--out <file>]
 * Requires `pdftotext` (poppler; `brew install poppler`). Never used by tests or CI.
 */
import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import path from "node:path"

import { nearestLabel, parseBboxPages } from "../lib/masshealth/saca2/pdf/field-context"
import { getInventory } from "../lib/masshealth/saca2/pdf/inventory"
import { SACA2_TEMPLATE_PATH } from "../lib/masshealth/saca2/pdf/template"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function bbox(pdf: string, page: number) {
  const n = String(page + 1)
  try {
    const xml = execFileSync("pdftotext", ["-bbox-layout", "-f", n, "-l", n, pdf, "-"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
    return parseBboxPages(xml)[0]
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error("pdftotext not found. Install poppler: brew install poppler")
      process.exit(2)
    }
    throw err
  }
}

function main() {
  const pdf = path.join(process.cwd(), SACA2_TEMPLATE_PATH)
  const pageArg = arg("--page")
  const inv = getInventory()
  const pageCount = Math.max(...inv.flatMap((f) => f.pages)) + 1
  const pageList = pageArg === undefined ? Array.from({ length: pageCount }, (_, i) => i) : [Number(pageArg)]
  if (pageList.some((p) => !Number.isInteger(p) || p < 0)) {
    console.error("--page must be a 0-based page index")
    process.exit(1)
  }

  const lines: string[] = []
  for (const p of pageList) {
    const fields = inv.filter((f) => f.pages.includes(p))
    if (!fields.length) continue
    const page = bbox(pdf, p)
    lines.push(`# page ${p}`)
    for (const f of fields) {
      const ws = f.widgets.filter((w) => w.page === p)
      const isBox = f.type === "checkbox"
      const widgets = ws.map((w) => `${w.onState ?? "-"}@${Math.round(w.rect[0])},${Math.round(w.rect[1])}`)
      const ctx = ws.map((w) => nearestLabel(w.rect, page.height, page.words))
      const labels = isBox
        ? ctx.map((c) => `left:"${c.left}" right:"${c.right}"`).join(" ; ")
        : ctx.map((c) => `label: "${c.left || c.right}"`).join(" ; ")
      const above = ctx[0]?.above.join(" / ") ?? ""
      lines.push(
        `${f.name} | ${f.type} | widgets: [${widgets.join(" ")}] | maxLen: ${f.maxLen ?? "-"} | ${labels} | above: "${above}"`,
      )
    }
  }
  const text = lines.join("\n") + "\n"
  const out = arg("--out")
  if (out) {
    writeFileSync(out, text)
    console.log(`Wrote ${lines.length} lines to ${out}`)
  } else {
    process.stdout.write(text)
  }
}

main()
