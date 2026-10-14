/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

export type PathSegment = string | number

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"])

export function parsePath(path: string): PathSegment[] {
  return path
    .split(".")
    .filter((segment) => segment !== "")
    .map((segment) => {
      if (FORBIDDEN_SEGMENTS.has(segment)) {
        throw new Error(`Forbidden path segment: ${segment}`)
      }
      return /^\d+$/.test(segment) ? Number(segment) : segment
    })
}

export function getAtPath(root: unknown, path: string): unknown {
  let current: unknown = root
  for (const segment of parsePath(path)) {
    if (current === null || current === undefined || typeof current !== "object") return undefined
    current = (current as Record<PathSegment, unknown>)[segment]
  }
  return current
}

function setIn(node: unknown, segments: PathSegment[], index: number, value: unknown): unknown {
  const segment = segments[index]
  const clone: Record<PathSegment, unknown> = Array.isArray(node)
    ? ([...node] as unknown as Record<PathSegment, unknown>)
    : node && typeof node === "object"
      ? { ...(node as Record<PathSegment, unknown>) }
      : typeof segment === "number"
        ? ([] as unknown as Record<PathSegment, unknown>)
        : {}
  clone[segment] = index === segments.length - 1 ? value : setIn(clone[segment], segments, index + 1, value)
  return clone
}

export function setAtPath<T>(root: T, path: string, value: unknown): T {
  const segments = parsePath(path)
  if (segments.length === 0) throw new Error("Empty path")
  return setIn(root, segments, 0, value) as T
}
