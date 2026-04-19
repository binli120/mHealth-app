import * as fs from "fs"

export function hasSupabaseAuthState(filePath: string): boolean {
  try {
    const state = JSON.parse(fs.readFileSync(filePath, "utf8"))
    return state.origins?.some((origin: { localStorage?: { name: string }[] }) =>
      origin.localStorage?.some((item: { name: string }) =>
        item.name.startsWith("sb-") && item.name.endsWith("-auth-token"),
      ),
    ) ?? false
  } catch {
    return false
  }
}
