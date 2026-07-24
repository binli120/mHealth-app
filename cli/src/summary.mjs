const ICONS = { pass: "✓", warn: "⚠", fail: "✗", skip: "⏭" }

export function deriveExitCode(results) {
  return results.some((r) => r.status === "fail") ? 1 : 0
}

export function summaryLabel(results) {
  if (results.some((r) => r.status === "fail")) return "degraded"
  if (results.some((r) => r.status === "warn")) return "warn"
  return "healthy"
}

export function formatTable(results) {
  const lines = results.map((r) => {
    const icon = ICONS[r.status] ?? "?"
    const name = r.name.padEnd(14)
    const status = r.status.toUpperCase().padEnd(5)
    return `  ${icon}  ${name} ${status} — ${r.detail} (${r.durationMs}ms)`
  })
  lines.push("")
  lines.push(`Summary: ${summaryLabel(results)}`)
  return lines.join("\n")
}

export function formatJson(results) {
  return JSON.stringify(
    { ok: deriveExitCode(results) === 0, summary: summaryLabel(results), results },
    null,
    2,
  )
}
