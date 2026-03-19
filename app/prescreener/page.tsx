/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useState, useRef } from "react"
import { useAutoScroll } from "@/hooks/use-auto-scroll"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Heart,
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  RotateCcw,
  ExternalLink,
  Info,
} from "lucide-react"
import {
  runEligibilityCheck,
  type ScreenerData,
  type EligibilityReport,
  type EligibilityColor,
  FPL_TABLE_2026,
} from "@/lib/eligibility-engine"

// ─── Types ────────────────────────────────────────────────────────────────

type MessageRole = "bot" | "user"

interface ChatMessage {
  id: string
  role: MessageRole
  text: string
  timestamp: Date
}

interface QuickReply {
  label: string
  value: string | number | boolean
  emoji?: string
}

interface Step {
  id: string
  botMessage: string
  inputType: "quickreply" | "number" | "currency" | "done"
  quickReplies?: QuickReply[]
  placeholder?: string
  hint?: string
  min?: number
  max?: number
  dataKey: keyof ScreenerData | null
  // Returns the next step ID. Can be a function for branching logic.
  next: string | ((value: string | number | boolean, data: Partial<ScreenerData>) => string)
}

// ─── Conversation Flow ───────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: "intro",
    botMessage:
      "Hi! I'm the MassHealth Eligibility Assistant. I can estimate which health coverage programs you may qualify for in under 5 minutes.\n\nLet's get started — where do you currently live?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Massachusetts", value: true, emoji: "🏠" },
      { label: "Another state", value: false, emoji: "📍" },
    ],
    dataKey: "livesInMA",
    next: (val) => (val === true ? "age" : "not_ma"),
  },
  {
    id: "not_ma",
    botMessage:
      "MassHealth is only available to Massachusetts residents. You may have coverage options in your state — visit healthcare.gov to explore.\n\nAre you planning to move to Massachusetts?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Yes, I'm moving to MA", value: true, emoji: "📦" },
      { label: "No", value: false, emoji: "✗" },
    ],
    dataKey: null,
    next: (val) => (val === true ? "age" : "done"),
  },
  {
    id: "age",
    botMessage: "How old are you?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Under 1 year", value: 0, emoji: "👶" },
      { label: "1–18 years", value: 10, emoji: "🧒" },
      { label: "19–26 years", value: 22, emoji: "🎓" },
      { label: "27–64 years", value: 40, emoji: "👤" },
      { label: "65 or older", value: 70, emoji: "🧓" },
    ],
    dataKey: "age",
    next: (val) => {
      if ((val as number) < 1) return "household_size"
      if ((val as number) <= 18) return "household_size"
      if ((val as number) >= 65) return "household_size"
      return "pregnancy_check"
    },
  },
  {
    id: "pregnancy_check",
    botMessage: "Are you currently pregnant?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Yes", value: true, emoji: "🤰" },
      { label: "No", value: false, emoji: "✗" },
    ],
    dataKey: "isPregnant",
    next: "household_size",
  },
  {
    id: "household_size",
    botMessage:
      "How many people are in your household? (Include yourself, your spouse/partner, and any children or other dependents you claim on taxes.)",
    inputType: "number",
    placeholder: "e.g. 1, 2, 3...",
    hint: "Count everyone who lives with you and you'd include on a tax return.",
    min: 1,
    max: 20,
    dataKey: "householdSize",
    next: "income",
  },
  {
    id: "income",
    botMessage:
      "What is your household's estimated annual income before taxes? (Include wages, Social Security, disability, unemployment, and any other regular income.)",
    inputType: "currency",
    placeholder: "e.g. 25000",
    hint: "Round to the nearest dollar. Enter 0 if no income.",
    min: 0,
    dataKey: "annualIncome",
    next: "citizenship",
  },
  {
    id: "citizenship",
    botMessage: "What is your citizenship or immigration status?",
    inputType: "quickreply",
    quickReplies: [
      { label: "U.S. Citizen", value: "citizen", emoji: "🇺🇸" },
      { label: "Lawful Permanent Resident (Green Card)", value: "qualified_immigrant", emoji: "🟩" },
      { label: "Other qualified immigrant", value: "qualified_immigrant", emoji: "📄" },
      { label: "Undocumented / No status", value: "undocumented", emoji: "🔒" },
    ],
    dataKey: "citizenshipStatus",
    next: (_, data) => {
      if (data.citizenshipStatus === "undocumented") return "done"
      if ((data.age ?? 0) >= 60 || (data.hasDisability ?? false)) return "disability"
      return "disability"
    },
  },
  {
    id: "disability",
    botMessage:
      "Do you have a disability, or do you receive SSI (Supplemental Security Income) or SSDI (Social Security Disability Insurance)?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Yes — SSI/SSDI or documented disability", value: true, emoji: "♿" },
      { label: "No", value: false, emoji: "✗" },
    ],
    dataKey: "hasDisability",
    next: (val, data) => {
      const age = data.age ?? 0
      if (age >= 65 || val === true) return "medicare"
      return "employer_insurance"
    },
  },
  {
    id: "medicare",
    botMessage: "Are you currently enrolled in Medicare (Part A or Part B)?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Yes, I have Medicare", value: true, emoji: "🏥" },
      { label: "No", value: false, emoji: "✗" },
      { label: "Not sure", value: false, emoji: "❓" },
    ],
    dataKey: "hasMedicare",
    next: "employer_insurance",
  },
  {
    id: "employer_insurance",
    botMessage:
      "Does your employer (or your spouse's employer) currently offer health insurance that you could enroll in?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Yes", value: true, emoji: "🏢" },
      { label: "No / Not applicable", value: false, emoji: "✗" },
    ],
    dataKey: "hasEmployerInsurance",
    next: "done",
  },
  {
    id: "done",
    botMessage: "Thanks — let me check your eligibility now...",
    inputType: "done",
    dataKey: null,
    next: "done",
  },
]

