/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, ListChecks, Loader2, Lock, LogIn, MessageCircle, RotateCcw, SendHorizontal, ShieldCheck, UserSearch, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isSupportedLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/languages"
import { getChatWidgetCopy, type ChatWidgetCopy } from "@/lib/i18n/chat-widget"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { useAutoScroll } from "@/hooks/use-auto-scroll"
import {
  getBenefitAdvisorGreeting,
  getMassHealthCommonQuestions,
  getMassHealthGreeting,
  getMassHealthOutOfScopeResponse,
} from "@/lib/masshealth/chat-knowledge"
import { getSupabaseClient } from "@/lib/supabase/client"
import { OPEN_SW_CHAT_EVENT, type OpenSwChatDetail } from "@/lib/events/chat-events"
import type {
  WidgetView,
  ChatApiResponse,
  WidgetMessage,
  WidgetSystemMessageKey,
} from "./types"
import { SwFinderPanel } from "./sw-finder-panel"
import { SwDirectChatPanel, type DirectMessage } from "./sw-direct-chat-panel"

function createMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createAssistantMessage(
  content: string,
  systemKey?: WidgetSystemMessageKey,
  eligibilityResults?: ChatApiResponse["eligibilityResults"],
): WidgetMessage {
  return {
    id: createMessageId(),
    role: "assistant",
    content,
    eligibilityResults,
    systemKey,
  }
}

function resolveSystemMessageContent(
  systemKey: WidgetSystemMessageKey,
  options: {
    greeting: string
    advisorGreeting: string
    outOfScopeReply: string
    copy: ChatWidgetCopy
  },
) {
  switch (systemKey) {
    case "chatGreeting":
      return options.greeting
    case "advisorGreeting":
      return options.advisorGreeting
    case "outOfScope":
      return options.outOfScopeReply
    case "requestFailed":
      return options.copy.fallbackReply
    case "serviceUnavailable":
      return options.copy.serviceUnavailable
    default:
      return null
  }
}

