/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * Regenerates lib/masshealth/saca2/pdf/field-inventory.json from the pinned
 * SACA-2 template. Run after a form reissue: `npm run saca2:inventory`.
 */
import { writeFile } from "node:fs/promises"
import path from "node:path"

import { extractInventory } from "../lib/masshealth/saca2/pdf/extract"
import { loadSaca2Template } from "../lib/masshealth/saca2/pdf/template"

async function main() {
  const inventory = await extractInventory(await loadSaca2Template())
  const out = path.join(process.cwd(), "lib/masshealth/saca2/pdf/field-inventory.json")
  await writeFile(out, JSON.stringify(inventory, null, 1) + "\n")
  console.log(`Wrote ${inventory.length} fields to ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
