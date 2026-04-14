/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAutoScroll } from "@/hooks/use-auto-scroll"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Heart,
  RotateCcw,
  Send,
} from "lucide-react"
import {
  runEligibilityCheck,
  type ScreenerData,
  type EligibilityReport,
} from "@/lib/eligibility-engine"
import type { ChatMessage } from "./page.types"
import { getStepMap, PROGRESS_STEPS } from "./page.constants"
import { uid, getProgress } from "./page.utils"
import { BotAvatar, ChatBubble, ResultsPanel } from "@/components/prescreener/EligibilityResults"
import {
  formatPrescreenerCurrency,
  getPrescreenerCopy,
  getPrescreenerLocale,
} from "./prescreener-copy"
import { useAppSelector } from "@/lib/redux/hooks"
import { localizeEligibilityReport } from "./prescreener-results"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"

export default function PreScreenerPage() {
  const language = useAppSelector((state) => state.app.language)
  const copy = useMemo(() => getPrescreenerCopy(language), [language])
  const stepMap = useMemo(() => getStepMap(language), [language])
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: uid(), role: "bot", text: stepMap.intro.botMessage, timestamp: new Date() },
  ])
  const [currentStepId, setCurrentStepId] = useState("intro")
  const [screenerData, setScreenerData] = useState<Partial<ScreenerData>>({
    livesInMA: true,
    isPregnant: false,
    hasDisability: false,
    hasMedicare: false,
    hasEmployerInsurance: false,
  })
  const [numberInput, setNumberInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [report, setReport] = useState<EligibilityReport | null>(null)
  const [isComplete, setIsComplete] = useState(false)

  const messagesEndRef = useAutoScroll([messages, isTyping, report])
  const inputRef = useRef<HTMLInputElement>(null)

  // Track previous language to reset the intro message when the user switches languages.
  // Using React's render-time state update pattern (no effect needed).
  const [prevLanguage, setPrevLanguage] = useState(language)
  if (prevLanguage !== language) {
    const hasOnlyIntroMessage =
      messages.length === 1 &&
      messages[0]?.role === "bot" &&
      currentStepId === "intro" &&
      !isComplete
    if (hasOnlyIntroMessage) {
      setMessages([{ id: uid(), role: "bot", text: stepMap.intro.botMessage, timestamp: new Date() }])
    }
    setPrevLanguage(language)
  }

  const currentStep = stepMap[currentStepId]
  const localizedReport = useMemo(
    () => (report ? localizeEligibilityReport(report, screenerData, language) : null),
    [language, report, screenerData],
  )

  useEffect(() => {
    document.documentElement.lang = getPrescreenerLocale(language)
  }, [language])

  function addBotMessage(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "bot", text, timestamp: new Date() },
    ])
  }

  function addUserMessage(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", text, timestamp: new Date() },
    ])
  }

  function buildFullData(partial: Partial<ScreenerData>): ScreenerData {
    return {
      livesInMA: partial.livesInMA ?? true,
      age: partial.age ?? 30,
      isPregnant: partial.isPregnant ?? false,
      hasDisability: partial.hasDisability ?? false,
      hasMedicare: partial.hasMedicare ?? false,
      householdSize: partial.householdSize ?? 1,
      annualIncome: partial.annualIncome ?? 0,
      citizenshipStatus: partial.citizenshipStatus ?? "citizen",
      hasEmployerInsurance: partial.hasEmployerInsurance ?? false,
    }
  }

  function advanceToStep(nextId: string, updatedData: Partial<ScreenerData>) {
    if (nextId === "done") {
      setIsTyping(true)
      setTimeout(() => {
        setIsTyping(false)
        const fullData = buildFullData(updatedData)
        const result = runEligibilityCheck(fullData)
        setReport(result)
        setIsComplete(true)
        setCurrentStepId("done")
        addBotMessage(copy.resultsReady)
      }, 1200)
      return
    }

    const nextStep = stepMap[nextId]
    if (!nextStep) return

    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setCurrentStepId(nextId)
      if (nextStep.inputType !== "done") {
        addBotMessage(nextStep.botMessage)
      }
    }, 700)
  }

  function handleQuickReply(reply: { label: string; value: string | number | boolean; emoji?: string }) {
    const step = currentStep
    if (!step) return

    const updatedData = step.dataKey
      ? { ...screenerData, [step.dataKey]: reply.value }
      : { ...screenerData }
    setScreenerData(updatedData)

    addUserMessage(`${reply.emoji ?? ""} ${reply.label}`.trim())

    const nextId =
      typeof step.next === "function"
        ? step.next(reply.value, updatedData)
        : step.next

    advanceToStep(nextId, updatedData)
  }

  function handleNumberSubmit() {
    const step = currentStep
    if (!step) return

    const raw = numberInput.replace(/[^0-9.]/g, "")
    const val = parseFloat(raw)
    if (isNaN(val) || (step.min !== undefined && val < step.min)) return

    const updatedData = step.dataKey
      ? { ...screenerData, [step.dataKey]: Math.round(val) }
      : { ...screenerData }
    setScreenerData(updatedData)

    const displayVal =
      step.inputType === "currency"
        ? copy.incomeReply(formatPrescreenerCurrency(Math.round(val), language))
        : step.dataKey === "householdSize"
        ? copy.householdReply(Math.round(val))
        : String(Math.round(val))

    addUserMessage(displayVal.trim())
    setNumberInput("")

    const nextId =
      typeof step.next === "function"
        ? step.next(Math.round(val), updatedData)
        : step.next

    advanceToStep(nextId, updatedData)
  }

  function handleReset() {
    setMessages([])
    setCurrentStepId("intro")
    setScreenerData({
      livesInMA: true,
      isPregnant: false,
      hasDisability: false,
      hasMedicare: false,
      hasEmployerInsurance: false,
    })
    setNumberInput("")
    setReport(null)
    setIsComplete(false)
    setIsTyping(false)
    setTimeout(() => addBotMessage(stepMap.intro.botMessage), 100)
  }

  const progress = getProgress(currentStepId)
  const totalSteps = PROGRESS_STEPS.length

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm hidden sm:inline">{copy.back}</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">
              {copy.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="h-9 w-[132px] border-border bg-card text-foreground" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-1 text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">{copy.restart}</span>
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {!isComplete && (
          <div className="px-4 pb-3">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>
                  {progress < 100
                    ? copy.stepLabel(Math.max(1, Math.ceil((progress / 100) * totalSteps)), totalSteps)
                    : copy.calculating}
                </span>
                <span>{copy.percentComplete(progress)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Disclaimer */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
        <p className="mx-auto max-w-3xl text-xs text-amber-800 text-center">
          <strong>{copy.estimateOnlyLead}</strong> {copy.estimateOnlyBody}
        </p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-end gap-3">
              <BotAvatar />
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-secondary px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </div>
          )}

          {/* Results */}
          {isComplete && localizedReport && (
            <ResultsPanel
              report={localizedReport}
              screenerData={screenerData}
              onReset={handleReset}
              language={language}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      {!isComplete && !isTyping && currentStep && currentStep.inputType !== "done" && (
        <div className="border-t border-border bg-card px-4 py-4">
          <div className="mx-auto max-w-3xl">
            {currentStep.inputType === "quickreply" && (
              <div className="flex flex-wrap gap-2">
                {currentStep.quickReplies?.map((reply) => (
                  <button
                    key={String(reply.value) + reply.label}
                    onClick={() => handleQuickReply(reply)}
                    className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:bg-primary/5 hover:text-primary active:scale-95"
                  >
                    {reply.emoji && <span>{reply.emoji}</span>}
                    {reply.label}
                  </button>
                ))}
              </div>
            )}

            {(currentStep.inputType === "number" ||
              currentStep.inputType === "currency") && (
              <div className="space-y-2">
                {currentStep.hint && (
                  <p className="text-xs text-muted-foreground">{currentStep.hint}</p>
                )}
                <div className="flex gap-2">
                  {currentStep.inputType === "currency" && (
                    <div className="flex h-10 items-center rounded-l-lg border border-r-0 border-input bg-secondary px-3 text-sm text-muted-foreground">
                      $
                    </div>
                  )}
                  <Input
                    ref={inputRef}
                    type="number"
                    placeholder={currentStep.placeholder}
                    value={numberInput}
                    onChange={(e) => setNumberInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNumberSubmit()}
                    min={currentStep.min}
                    max={currentStep.max}
                    className={`flex-1 ${currentStep.inputType === "currency" ? "rounded-l-none" : ""}`}
                    autoFocus
                  />
                  <Button
                    onClick={handleNumberSubmit}
                    disabled={!numberInput.trim()}
                    size="icon"
                    className="shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
