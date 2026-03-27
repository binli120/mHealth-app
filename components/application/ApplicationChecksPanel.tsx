/**
 * Displays business-rule check results for an extracted application.
 * @author Bin Lee
 */

import {
  type ApplicationCheckResult,
} from "@/lib/masshealth/application-checks"
import { cn } from "@/lib/utils"
import { CHECK_CATEGORY_LABELS, SEVERITY_STYLES } from "@/app/application/check/page.constants"

export function ApplicationChecksPanel({ results }: { results: ApplicationCheckResult[] }) {
  const errorCount = results.filter((r) => r.severity === "error").length
  const warnCount = results.filter((r) => r.severity === "warning").length
  const infoCount = results.filter((r) => r.severity === "info").length

  const byCategory = new Map<string, ApplicationCheckResult[]>()
  for (const result of results) {
    const list = byCategory.get(result.category) ?? []
    list.push(result)
    byCategory.set(result.category, list)
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-foreground">Business Rule Checks</p>
        <div className="flex gap-2 text-xs">
          {errorCount > 0 ? (
            <span className="rounded-full px-2 py-0.5 bg-destructive/15 text-destructive font-medium">
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          ) : null}
          {warnCount > 0 ? (
            <span className="rounded-full px-2 py-0.5 bg-warning/15 text-warning font-medium">
              {warnCount} warning{warnCount !== 1 ? "s" : ""}
            </span>
          ) : null}
          {infoCount > 0 ? (
            <span className="rounded-full px-2 py-0.5 bg-blue-500/15 text-blue-600 font-medium">
              {infoCount} note{infoCount !== 1 ? "s" : ""}
            </span>
          ) : null}
          {results.length === 0 ? (
            <span className="rounded-full px-2 py-0.5 bg-success/15 text-success font-medium">
              All checks passed
            </span>
          ) : null}
        </div>
      </div>

      {Array.from(byCategory.entries()).map(([category, items]) => (
        <div key={category} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {CHECK_CATEGORY_LABELS[category] ?? category}
          </p>
          <div className="space-y-2">
            {items.map((result) => {
              const styles = SEVERITY_STYLES[result.severity]
              return (
                <div
                  key={result.id}
                  className={cn("rounded-lg border px-3 py-2.5 text-sm", styles.row)}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                        styles.badge,
                      )}
                    >
                      {styles.label}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{result.title}</p>
                      <p className="mt-0.5 text-muted-foreground">{result.message}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
