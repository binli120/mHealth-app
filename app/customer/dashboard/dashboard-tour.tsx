/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight, X } from "lucide-react"

const DASHBOARD_TOUR_STORAGE_KEY = "healthcompass.dashboardTour.v1.completed"

interface DashboardTourStep {
  selector: string
  title: string
  body: string
  placement: "top" | "right" | "bottom" | "left"
}

const TOUR_STEPS: DashboardTourStep[] = [
  {
    selector: "[data-tour='dashboard-help']",
    title: "Open this guide anytime",
    body: "Use Help whenever you want a quick walkthrough of the dashboard controls.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='dashboard-account-tools']",
    title: "Manage dashboard preferences",
    body: "Change language, switch theme, check notifications, open your profile, or sign out from the top-right controls.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='dashboard-new-application']",
    title: "Start a MassHealth application",
    body: "Begin a new application here. The app will route you to the right form and save progress as you work.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='dashboard-benefit-stack']",
    title: "Check other benefit programs",
    body: "Run the benefit stack to screen for health coverage, food, housing, cash assistance, and other Massachusetts programs.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='dashboard-appeals']",
    title: "Get appeal support",
    body: "Use the appeal tools when coverage is denied, reduced, or delayed. They help organize facts and draft next steps.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='dashboard-appeal-letter']",
    title: "Draft an appeal letter",
    body: "Open Appeal Letter when you need a written MassHealth appeal grounded in the denial reason and supporting documents.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='dashboard-upload-documents']",
    title: "Upload requested documents",
    body: "When MassHealth asks for proof, use this area to add documents and keep your application moving.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='dashboard-track-status']",
    title: "Track application status",
    body: "Review submitted applications, drafts, deadlines, and any notices that need your attention.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='dashboard-knowledge-center']",
    title: "Learn before you apply",
    body: "Use the knowledge center for guides, videos, and official resources about MassHealth and related benefits.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='dashboard-applications']",
    title: "Review your applications",
    body: "Recent applications appear here. Open a draft to continue, or open a submitted application to see status and history.",
    placement: "right",
  },
  {
    selector: "[data-tour='dashboard-action-required']",
    title: "Watch for action required",
    body: "This panel flags requests for information so you can respond before a deadline is missed.",
    placement: "left",
  },
  {
    selector: "[data-tour='dashboard-activity']",
    title: "Check latest activity",
    body: "This summary shows recent application events so you can quickly see what changed since your last visit.",
    placement: "left",
  },
  {
    selector: "[data-tour='dashboard-social-worker']",
    title: "Share access with a social worker",
    body: "Add an approved social worker or case manager so they can help with applications and chat with you.",
    placement: "left",
  },
  {
    selector: "[data-tour='dashboard-support']",
    title: "Get direct MassHealth help",
    body: "Use this panel for official support phone numbers and TTY information.",
    placement: "left",
  },
]

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

interface DashboardTourProps {
  runId: number
}