const STEP_MAP: Record<string, Step> = Object.fromEntries(STEPS.map((s) => [s.id, s]))

// ─── Helpers ─────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function colorConfig(color: EligibilityColor) {
  switch (color) {
    case "green":
      return {
        bg: "bg-emerald-50 border-emerald-200",
        badge: "bg-emerald-100 text-emerald-800",
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />,
        label: "Likely Eligible",
      }
    case "yellow":
      return {
        bg: "bg-amber-50 border-amber-200",
        badge: "bg-amber-100 text-amber-800",
        icon: <HelpCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />,
        label: "Possibly Eligible",
      }
    case "red":
      return {
        bg: "bg-red-50 border-red-200",
        badge: "bg-red-100 text-red-800",
        icon: <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />,
        label: "Not Eligible",
      }
    case "blue":
      return {
        bg: "bg-blue-50 border-blue-200",
        badge: "bg-blue-100 text-blue-800",
        icon: <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />,
        label: "Option Available",
      }
    default:
      return {
        bg: "bg-secondary border-border",
        badge: "bg-muted text-muted-foreground",
        icon: <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />,
        label: "See Details",
      }
  }
}

// ─── Progress indicator ───────────────────────────────────────────────────

const PROGRESS_STEPS = ["intro", "age", "household_size", "income", "citizenship", "disability", "employer_insurance", "done"]

function getProgress(stepId: string) {
  const idx = PROGRESS_STEPS.indexOf(stepId)
  if (idx < 0) return 0
  return Math.round((idx / (PROGRESS_STEPS.length - 1)) * 100)
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function PreScreenerPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: uid(), role: "bot", text: STEP_MAP["intro"].botMessage, timestamp: new Date() },
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

  const currentStep = STEP_MAP[currentStepId]

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
        addBotMessage("Here are your pre-screening results:")
      }, 1200)
      return
    }

    const nextStep = STEP_MAP[nextId]
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

  function handleQuickReply(reply: QuickReply) {
    const step = currentStep
    if (!step) return

    // Update data
    const updatedData = step.dataKey
      ? { ...screenerData, [step.dataKey]: reply.value }
      : { ...screenerData }
    setScreenerData(updatedData)

    // Show user's answer
    addUserMessage(`${reply.emoji ?? ""} ${reply.label}`.trim())

    // Determine next step
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
        ? `$${Math.round(val).toLocaleString()} / year`
        : `${Math.round(val)} ${step.dataKey === "householdSize" ? "people" : ""}`

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
    setTimeout(() => addBotMessage(STEP_MAP["intro"].botMessage), 100)
  }

  const progress = getProgress(currentStepId)

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
            <span className="text-sm hidden sm:inline">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">
              Eligibility Pre-Screener
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-1 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Restart</span>
          </Button>
        </div>

        {/* Progress bar */}
        {!isComplete && (
          <div className="px-4 pb-3">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>
                  {progress < 100
                    ? `Step ${Math.max(1, Math.ceil((progress / 100) * 8))} of 8`
                    : "Calculating..."}
                </span>
                <span>{progress}% complete</span>
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
          <strong>Pre-screening estimate only.</strong> This is not an official eligibility
          determination. Based on 2026 FPL guidelines & MassHealth regulations.
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
          {isComplete && report && (
            <ResultsPanel report={report} screenerData={screenerData} onReset={handleReset} />
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

// ─── Sub-components ────────────────────────────────────────────────────────

function BotAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
      <Heart className="h-4 w-4 text-primary-foreground" />
    </div>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
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

function ResultsPanel({
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

function FPLReferenceTable({
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
