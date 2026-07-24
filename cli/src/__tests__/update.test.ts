import path from "node:path"
import { pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import { resolveRepoRoot } from "../update.mjs"

describe("resolveRepoRoot", () => {
  it("resolves two directories up from the given file url", () => {
    const fakeFileUrl = pathToFileURL("/repo/cli/src/run.mjs").href
    const root = resolveRepoRoot(fakeFileUrl)
    expect(path.normalize(root)).toBe(path.normalize("/repo/"))
  })

  it("works the same for a file under cli/bin", () => {
    const fakeFileUrl = pathToFileURL("/repo/cli/bin/mh.mjs").href
    const root = resolveRepoRoot(fakeFileUrl)
    expect(path.normalize(root)).toBe(path.normalize("/repo/"))
  })
})
