/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Copies the zxing-wasm reader binary into public/ so the PDF417 scanner
 * (lib/identity/pdf417-scanner.ts) can load it from /wasm/zxing_reader.wasm.
 * Runs automatically before `pnpm dev` and `pnpm build`; public/wasm/ is
 * gitignored.
 */

import { copyFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(import.meta.url)

const source = require.resolve("zxing-wasm/reader/zxing_reader.wasm")
const targetDir = path.join(projectRoot, "public", "wasm")
const target = path.join(targetDir, "zxing_reader.wasm")

mkdirSync(targetDir, { recursive: true })
copyFileSync(source, target)
console.log(`copy-zxing-wasm: ${path.relative(projectRoot, target)} updated`)
