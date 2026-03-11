"use client"

import { ExternalLink, Phone, RefreshCw, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { BenefitProgramCard } from "./BenefitProgramCard"
import type { BenefitStack } from "@/lib/benefit-orchestration/types"

interface BenefitStackViewProps {
  stack: BenefitStack
  onUpdateProfile: () => void
}

export function BenefitStackView({ stack, onUpdateProfile }: BenefitStackViewProps) {
  return (
    <div className="space-y-8">
      {/* Summary Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-blue-200" />
              <p className="text-sm font-medium text-blue-200 uppercase tracking-wide">Your Benefit Stack</p>
            </div>
            {stack.totalEstimatedMonthlyValue > 0 ? (
              <>
                <p className="text-3xl font-bold mt-1">
                  ${Math.round(stack.totalEstimatedMonthlyValue).toLocaleString()}<span className="text-blue-200 text-xl font-normal">/month</span>
                </p>
                <p className="text-blue-200 text-sm mt-1">
                  ~${Math.round(stack.totalEstimatedAnnualValue).toLocaleString()}/year in benefits your household likely qualifies for
                </p>
              </>
            ) : (
              <p className="text-xl font-semibold mt-1">Benefits analysis complete</p>
            )}
          </div>
          <div className="text-right text-sm text-blue-200 shrink-0">
            <p>Household of {stack.householdSize}</p>
            <p>{stack.fplPercent}% FPL</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {stack.likelyPrograms.length > 0 && (
            <span className="bg-white/15 rounded-full px-3 py-1">
              ✓ {stack.likelyPrograms.length} programs you likely qualify for
            </span>
          )}
          {stack.possiblePrograms.length > 0 && (
            <span className="bg-white/15 rounded-full px-3 py-1">
              ~ {stack.possiblePrograms.length} programs to explore
            </span>
          )}
        </div>

        <p className="mt-4 text-xs text-blue-300">{stack.summary}</p>
      </div>

      {/* Quick Wins */}
      {stack.quickWins.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Start Here — Quick Wins</h2>
          <p className="text-sm text-gray-500 mb-4">Highest-value programs you likely qualify for, with straightforward applications.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stack.quickWins.map((result) => (
              <BenefitProgramCard key={result.programId} result={result} isQuickWin />
            ))}
          </div>
        </section>
      )}

      {/* Application Bundles */}
      {stack.bundles.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Apply Together &amp; Save Time</h2>
          <p className="text-sm text-gray-500 mb-4">These programs share a single application — one form, multiple benefits.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {stack.bundles.map((bundle) => (
              <Card key={bundle.bundleId} className="border-2 border-dashed border-blue-200 bg-blue-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{bundle.bundleName}</CardTitle>
                  <p className="text-sm text-gray-600">{bundle.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {bundle.programIds.map((id) => {
                      const program = stack.results.find((r) => r.programId === id)
                      return (
                        <span key={id} className="inline-flex items-center rounded-full bg-white border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                          {program?.programShortName ?? id}
                        </span>
                      )
                    })}
                  </div>
                  {bundle.totalEstimatedMonthlyValue > 0 && (
                    <p className="text-sm font-semibold text-gray-800">
                      Total: ~${bundle.totalEstimatedMonthlyValue.toLocaleString()}/month
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {bundle.applicationUrl && (
                      <Button size="sm" asChild>
                        {bundle.applicationUrl.startsWith("http") ? (
                          <a href={bundle.applicationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                            {bundle.sharedApplicationName} <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <a href={bundle.applicationUrl} className="inline-flex items-center gap-1.5">
                            {bundle.sharedApplicationName}
                          </a>
                        )}
                      </Button>
                    )}
                    {bundle.applicationPhone && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`tel:${bundle.applicationPhone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {bundle.applicationPhone}
                        </a>
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Estimated time: {bundle.estimatedTime}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* All Programs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">All Programs — Ranked by Priority</h2>
            <p className="text-sm text-gray-500">{stack.results.length} programs evaluated</p>
          </div>
        </div>

        {stack.likelyPrograms.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-medium text-gray-700">Likely Eligible ({stack.likelyPrograms.length})</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {stack.likelyPrograms.map((result) => (
                <BenefitProgramCard key={result.programId} result={result} />
              ))}
            </div>
          </div>
        )}

        {stack.possiblePrograms.length > 0 && (
          <div>
            <Separator className="mb-6" />
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              <h3 className="text-sm font-medium text-gray-700">May Qualify — Worth Exploring ({stack.possiblePrograms.length})</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {stack.possiblePrograms.map((result) => (
                <BenefitProgramCard key={result.programId} result={result} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Disclaimer */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <strong className="text-gray-600">Important:</strong> These results are estimates based on your responses and are not a guarantee of eligibility.
          Official eligibility is determined by each program at the time of application. Benefit amounts are approximations
          based on 2026 federal and state program guidelines. Income limits, asset rules, and benefit amounts may vary.
          Contact the administering agency for a definitive determination.
        </p>
      </div>

      {/* Update profile */}
      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={onUpdateProfile} className="text-gray-500">
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Update my information
        </Button>
      </div>
    </div>
  )
}
