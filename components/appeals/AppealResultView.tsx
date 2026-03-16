"use client"

import { AlertCircle, CheckCircle2, ClipboardCheck, Copy, FileText, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AppealAnalysis } from "@/lib/appeals/types"
import { useClipboard } from "@/hooks/use-clipboard"

interface AppealResultViewProps {
  analysis: AppealAnalysis
  denialReasonLabel: string
  onReset: () => void
}

export function AppealResultView({ analysis, denialReasonLabel, onReset }: AppealResultViewProps) {
  const { copied, copy } = useClipboard()

  return (
    <div className="space-y-6">
      {/* Success banner */}
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-medium text-emerald-800">Appeal analysis complete</p>
          <p className="text-xs text-emerald-600">Denial reason: {denialReasonLabel}</p>
        </div>
      </div>

      {/* Section 1 — Explanation */}
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            What This Means
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-gray-700">{analysis.explanation}</p>
        </CardContent>
      </Card>

      {/* Section 2 — Appeal Letter */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-blue-500" />
              Your Appeal Letter
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copy(analysis.appealLetter)}
              className="h-8 gap-1.5 text-xs"
            >
              {copied ? (
                <>
                  <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Letter
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analysis.appealLetter ? (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-4 font-mono text-sm text-gray-800">
              {analysis.appealLetter}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Appeal letter could not be generated. Please try again.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 3 — Evidence Checklist */}
      {analysis.evidenceChecklist.length > 0 && (
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Evidence to Gather
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {analysis.evidenceChecklist.map((item, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
                    aria-label={item}
                  />
                  <span className="text-sm text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="space-y-3">
        <Button variant="outline" className="w-full gap-2" onClick={onReset}>
          <RefreshCw className="h-4 w-4" />
          Start Over
        </Button>
        <p className="text-center text-xs text-gray-400">
          This analysis is AI-generated and is not legal advice. For complex cases, consider
          consulting a benefits attorney or legal aid organization.
        </p>
      </div>
    </div>
  )
}
