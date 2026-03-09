"use client"

import Link from "next/link"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ShieldHeartIcon } from "@/lib/icons"

interface Step {
  id: string
  title: string
  shortTitle?: string
  completed: boolean
  current: boolean
}

interface WizardLayoutProps {
  children: React.ReactNode
  steps: Step[]
  currentStep: number
  title: string
  contentClassName?: string
}

export function WizardLayout({
  children,
  steps,
  currentStep,
  title,
  contentClassName,
}: WizardLayoutProps) {
  const activeStep = steps[currentStep - 1] ?? steps.find((step) => step.current)
  const getConnectorClass = (step: Step | undefined) => {
    if (!step) {
      return "bg-border"
    }

    if (step.completed) {
      return "bg-accent"
    }

    if (step.current) {
      return "bg-primary/60"
    }

    return "bg-border"
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/application/type" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm hidden sm:inline">Save & Exit</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">MassHealth</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Step {currentStep} of {steps.length}
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="border-b border-border bg-card px-3 py-3 sm:px-4 sm:py-4">
        <div className="mx-auto w-full max-w-7xl">
          <div className="sm:hidden">
            {activeStep ? (
              <div className="flex flex-col items-center gap-1 text-center">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    activeStep.completed
                      ? "bg-accent text-accent-foreground"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {activeStep.completed ? <CheckCircle2 className="h-5 w-5" /> : currentStep}
                </div>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {activeStep.shortTitle ?? activeStep.title}
                </span>
              </div>
            ) : null}
          </div>

          <div className="hidden sm:flex sm:items-start sm:gap-1">
            {steps.map((step, index) => (
              <div key={step.id} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
                <div className="flex w-full items-center">
                  <div
                    className={cn(
                      "h-0.5 flex-1",
                      index === 0 ? "bg-transparent" : getConnectorClass(steps[index - 1]),
                    )}
                  />
                  <div
                    className={cn(
                      "mx-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                      step.completed
                        ? "bg-accent text-accent-foreground"
                        : step.current
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {step.completed ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                  </div>
                  <div
                    className={cn(
                      "h-0.5 flex-1",
                      index === steps.length - 1 ? "bg-transparent" : getConnectorClass(step),
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "max-w-full truncate px-1 text-[10px] font-medium uppercase tracking-wide",
                    step.current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.shortTitle ?? step.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{title}</span>
          <span className="text-muted-foreground">{Math.round((currentStep / steps.length) * 100)}% complete</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8">
        <div className={cn("mx-auto w-full max-w-2xl", contentClassName)}>{children}</div>
      </main>
    </div>
  )
}
