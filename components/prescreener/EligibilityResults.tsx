/**
 * Chat UI sub-components for the Eligibility Pre-Screener.
 * Exports: BotAvatar, ChatBubble, ResultsPanel, FPLReferenceTable
 * @author Bin Lee
 */

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Heart,
  RotateCcw,
} from "lucide-react"
import type { EligibilityReport, ScreenerData } from "@/lib/eligibility-engine"
import { FPL_TABLE_2026 } from "@/lib/eligibility-engine"
import { colorConfig } from "@/app/prescreener/page.utils"
import type { ChatMessage } from "@/app/prescreener/page.types"

// ─── Bot Avatar ────────────────────────────────────────────────────────────

export function BotAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
      <Heart className="h-4 w-4 text-primary-foreground" />
    </div>
  )
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────

export function ChatBubble({ message }: { message: ChatMessage }) {
  const isBot = message.role === "bot"
  return (
    <div className={`flex items-end gap-3 ${isBot ? "" : "flex-row-reverse"}`}>
      {isBot && <BotAvatar />}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isBot
            ? "rounded-bl-sm bg-secondary text-foreground"
            : "rounded-br-sm bg-primary text-primary-foreground"
        }`}
      >
        {message.text}
      </div>
    </div>
  )
}

// ─── FPL Reference Table ──────────────────────────────────────────────────

export function FPLReferenceTable({
  householdSize,
  fplPct,
}: {
  householdSize: number
  fplPct: number
}) {
  const row = FPL_TABLE_2026.find((r) => r.householdSize === Math.min(householdSize, 8))
  if (!row) return null

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        2026 FPL Reference — Household of {householdSize}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {[
          { label: "100% FPL", value: `$${row.annualFPL.toLocaleString()}/yr` },
          { label: "138% FPL (Medicaid)", value: `$${row.pct138.toLocaleString()}/yr` },
          { label: "200% FPL", value: `$${row.pct200.toLocaleString()}/yr` },
          { label: "300% FPL", value: `$${row.pct300.toLocaleString()}/yr` },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-secondary p-2 text-center">
            <p className="text-muted-foreground">{item.label}</p>
            <p className="font-semibold text-foreground mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground text-center">
        Your income is at <strong>{fplPct}% FPL</strong>
      </p>
    </div>
  )
}

// ─── Results Panel ────────────────────────────────────────────────────────

export function ResultsPanel({
  report,
  screenerData,
  onReset,
}: {
  report: EligibilityReport
  screenerData: Partial<ScreenerData>
  onReset: () => void
}) {
  const topColor = report.results[0]?.color ?? "gray"
  const headerBg =
    topColor === "green"
      ? "bg-emerald-50 border-emerald-200"
      : topColor === "yellow"
      ? "bg-amber-50 border-amber-200"
      : topColor === "red"
      ? "bg-red-50 border-red-200"
      : "bg-blue-50 border-blue-200"

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className={`rounded-2xl border p-5 ${headerBg}`}>
        <h2 className="text-base font-semibold text-foreground mb-1">
          Pre-Screening Complete
        </h2>
        <p className="text-sm text-muted-foreground">{report.summary}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full bg-white/70 border border-border px-3 py-1">
            Household: <strong>{screenerData.householdSize ?? 1}</strong>
          </span>
          <span className="rounded-full bg-white/70 border border-border px-3 py-1">
            Annual Income:{" "}
            <strong>${(screenerData.annualIncome ?? 0).toLocaleString()}</strong>
          </span>
          <span className="rounded-full bg-white/70 border border-border px-3 py-1">
            Income Level:{" "}
            <strong>{report.fplPercent}% of FPL</strong>
          </span>
        </div>
      </div>

      {/* Program results */}
      <div className="space-y-3">
        {report.results.map((result, i) => {
          const cfg = colorConfig(result.color)
          return (
            <div key={i} className={`rounded-xl border p-4 ${cfg.bg}`}>
              <div className="flex items-start gap-3">
                {cfg.icon}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm text-foreground">
                      {result.program}
                    </h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 mb-1">{result.tagline}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {result.details}
                  </p>
                  {result.actionHref !== "#" && (
                    <a
                      href={result.actionHref}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {result.actionLabel}
                      {result.actionHref.startsWith("http") ? (
                        <ExternalLink className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* FPL Reference */}
      <FPLReferenceTable householdSize={screenerData.householdSize ?? 1} fplPct={report.fplPercent} />

      {/* Actions */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Next Steps</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/application/new">
            <Button className="w-full gap-2">
              Start Full Application
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" onClick={onReset} className="w-full gap-2">
            <RotateCcw className="h-4 w-4" />
            Check Again
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Call MassHealth at{" "}
          <a href="tel:18008412900" className="font-medium text-primary">
            1-800-841-2900
          </a>{" "}
          (Mon–Fri, 8am–5pm) for personalized assistance.
        </p>
      </div>
    </div>
  )
}
