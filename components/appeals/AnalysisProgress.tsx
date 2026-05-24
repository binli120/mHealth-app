/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useEffect, useState } from "react"
import { Loader2, FileSearch, BookOpen, PenLine, ShieldCheck, Sparkles } from "lucide-react"
import { getAppealAssistantCopy } from "@/lib/appeals/copy"
import type { SupportedLanguage } from "@/lib/i18n/languages"

// ── Stage metadata (timings + icons — language-independent) ───────────────────
//
// Timings are calibrated to match the server-side work:
//   ~2 s  — auth + request parsing
//   ~6 s  — RAG retrieval
//  ~20 s  — Ollama generateText (longest step)
//   ~8 s  — quality-gate reflection pass
// Total expected: 30–40 s (varies with model size and hardware).
// The last stage holds at 99 % until the response arrives.

const STAGE_META = [
  { icon: FileSearch,   target: 14,  ms: 2_000   },
  { icon: BookOpen,     target: 46,  ms: 6_000   },
  { icon: PenLine,      target: 82,  ms: 20_000  },
  { icon: ShieldCheck,  target: 96,  ms: 8_000   },
  { icon: Sparkles,     target: 99,  ms: 999_999 }, // holds until the API responds
] as const

// Number of smooth progress increments within each timed stage
const STEPS_PER_STAGE = 20

// ── Component ─────────────────────────────────────────────────────────────────

interface AnalysisProgressProps {
  language?: SupportedLanguage
}

export function AnalysisProgress({ language = "en" }: AnalysisProgressProps) {
  const copy = getAppealAssistantCopy(language)

  const [progress, setProgress] = useState(0)
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let elapsed = 0

    // Tiny head-start so the bar isn't stuck at 0 % on the first frame
    timers.push(setTimeout(() => setProgress(2), 80))

    for (let i = 0; i < STAGE_META.length; i++) {
      const stageStart = elapsed
      const meta = STAGE_META[i]
      const prevTarget = i === 0 ? 0 : STAGE_META[i - 1].target

      // Switch label when this stage begins
      const capturedI = i
      timers.push(setTimeout(() => setStageIndex(capturedI), stageStart))

      // Smooth increments — skip the infinite hold stage
      if (meta.ms < 100_000) {
        for (let step = 1; step <= STEPS_PER_STAGE; step++) {
          const stepValue = prevTarget + (meta.target - prevTarget) * (step / STEPS_PER_STAGE)
          const stepDelay = stageStart + meta.ms * (step / STEPS_PER_STAGE)
          timers.push(setTimeout(() => setProgress(stepValue), stepDelay))
        }
      }

      elapsed += meta.ms
    }

    return () => timers.forEach(clearTimeout)
  }, [])

  const meta = STAGE_META[stageIndex]
  const stage = copy.analysisStages[stageIndex]
  const StageIcon = meta.icon
  const displayPct = Math.min(99, Math.round(progress))

  return (
    <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 px-6 py-8 space-y-6">
      {/* Icon + label */}
      <div className="flex flex-col items-center gap-3 text-center">
        {/* Pulsing ring + stage icon + spinner overlay */}
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-blue-200 animate-ping opacity-40" />
          <div className="relative h-14 w-14 rounded-full bg-white border border-blue-200 shadow-sm flex items-center justify-center">
            <StageIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
          </div>
          <Loader2
            className="absolute -right-1.5 -top-1.5 h-5 w-5 animate-spin text-blue-500"
            aria-hidden="true"
          />
        </div>

        <div>
          <p className="text-sm font-semibold text-blue-900">{stage.label}</p>
          <p className="mt-0.5 text-xs text-blue-600/70">{stage.description}</p>
        </div>
      </div>

      {/* Progress bar + percentage */}
      <div
        role="progressbar"
        aria-valuenow={displayPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${displayPct}%`}
        className="space-y-1.5"
      >
        <div className="h-2.5 w-full rounded-full bg-blue-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-right text-xs font-medium text-blue-500">{displayPct}%</p>
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-center gap-2" aria-hidden="true">
        {STAGE_META.slice(0, -1).map((_, i) => {
          const done   = i < stageIndex
          const active = i === stageIndex
          return (
            <div key={i} className="flex items-center gap-2">
              <div
                className={[
                  "h-2 w-2 rounded-full transition-colors duration-300",
                  done   ? "bg-blue-500"
                         : active ? "bg-blue-400 animate-pulse"
                                  : "bg-blue-200",
                ].join(" ")}
              />
              {i < STAGE_META.length - 2 && (
                <div className={`h-px w-6 transition-colors duration-300 ${done ? "bg-blue-400" : "bg-blue-200"}`} />
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-blue-400/80">{copy.analysisEta}</p>
    </div>
  )
}
