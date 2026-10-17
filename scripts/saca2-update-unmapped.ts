/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * Regenerates lib/masshealth/saca2/pdf/unmapped-fields.json: every inventory field that is neither
 * in FIELD_MAP nor in NEVER_FILL. Run after changing the map: `npx tsx scripts/saca2-update-unmapped.ts`.
 */
import { writeFile } from "node:fs/promises"
import path from "node:path"

import { FIELD_MAP } from "../lib/masshealth/saca2/pdf/field-map"
import { computeUnmappedFields } from "../lib/masshealth/saca2/pdf/unmapped"

async function main() {
  const unmapped = computeUnmappedFields(FIELD_MAP)
  const out = path.join(process.cwd(), "lib/masshealth/saca2/pdf/unmapped-fields.json")
  await writeFile(out, JSON.stringify(unmapped, null, 1) + "\n")
  console.log(`Wrote ${unmapped.length} unmapped fields to ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
