/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import Link from "next/link"
import { useMemo } from "react"
import { evaluateSaca2Eligibility, saca2ScreeningFallback } from "@/lib/masshealth/saca2/eligibility-engine"
import { dollarsToCents, formatDollars } from "@/lib/masshealth/saca2/eligibility/money"
import type { Saca2EligibilityResult, Saca2Estimates, Saca2ScreeningStatus } from "@/lib/masshealth/saca2/eligibility/types"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import type { Saca2Answers } from "@/lib/masshealth/saca2/types"

interface Saca2ScreeningResultProps {
  /** In-memory answers. Evaluated in the browser only; never sent, stored, or logged. */
  answers: Saca2Answers
  /** Screening date; defaults to now. */
  on?: Date
}

const STATUS_COPY: Record<Saca2ScreeningStatus, { title: string; body: string }> = {
  LIKELY_ELIGIBLE: { title: "You may qualify", body: "Based on your answers, you may qualify for MassHealth." },
  NEEDS_REVIEW: {
    title: "MassHealth needs to review your answers",
    body: "Some answers need a closer look, so we can't estimate a result. You can still apply.",
  },
  LIKELY_INELIGIBLE: {
    title: "You may not qualify right now",
    body: "Based on your answers, you may not qualify yet. You can still apply; MassHealth makes the final decision.",
  },
  PENDING_DOCUMENTS: {
    title: "You may qualify once your documents are checked",
    body: "Send the documents listed below with your application.",
  },
  REDIRECT_ACA3: {
    title: "A different application may fit better",
    body: "People who live with and care for a child under 19 usually apply with the ACA-3 application.",
  },
}

const usd = (dollars: number) => formatDollars(dollarsToCents(dollars))

function describeEstimates(e: Saca2Estimates): string[] {
  const lines: string[] = []
  if (e.monthlyIncome !== null) {
    lines.push(`Monthly income counted: ${usd(e.monthlyIncome)}${e.incomeLimit ? ` (limit ${usd(e.incomeLimit.monthly)})` : ""}`)
  }
  if (e.countableAssets !== null) {
    lines.push(`Countable assets: ${usd(e.countableAssets)}${e.assetLimit !== null ? ` (limit ${usd(e.assetLimit)})` : ""}`)
  }
  if (e.transfersInWindow !== null && e.transfersInWindow.total > 0) {
    lines.push(`Transfers in the past 60 months: ${usd(e.transfersInWindow.total)} (about ${e.transfersInWindow.penaltyDays} days of delayed long-term-care payment)`)
  }
  if (e.spousalAllowance !== null) lines.push(`Monthly allowance for your spouse at home: ${usd(e.spousalAllowance.allowance)}`)
  if (e.patientPaidAmount !== null) lines.push(`Your monthly share of nursing-facility costs: ${usd(e.patientPaidAmount)}`)
  return lines
}

function safeEvaluate(answers: Saca2Answers, on: Date): Saca2EligibilityResult {
  try {
    return evaluateSaca2Eligibility(answers, SACA2_FIGURES, on)
  } catch {
    return saca2ScreeningFallback()
  }
}

export function Saca2ScreeningResult({ answers, on }: Saca2ScreeningResultProps) {
  const time = on?.getTime()
  const result = useMemo(() => safeEvaluate(answers, time === undefined ? new Date() : new Date(time)), [answers, time])
  const copy = STATUS_COPY[result.status]
  const estimates = describeEstimates(result.estimates)
  const findings = result.findings.filter((f) => f.level !== "success")

  return (
    <section data-testid="saca2-screening" aria-labelledby="saca2-screening-title" className="space-y-3 rounded-md border p-4">
      <h3 id="saca2-screening-title" className="text-base font-semibold">
        Screening estimate
      </h3>
      <p data-testid="saca2-screening-label" className="text-sm font-medium">
        {result.screening_label}
      </p>
      <p data-testid="saca2-screening-status" data-status={result.status} className="text-sm">
        <strong>{copy.title}.</strong> {copy.body}
      </p>
      {result.redirect_href ? (
        <Link href={result.redirect_href} className="inline-block text-sm font-medium text-primary underline underline-offset-2">
          Go to the ACA-3 application
        </Link>
      ) : null}
      {findings.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {findings.map((f) => (
            <li key={`${f.code}-${f.message}`}>{f.message}</li>
          ))}
        </ul>
      ) : null}
      {estimates.length > 0 ? (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">Estimated figures (not a decision)</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {estimates.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">Documents to gather</h4>
        {result.document_checklist.length > 0 ? (
          <ul data-testid="saca2-document-checklist" className="list-disc space-y-1 pl-5 text-sm">
            {result.document_checklist.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground"> — {item.reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No documents identified from your answers. MassHealth may still ask for proof.</p>
        )}
      </div>
    </section>
  )
}