function readTourCompleted(): boolean {
  try {
    return window.localStorage.getItem(DASHBOARD_TOUR_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

function writeTourCompleted() {
  try {
    window.localStorage.setItem(DASHBOARD_TOUR_STORAGE_KEY, "true")
  } catch {
    // Non-fatal: the tour can still run for this session.
  }
}

function getVisibleElement(selector: string): HTMLElement | null {
  if (typeof document === "undefined") return null

  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return elements.find((element) => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }) ?? null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getPopoverPosition(rect: Rect, placement: DashboardTourStep["placement"]) {
  const margin = 16
  const width = Math.min(360, window.innerWidth - margin * 2)
  const height = 230

  const centeredLeft = rect.left + rect.width / 2 - width / 2
  const centeredTop = rect.top + rect.height / 2 - height / 2

  if (placement === "top") {
    return {
      top: clamp(rect.top - height - 14, margin, window.innerHeight - height - margin),
      left: clamp(centeredLeft, margin, window.innerWidth - width - margin),
      width,
    }
  }

  if (placement === "right") {
    return {
      top: clamp(centeredTop, margin, window.innerHeight - height - margin),
      left: clamp(rect.left + rect.width + 14, margin, window.innerWidth - width - margin),
      width,
    }
  }

  if (placement === "left") {
    return {
      top: clamp(centeredTop, margin, window.innerHeight - height - margin),
      left: clamp(rect.left - width - 14, margin, window.innerWidth - width - margin),
      width,
    }
  }

  return {
    top: clamp(rect.top + rect.height + 14, margin, window.innerHeight - height - margin),
    left: clamp(centeredLeft, margin, window.innerWidth - width - margin),
    width,
  }
}

export function DashboardTour({ runId }: DashboardTourProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)

  const visibleSteps = TOUR_STEPS.filter((step) => getVisibleElement(step.selector))
  const safeActiveIndex = clamp(activeIndex, 0, Math.max(visibleSteps.length - 1, 0))
  const activeStep = visibleSteps[safeActiveIndex]

  const closeTour = useCallback((markComplete: boolean) => {
    if (markComplete) writeTourCompleted()
    setIsOpen(false)
    setActiveIndex(0)
    setTargetRect(null)
  }, [])

  const updateTarget = useCallback((shouldScroll = false) => {
    if (!isOpen || !activeStep) return

    const target = getVisibleElement(activeStep.selector)
    if (!target) {
      setTargetRect(null)
      return
    }

    if (shouldScroll) {
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
    }

    window.setTimeout(() => {
      const rect = target.getBoundingClientRect()
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    }, 220)
  }, [activeStep, isOpen])

  useEffect(() => {
    if (runId <= 0) return
    const timer = window.setTimeout(() => {
      setIsOpen(true)
      setActiveIndex(0)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [runId])

  useEffect(() => {
    if (readTourCompleted()) return

    const timer = window.setTimeout(() => {
      setIsOpen(true)
      setActiveIndex(0)
    }, 800)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => updateTarget(true), 0)
    return () => window.clearTimeout(timer)
  }, [updateTarget])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTour(true)
    }

    window.addEventListener("keydown", handleKeyDown)
    const handleViewportChange = () => updateTarget(false)

    window.addEventListener("resize", handleViewportChange)
    window.addEventListener("scroll", handleViewportChange, true)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("scroll", handleViewportChange, true)
    }
  }, [closeTour, isOpen, updateTarget])

  if (!isOpen || !activeStep || !targetRect) return null

  const isFirst = safeActiveIndex === 0
  const isLast = safeActiveIndex === visibleSteps.length - 1
  const highlightPadding = 8
  const popoverPosition = getPopoverPosition(targetRect, activeStep.placement)

  return (
    <div aria-live="polite">
      <div className="fixed inset-0 z-[80] bg-background/20 backdrop-blur-[1px]" />
      <div
        className="pointer-events-none fixed z-[90] rounded-xl border-2 border-primary bg-transparent shadow-[0_0_0_9999px_rgba(2,6,23,0.56),0_0_0_6px_rgba(20,184,166,0.25)] transition-all duration-200"
        style={{
          top: targetRect.top - highlightPadding,
          left: targetRect.left - highlightPadding,
          width: targetRect.width + highlightPadding * 2,
          height: targetRect.height + highlightPadding * 2,
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-tour-title"
        className="fixed z-[100] rounded-lg border border-border bg-card p-4 text-card-foreground shadow-2xl"
        style={popoverPosition}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Step {safeActiveIndex + 1} of {visibleSteps.length}
            </p>
            <h2 id="dashboard-tour-title" className="mt-1 text-base font-semibold">
              {activeStep.title}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => closeTour(true)}
            aria-label="Exit dashboard tutorial"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">{activeStep.body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => closeTour(true)}
          >
            Exit
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(isFirst && "invisible")}
              onClick={() => setActiveIndex((index) => Math.max(index - 1, 0))}
              aria-hidden={isFirst}
              tabIndex={isFirst ? -1 : 0}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (isLast) {
                  closeTour(true)
                  return
                }
                setActiveIndex((index) => Math.min(index + 1, visibleSteps.length - 1))
              }}
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
