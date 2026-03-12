"use client"

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, ListChecks, Loader2, MessageCircle, SendHorizontal, ShieldCheck, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isSupportedLanguage, SUPPORTED_LANGUAGES } from "@/lib/i18n/languages"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import {
  getMassHealthGreeting,
  getMassHealthOutOfScopeResponse,
  MASSHEALTH_COMMON_QUESTIONS,
  type ChatMessage,
} from "@/lib/masshealth/chat-knowledge"

type WidgetView = "faq" | "chat" | "advisor"

interface EligibilityProgram {
  program: string
  eligible: boolean
  reason?: string
}

interface ChatApiResponse {
  ok: boolean
  outOfScope?: boolean
  reply?: string
  error?: string
  factsExtracted?: Record<string, unknown>
  eligibilityResults?: {
    programs?: EligibilityProgram[]
    [key: string]: unknown
  }
}

interface WidgetMessage extends ChatMessage {
  id: string
  eligibilityResults?: ChatApiResponse["eligibilityResults"]
}

function createMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function EligibilityResultsBadges({
  results,
}: {
  results: ChatApiResponse["eligibilityResults"]
}) {
  const programs = results?.programs
  if (!programs || programs.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {programs.map((p) => (
        <Badge
          key={p.program}
          variant={p.eligible ? "default" : "secondary"}
          className="text-xs"
        >
          {p.eligible ? "✓" : "✗"} {p.program}
        </Badge>
      ))}
    </div>
  )
}

function MessageBubble({ message }: { message: WidgetMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground",
        ].join(" ")}
      >
        {message.content}
        {!isUser && message.eligibilityResults && (
          <EligibilityResultsBadges results={message.eligibilityResults} />
        )}
      </div>
    </div>
  )
}

const ADVISOR_GREETING =
  "Hi! I'm your MassHealth Benefit Advisor. Tell me about yourself — your age, household size, and approximate income — and I'll check which programs you may qualify for."