function relocalizeMessages(
  previous: WidgetMessage[],
  options: {
    greeting: string
    advisorGreeting: string
    outOfScopeReply: string
    copy: ChatWidgetCopy
  },
) {
  let changed = false

  const next = previous.map((message) => {
    if (!message.systemKey) return message

    const content = resolveSystemMessageContent(message.systemKey, options)
    if (!content || content === message.content) return message

    changed = true
    return { ...message, content }
  })

  return changed ? next : previous
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

export function MassHealthChatWidget() {
  const dispatch = useAppDispatch()
  const selectedLanguage = useAppSelector((state) => state.app.language)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<WidgetView>(() => {
    if (typeof window === "undefined") return "advisor"
    const saved = localStorage.getItem("chat-widget-last-view")
    const valid: WidgetView[] = ["advisor", "chat", "faq", "find_sw"]
    return valid.includes(saved as WidgetView) ? (saved as WidgetView) : "advisor"
  })
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "guest">("loading")
  const [swChatTarget, setSwChatTarget] = useState<{ userId: string; name: string } | null>(null)
  // Per-SW message cache so switching tabs / minimizing widget doesn't lose chat state
  const swMessageCacheRef = useRef<Record<string, DirectMessage[]>>({})

  // Subscribe to Supabase auth state — fires immediately with the current
  // session and again on every login/logout, so the widget shows/hides reactively.
  useEffect(() => {
    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange(
      (_event, session) => {
        setCurrentUserId(session?.user?.id ?? null)
        setAuthStatus(session?.user ? "authenticated" : "guest")
        // Close the widget if the user logs out while it's open
        if (!session?.user) setOpen(false)
      },
    )
    return () => subscription.unsubscribe()
  }, [])
  const copy = useMemo(() => getChatWidgetCopy(selectedLanguage), [selectedLanguage])
  const faqs = useMemo(() => getMassHealthCommonQuestions(selectedLanguage), [selectedLanguage])
  const greeting = useMemo(() => getMassHealthGreeting(selectedLanguage), [selectedLanguage])
  const advisorGreeting = useMemo(() => getBenefitAdvisorGreeting(selectedLanguage), [selectedLanguage])
  const outOfScopeReply = useMemo(
    () => getMassHealthOutOfScopeResponse(selectedLanguage),
    [selectedLanguage],
  )

  // Regular chat messages
  const [messages, setMessages] = useState<WidgetMessage[]>([
    createAssistantMessage(greeting, "chatGreeting"),
  ])
  // Benefit advisor messages (separate history)
  const [advisorMessages, setAdvisorMessages] = useState<WidgetMessage[]>([
    createAssistantMessage(advisorGreeting, "advisorGreeting"),
  ])

  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const bottomAnchorRef = useAutoScroll([messages, advisorMessages, isLoading, open, view])

  // Listen for programmatic open-to-SW-chat requests (from dashboard card, notifications, etc.)
  useEffect(() => {
    const handler = (e: Event) => {
      const { swUserId, swName } = (e as CustomEvent<OpenSwChatDetail>).detail
      setSwChatTarget({ userId: swUserId, name: swName })
      setView("sw_chat")
      setOpen(true)
    }
    window.addEventListener(OPEN_SW_CHAT_EVENT, handler)
    return () => window.removeEventListener(OPEN_SW_CHAT_EVENT, handler)
  }, [])

  // Persist last-used tab (exclude sw_chat — it's a transient sub-view)
  useEffect(() => {
    if (view !== "sw_chat") localStorage.setItem("chat-widget-last-view", view)
  }, [view])

  useEffect(() => {
    const options = { greeting, advisorGreeting, outOfScopeReply, copy }
    setMessages((previous) => relocalizeMessages(previous, options))
    setAdvisorMessages((previous) => relocalizeMessages(previous, options))
  }, [advisorGreeting, copy, greeting, outOfScopeReply])

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
      const reply = data.reply?.trim() || (data.outOfScope ? outOfScopeReply : copy.fallbackReply)
      const systemKey: WidgetSystemMessageKey | undefined = data.reply?.trim()
        ? undefined
        : data.outOfScope
          ? "outOfScope"
          : "requestFailed"

      setCurrentMessages((previous) => [
        ...previous,
        createAssistantMessage(reply, systemKey, data.eligibilityResults),
      ])
    } catch (error) {
      console.error("MassHealth chat request failed", error)
      const setMsg = isAdvisorView ? setAdvisorMessages : setMessages
      setMsg((previous) => [
        ...previous,
        createAssistantMessage(copy.serviceUnavailable, "serviceUnavailable"),
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
    setMessages([createAssistantMessage(greeting, "chatGreeting")])
    setAdvisorMessages([createAssistantMessage(advisorGreeting, "advisorGreeting")])
    setDraft("")
    setView("advisor")
  }

  const activeMessages = isAdvisorView ? advisorMessages : messages
  const chatPlaceholder = isAdvisorView ? copy.advisorPlaceholder : copy.chatPlaceholder

  return (
    <>
      <Button
        size="icon-lg"
        className="fixed right-5 bottom-5 z-50 h-14 w-14 rounded-full shadow-xl"
        aria-label={open ? copy.hideAssistant : copy.openAssistant}
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {open ? (
        <section
          role="dialog"
          aria-label={copy.dialogLabel}
          className="fixed right-5 bottom-24 z-40 flex h-[min(80vh,760px)] w-[min(92vw,440px)] flex-col overflow-hidden rounded-lg border bg-background shadow-2xl"
        >
          {/* Header */}
          <header className="border-b px-5 py-4 text-left">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">HealthCompass AI Assistant</h2>
              <div className="flex items-center gap-2">
                <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="h-8 w-[150px]">
                    <SelectValue placeholder={copy.languagePlaceholder} />
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
                  aria-label={copy.reset}
                  onClick={handleResetChat}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={copy.close}
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              {view === "find_sw" || view === "sw_chat"
                ? "Connect with a licensed social worker for personalized help."
                : view === "faq"
                  ? "Browse common questions about MassHealth and benefits."
                  : view === "chat"
                    ? copy.chatDescription
                    : copy.advisorDescription}
            </p>
          </header>

          {/* Tab bar */}
          <div className="border-b">
            <div className="grid grid-cols-4">
              {(
                [
                  { id: "live", label: "Live Assistant", icon: UserSearch, requiresAuth: true, isActive: view === "find_sw" || view === "sw_chat", onClick: () => setView(swChatTarget ? "sw_chat" : "find_sw") },
                  { id: "advisor", label: "Benefit Advisor", icon: ShieldCheck, requiresAuth: true, isActive: view === "advisor", onClick: () => setView("advisor") },
                  { id: "faq", label: "Common Questions", icon: ListChecks, requiresAuth: false, isActive: view === "faq", onClick: () => setView("faq") },
                  { id: "chat", label: "Ask Question", icon: MessageCircle, requiresAuth: true, isActive: view === "chat", onClick: () => setView("chat") },
                ] as const
              ).map(({ id, label, icon: Icon, requiresAuth, isActive, onClick }) => {
                const locked = requiresAuth && authStatus !== "authenticated"
                return (
                  <button
                    key={id}
                    type="button"

                    onClick={locked ? undefined : onClick}
                    aria-label={label}
                    className={[
                      "relative flex flex-col items-center gap-1 border-b-2 px-1 py-2.5 text-center text-[10px] font-medium transition-colors",
                      locked
                        ? "cursor-not-allowed border-transparent text-muted-foreground/40"
                        : isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    <span className="relative inline-flex">
                      <Icon className="h-4 w-4 shrink-0" />
                      {locked && (
                        <Lock className="absolute -right-1.5 -top-1 h-2.5 w-2.5 text-muted-foreground/50" />
                      )}
                    </span>
                    <span className="leading-tight">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main content area — always rendered; overlaid when auth is pending or user is a guest */}
          <div className="relative min-h-0 flex-1 flex flex-col overflow-hidden">

            {/* ── FAQ view (always accessible) ── */}
            {view === "faq" && (
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-4 p-4">
                  <div className="rounded-xl border bg-secondary/40 p-4">
                    <p className="text-sm text-secondary-foreground">{greeting}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {copy.faqHint}
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
                          {copy.chatAboutThis}
                        </Button>
                        {faq.links.slice(0, 1).map((link) => (
                          <Button key={link.url} asChild size="sm" variant="outline">
                            <a href={link.url} target="_blank" rel="noreferrer">
                              {copy.officialSource}
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* ── Live Assistant / SW Chat views (auth-required) ── */}
            {view === "find_sw" && authStatus === "authenticated" && (
              <SwFinderPanel
                onOpenChat={(userId, name) => {
                  setSwChatTarget({ userId, name })
                  setView("sw_chat")
                }}
              />
            )}
            {view === "sw_chat" && authStatus === "authenticated" && swChatTarget && currentUserId && (
              <SwDirectChatPanel
                swUserId={swChatTarget.userId}
                swName={swChatTarget.name}
                currentUserId={currentUserId}
                initialMessages={swMessageCacheRef.current[swChatTarget.userId]}
                onMessagesChange={(msgs) => {
                  swMessageCacheRef.current[swChatTarget.userId] = msgs
                }}
                onBack={() => setView("find_sw")}
              />
            )}
            {/* Stub shown behind the overlay for Live Assistant when not authed */}
            {(view === "find_sw" || view === "sw_chat") && authStatus !== "authenticated" && (
              <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 pointer-events-none select-none">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl border bg-muted/30" />
                ))}
              </div>
            )}

            {/* ── Chat / Advisor view ── */}
            {(view === "advisor" || view === "chat") && (
              <div className={[
                "flex min-h-0 flex-1 flex-col",
                authStatus !== "authenticated" ? "pointer-events-none select-none" : "",
              ].join(" ")}>
                {isAdvisorView && (
                  <div className="bg-muted/40 border-b px-4 py-2 text-xs text-muted-foreground">
                    <ShieldCheck className="mr-1 inline h-3 w-3" />
                    {copy.advisorDisclaimer}
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
                          {isAdvisorView ? copy.checkingEligibility : copy.thinking}
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
                      {copy.send}
                    </Button>
                  </div>
                  {!isAdvisorView && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {copy.outOfTopicLabel} &ldquo;{outOfScopeReply}&rdquo;
                    </p>
                  )}
                </form>
              </div>
            )}

            {/* ── Auth loading overlay ── */}
            {authStatus === "loading" && view !== "faq" && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* ── Guest overlay — content visible but grayed out behind this ── */}
            {authStatus === "guest" && view !== "faq" && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/75 backdrop-blur-[2px]">
                <div className="mx-5 w-full max-w-[260px] rounded-2xl border bg-card p-5 text-center shadow-lg space-y-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 mx-auto">
                    <LogIn className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Sign in to use this feature</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Chat with a social worker, check eligibility, and manage your applications.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <a
                      href="/auth/login"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      Sign In
                    </a>
                    <a
                      href="/auth/register"
                      className="inline-flex w-full items-center justify-center rounded-lg border px-4 py-2 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      Create Account
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => setView("faq")}
                    className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Browse FAQs without signing in
                  </button>
                </div>
              </div>
            )}

          </div>
        </section>
      ) : null}
    </>
  )
}
