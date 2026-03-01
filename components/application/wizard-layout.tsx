"use client"

import Link from "next/link"
import { Heart, ArrowLeft, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  id: string
  title: string
  completed: boolean
  current: boolean
}

interface WizardLayoutProps {
  children: React.ReactNode
  steps: Step[]
  currentStep: number
  title: string
}

export function WizardLayout({ children, steps, currentStep, title }: WizardLayoutProps) {
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
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">MassHealth</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Step {currentStep} of {steps.length}
          </div>
        </div>
      </header>

      {/* Progress Steps - Desktop */}
      <div className="hidden border-b border-border bg-card px-4 py-4 lg:block">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                      step.completed
                        ? "bg-accent text-accent-foreground"
                        : step.current
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      step.current ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "mx-4 h-0.5 w-12 rounded-full",
                      step.completed ? "bg-accent" : "bg-border"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Bar - Mobile */}
      <div className="border-b border-border bg-card px-4 py-3 lg:hidden">
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
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>
    </div>
  )
}