export function MassHealthChatWidget() {
  const dispatch = useAppDispatch()
  const selectedLanguage = useAppSelector((state) => state.app.language)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<WidgetView>("faq")

  // Regular chat messages
  const [messages, setMessages] = useState<WidgetMessage[]>([
    { id: createMessageId(), role: "assistant", content: getMassHealthGreeting(selectedLanguage) },
  ])
  // Benefit advisor messages (separate history)
  const [advisorMessages, setAdvisorMessages] = useState<WidgetMessage[]>([
    { id: createMessageId(), role: "assistant", content: ADVISOR_GREETING },
  ])

  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null)

  const faqs = useMemo(() => MASSHEALTH_COMMON_QUESTIONS, [])
  const greeting = useMemo(() => getMassHealthGreeting(selectedLanguage), [selectedLanguage])
  const outOfScopeReply = useMemo(
    () => getMassHealthOutOfScopeResponse(selectedLanguage),
    [selectedLanguage],
  )

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, advisorMessages, isLoading, open, view])

  useEffect(() => {
    setMessages((previous) => {
      if (previous.length !== 1 || previous[0]?.role !== "assistant") return previous
      return [{ id: createMessageId(), role: "assistant", content: greeting }]
    })
  }, [greeting])

  const handleLanguageChange = (value: string) => {
    if (isSupportedLanguage(value)) dispatch(setLanguage(value))
  }

  const isAdvisorView = view === "advisor"

  const sendMessage = async (input: string) => {
    const message = input.trim()
    if (!message || isLoading) return

    if (!isAdvisorView) setView("chat")
    setDraft("")
    setIsLoading(true)

    const currentMessages = isAdvisorView ? advisorMessages : messages
    const setCurrentMessages = isAdvisorView ? setAdvisorMessages : setMessages

    const nextMessages: WidgetMessage[] = [
      ...currentMessages,
      { id: createMessageId(), role: "user", content: message },
    ]
    setCurrentMessages(nextMessages)

    try {
      const response = await authenticatedFetch("/api/chat/masshealth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-12).map(({ role, content }) => ({ role, content })),
          language: selectedLanguage,
          ...(isAdvisorView ? { mode: "benefit_advisor" } : {}),
        }),
      })

      const data = (await response.json()) as ChatApiResponse
      const fallbackReply =
        "I couldn't complete that request. Please try again, or call MassHealth at (800) 841-2900."

      const reply =
        data.reply?.trim() || (data.outOfScope ? outOfScopeReply : fallbackReply)

      setCurrentMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "assistant",
          content: reply,
          eligibilityResults: data.eligibilityResults,
        },
      ])
    } catch (error) {
      console.error("MassHealth chat request failed", error)
      const setMsg = isAdvisorView ? setAdvisorMessages : setMessages
      setMsg((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "assistant",
          content: "I couldn't reach the local AI service. Confirm Ollama is running.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await sendMessage(draft)
  }

  const handleFaqAsk = async (question: string) => {
    await sendMessage(question)
  }

  const handleResetChat = () => {
    setMessages([{ id: createMessageId(), role: "assistant", content: greeting }])
    setAdvisorMessages([{ id: createMessageId(), role: "assistant", content: ADVISOR_GREETING }])
    setDraft("")
    setView("faq")
  }

  const activeMessages = isAdvisorView ? advisorMessages : messages
  const chatPlaceholder = isAdvisorView
    ? "Tell me your age, household size, and income…"
    : "Ask a MassHealth question…"

  return (
    <>
      <Button
        size="icon-lg"
        className="fixed right-5 bottom-5 z-50 h-14 w-14 rounded-full shadow-xl"
        aria-label={open ? "Hide MassHealth assistant" : "Open MassHealth assistant"}
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {open ? (
        <section
          role="dialog"
          aria-label="MassHealth AI Assistant"
          className="fixed right-5 bottom-24 z-40 flex h-[min(80vh,760px)] w-[min(92vw,440px)] flex-col overflow-hidden rounded-lg border bg-background shadow-2xl"
        >
          {/* Header */}
          <header className="border-b px-5 py-4 text-left">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">MassHealth AI Assistant</h2>
              <div className="flex items-center gap-2">
                <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="h-8 w-[150px]">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              {isAdvisorView
                ? "Tell me about your situation and I'll check eligibility using official MassHealth rules."
                : "MassHealth-only support. Ask about eligibility, applications, renewals, and benefits."}
            </p>
          </header>

          {/* Tab bar */}
          <div className="border-b px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={view === "faq" ? "default" : "outline"}
                onClick={() => setView("faq")}
              >
                <ListChecks className="h-4 w-4" />
                Common Questions
              </Button>
              <Button
                size="sm"
                variant={view === "chat" ? "default" : "outline"}
                onClick={() => setView("chat")}
              >
                <MessageCircle className="h-4 w-4" />
                Chat
              </Button>
              <Button
                size="sm"
                variant={view === "advisor" ? "default" : "outline"}
                onClick={() => setView("advisor")}
              >
                <ShieldCheck className="h-4 w-4" />
                Benefit Advisor
              </Button>
              <Button size="sm" variant="ghost" onClick={handleResetChat} className="ml-auto">
                Reset
              </Button>
            </div>
          </div>

          {/* FAQ view */}
          {view === "faq" ? (
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-4">
                <div className="rounded-xl border bg-secondary/40 p-4">
                  <p className="text-sm text-secondary-foreground">{greeting}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Pick a common question below or switch to Chat to type your own.
                  </p>
                </div>
                {faqs.map((faq) => (
                  <article key={faq.id} className="space-y-3 rounded-xl border p-4">
                    <h3 className="text-sm font-semibold text-foreground">{faq.question}</h3>
                    <p className="text-sm text-muted-foreground">{faq.quickAnswer}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => { void handleFaqAsk(faq.question) }}
                        disabled={isLoading}
                      >
                        Chat about this
                      </Button>
                      {faq.links.slice(0, 1).map((link) => (
                        <Button key={link.url} asChild size="sm" variant="outline">
                          <a href={link.url} target="_blank" rel="noreferrer">
                            Official source
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </ScrollArea>

          ) : (
            /* Chat / Advisor shared chat UI */
            <div className="flex min-h-0 flex-1 flex-col">
              {isAdvisorView && (
                <div className="bg-muted/40 border-b px-4 py-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mr-1 inline h-3 w-3" />
                  Eligibility determined by rule engine — LLM explains, never decides.
                </div>
              )}

              <ScrollArea className="min-h-0 flex-1 px-4">
                <div className="space-y-3 py-4">
                  {activeMessages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {isLoading ? (
                    <div className="flex justify-start">
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2 text-sm text-secondary-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isAdvisorView ? "Checking eligibility…" : "Thinking…"}
                      </div>
                    </div>
                  ) : null}
                  <div ref={bottomAnchorRef} />
                </div>
              </ScrollArea>

              <form onSubmit={handleSubmit} className="border-t p-4">
                <div className="flex items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={chatPlaceholder}
                    disabled={isLoading}
                  />
                  <Button type="submit" disabled={isLoading || !draft.trim()}>
                    <SendHorizontal className="h-4 w-4" />
                    Send
                  </Button>
                </div>
                {!isAdvisorView && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Out-of-topic prompts get: &ldquo;{outOfScopeReply}&rdquo;
                  </p>
                )}
              </form>
            </div>
          )}
        </section>
      ) : null}
    </>
  )
}
