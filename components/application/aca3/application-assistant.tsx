"use client"

import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Mic, MicOff, Send, CheckCircle2, Circle, ChevronDown, ChevronUp, ArrowRight, Loader2, User, Bot, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import {
  createApplication,
  setActiveApplication,
  patchNewApplicationForm,

  type ApplicationFormData,
  type HouseholdMember,
  type IncomeSource,
} from "@/lib/redux/features/application-slice"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { isSupportedLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/languages"
import { getFormAssistantGreeting } from "@/lib/masshealth/chat-knowledge"
import {
  summarizeCollectedFields,
  detectCurrentSection,
  type FormSection,
} from "@/lib/masshealth/form-sections"
import { DocumentUploader } from "@/components/application/document-uploader"

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant"

interface BaseMessage {
  id: string
  role: MessageRole
  content: string
}

interface TextMessage extends BaseMessage {
  type: "text"
}

interface UploadPromptMessage extends BaseMessage {
  type: "upload_prompt"
  docTypes: Array<{ type: string; label: string; description: string }>
}

type AssistantMessage = TextMessage | UploadPromptMessage

interface ApiChatMessage {
  role: "user" | "assistant"
  content: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<FormSection, string> = {
  personal: "Personal Info",
  contact: "Contact Details",
  household: "Household",
  income: "Income",
  documents: "Documents",
}

const SECTION_ORDER: FormSection[] = ["personal", "contact", "household", "income", "documents"]

const REQUIRED_DOCS = [
  {
    type: "identity",
    label: "Government-Issued ID",
    description: "Driver's license, state ID, or passport",
  },
  {
    type: "proof_of_income",
    label: "Proof of Income",
    description: "Recent pay stubs, tax return, or benefit award letter",
  },
  {
    type: "proof_of_residency",
    label: "Proof of MA Residency",
    description: "Utility bill, bank statement, or lease agreement",
  },
]

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "EN",
  "zh-CN": "中文",
  ht: "HT",
  "pt-BR": "PT",
  es: "ES",
  vi: "VI",
}

// BCP-47 tags for Web Speech API
const SPEECH_LANG: Record<SupportedLanguage, string> = {
  en: "en-US",
  "zh-CN": "zh-CN",
  ht: "fr-HT",
  "pt-BR": "pt-BR",
  es: "es-US",
  vi: "vi-VN",
}

// ── Progress helpers ──────────────────────────────────────────────────────────

interface SectionField {
  label: string
  value: string
}

function getSectionFields(formData: ApplicationFormData, section: FormSection): SectionField[] {
  switch (section) {
    case "personal":
      return [
        { label: "First name", value: formData.firstName },
        { label: "Last name", value: formData.lastName },
        { label: "Date of birth", value: formData.dob },
      ]
    case "contact":
      return [
        { label: "Email", value: formData.email },
        { label: "Phone", value: formData.phone },
        { label: "Address", value: formData.address },
        { label: "City", value: formData.city },
        { label: "ZIP", value: formData.zip },
      ]
    case "household":
      return (formData.householdMembers?.length ?? 0) > 0
        ? formData.householdMembers.map((m) => ({
            label: `${m.firstName} ${m.lastName}`,
            value: m.relationship,
          }))
        : [{ label: "Members", value: "" }]
    case "income":
      return (formData.incomeSources?.length ?? 0) > 0
        ? formData.incomeSources.map((s) => ({
            label: s.type,
            value: `$${s.amount}/${s.frequency}`,
          }))
        : [{ label: "Sources", value: "" }]
    case "documents":
      return REQUIRED_DOCS.map((d) => ({ label: d.label, value: "" }))
  }
}

function isSectionComplete(
  formData: ApplicationFormData,
  section: FormSection,
  noHousehold: boolean,
  noIncome: boolean,
): boolean {
  switch (section) {
    case "personal":
      return Boolean(formData.firstName && formData.lastName && formData.dob)
    case "contact":
      return Boolean(formData.email && formData.phone && formData.address && formData.city && formData.zip)
    case "household":
      return noHousehold || (formData.householdMembers?.length ?? 0) > 0
    case "income":
      return noIncome || (formData.incomeSources?.length ?? 0) > 0
    case "documents":
      return false // never "complete" — user uploads on their own time
  }
}

function computeProgress(
  formData: ApplicationFormData,
  noHousehold: boolean,
  noIncome: boolean,
): number {
  const completed = SECTION_ORDER.filter((s) =>
    s !== "documents" && isSectionComplete(formData, s, noHousehold, noIncome)
  ).length
  return Math.round((completed / 4) * 100)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ApplicationAssistantProps {
  applicationId?: string
  onSwitchToWizard?: () => void
}

export function ApplicationAssistant({ applicationId, onSwitchToWizard }: ApplicationAssistantProps) {
  const dispatch = useAppDispatch()
  const language = useAppSelector((state) => state.app.language) as SupportedLanguage

  // Stable ID for this chat session — either the provided applicationId or a fresh UUID.
  // Using useState guarantees it never changes across re-renders.
  const [sessionApplicationId] = useState<string>(
    () => applicationId ?? crypto.randomUUID(),
  )

  // ── Local field mirror ────────────────────────────────────────────────────
  // localFields is updated immediately when extraction returns, so the sidebar
  // and progress bar always reflect the latest data without waiting for the
  // Redux round-trip.  Redux is still updated for persistence.
  const [localFields, setLocalFields] = useState<Partial<ApplicationFormData>>({})

  // Redux snapshot — used as the baseline when loading a pre-existing draft.
  const savedFormData = useAppSelector(
    (state) => state.application.applicationsById[sessionApplicationId]?.newApplicationForm,
  )

  // Merged view: saved draft baseline + in-session updates
  const formData = useMemo<ApplicationFormData>(
    () => ({ ...(savedFormData ?? {}), ...localFields } as ApplicationFormData),
    [savedFormData, localFields],
  )

  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [noHouseholdMembers, setNoHouseholdMembers] = useState(false)
  const [noIncome, setNoIncome] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<FormSection>>(new Set(["personal"]))
  const [documentsTriggered, setDocumentsTriggered] = useState(false)

  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Initialise application record ─────────────────────────────────────────
  // useLayoutEffect runs synchronously after DOM paint but before the browser
  // displays anything — no flicker, no mid-render side-effect warnings.

  useLayoutEffect(() => {
    dispatch(createApplication({ applicationId: sessionApplicationId, setActive: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally run once on mount only

  // Compute current section from form data
  const currentSection = useMemo(
    () => detectCurrentSection(formData, noHouseholdMembers, noIncome),
    [formData, noHouseholdMembers, noIncome],
  )

  const progress = useMemo(
    () => computeProgress(formData, noHouseholdMembers, noIncome),
    [formData, noHouseholdMembers, noIncome],
  )

  // ── Initialise greeting ───────────────────────────────────────────────────

  useEffect(() => {
    const greeting = getFormAssistantGreeting(language)
    setMessages([
      {
        id: crypto.randomUUID(),
        type: "text",
        role: "assistant",
        content: greeting,
      },
    ])
    // Focus textarea so user can start typing immediately
    textareaRef.current?.focus()
  }, [language])

  // ── Trigger document upload prompts when reaching documents section ────────

  useEffect(() => {
    if (currentSection === "documents" && !documentsTriggered && messages.length > 1) {
      setDocumentsTriggered(true)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "upload_prompt",
          role: "assistant",
          content:
            "Great work! I've collected all your form information. Now let's upload a few supporting documents to complete your application. You can upload each one below:",
          docTypes: REQUIRED_DOCS,
        },
      ])
    }
  }, [currentSection, documentsTriggered, messages.length])

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Auto-focus textarea after assistant replies ───────────────────────────

  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus()
    }
  }, [isLoading])

  // ── Auto-expand the active section in sidebar ──────────────────────────────

  useEffect(() => {
    setExpandedSections((prev) => new Set([...prev, currentSection]))
  }, [currentSection])

  // ── Draft save ────────────────────────────────────────────────────────────

  const scheduleDraftSave = useCallback(() => {
    if (!applicationId) return
    if (saveDraftTimerRef.current) clearTimeout(saveDraftTimerRef.current)
    saveDraftTimerRef.current = setTimeout(async () => {
      try {
        await authenticatedFetch(`/api/applications/${applicationId}/draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wizardState: { formAssistantMessages: messages.length } }),
        })
      } catch {
        // Silently ignore draft save failures
      }
    }, 1500)
  }, [applicationId, messages.length])

  // ── Voice input ───────────────────────────────────────────────────────────

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = typeof window !== "undefined" ? (window as any) : undefined
    const SpeechRecognitionAPI = w?.SpeechRecognition ?? w?.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const recognition = new SpeechRecognitionAPI()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.lang = SPEECH_LANG[language] ?? "en-US"
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.continuous = false
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.interimResults = true

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.onresult = (event: { resultIndex: number; results: { [key: number]: { [key: number]: { transcript: string } } } }) => {
      let transcript = ""
      for (let i = event.resultIndex; i < Object.keys(event.results).length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput(transcript)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      // Auto-submit if there's text
      textareaRef.current?.focus()
    }

    recognition.onerror = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [language])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  // ── Chat submission ───────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || isLoading) return

      const userMessage: TextMessage = {
        id: crypto.randomUUID(),
        type: "text",
        role: "user",
        content: trimmed,
      }

      setMessages((prev) => [...prev, userMessage])
      setInput("")
      setIsLoading(true)

      // Build API messages (text only, no upload_prompt messages)
      const apiMessages: ApiChatMessage[] = messages
        .filter((m): m is TextMessage => m.type === "text")
        .map((m) => ({ role: m.role, content: m.content }))
      apiMessages.push({ role: "user", content: trimmed })

      const collectedSummary = summarizeCollectedFields(formData)

      try {
        const response = await authenticatedFetch("/api/chat/masshealth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            language,
            mode: "form_assistant",
            currentFields: collectedSummary,
            currentSection,
            existingMembers: formData.householdMembers,
            existingSources: formData.incomeSources,
          }),
        })

        if (!response.ok) {
          throw new Error(`API error ${response.status}`)
        }

        const data = await response.json() as {
          ok: boolean
          reply: string
          extractedFields?: Partial<ApplicationFormData>
          noHouseholdMembers?: boolean
          noIncome?: boolean
        }

        if (!data.ok || !data.reply) {
          throw new Error("No reply from assistant")
        }

        // Apply extracted fields — update localFields immediately for instant UI
        // feedback, then also persist to Redux for cross-tab/draft continuity.
        if (data.extractedFields && Object.keys(data.extractedFields).length > 0) {
          const { householdMembers, incomeSources, ...flatFields } = data.extractedFields

          // ── 1. Merge new household members ─────────────────────────────────
          let mergedMembers: HouseholdMember[] | undefined
          if (Array.isArray(householdMembers) && householdMembers.length > 0) {
            const existingIds = new Set(formData.householdMembers.map((m) => m.id))
            const newMembers = householdMembers.filter((m) => !existingIds.has(m.id))
            if (newMembers.length > 0) {
              mergedMembers = [...formData.householdMembers, ...newMembers]
            }
          }

          // ── 2. Merge new income sources ─────────────────────────────────────
          let mergedSources: IncomeSource[] | undefined
          if (Array.isArray(incomeSources) && incomeSources.length > 0) {
            const existingIds = new Set(formData.incomeSources.map((s) => s.id))
            const newSources = incomeSources.filter((s) => !existingIds.has(s.id))
            if (newSources.length > 0) {
              mergedSources = [...formData.incomeSources, ...newSources]
            }
          }

          // ── 3. Update local state immediately (drives sidebar + progress) ───
          setLocalFields((prev) => ({
            ...prev,
            ...flatFields,
            ...(mergedMembers ? { householdMembers: mergedMembers } : {}),
            ...(mergedSources ? { incomeSources: mergedSources } : {}),
          }))

          // ── 4. Persist to Redux (for draft save / cross-tab continuity) ─────
          dispatch(setActiveApplication(sessionApplicationId))
          if (Object.keys(flatFields).length > 0) {
            dispatch(patchNewApplicationForm({ applicationId: sessionApplicationId, patch: flatFields }))
          }
          if (mergedMembers) {
            // Replace the whole list so we stay in sync with local state
            dispatch(patchNewApplicationForm({
              applicationId: sessionApplicationId,
              patch: { householdMembers: mergedMembers },
            }))
          }
          if (mergedSources) {
            dispatch(patchNewApplicationForm({
              applicationId: sessionApplicationId,
              patch: { incomeSources: mergedSources },
            }))
          }

          // ── Address validation ────────────────────────────────────────────
          // Call /api/address/validate whenever the LLM extracted address fields.
          // Merge with whatever is already stored so we always send a full address.
          const addressChanged = flatFields.address || flatFields.city || flatFields.zip
          if (addressChanged) {
            const streetAddress = (flatFields.address ?? formData.address ?? "").trim()
            const city = (flatFields.city ?? formData.city ?? "").trim()
            const state = (flatFields.state ?? formData.state ?? "MA").trim()
            const zipCode = (flatFields.zip ?? formData.zip ?? "").trim()

            if (streetAddress && city) {
              try {
                const addrResp = await authenticatedFetch("/api/address/validate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ streetAddress, city, state: state || "MA", zipCode }),
                })

                if (addrResp.ok) {
                  const addrData = await addrResp.json() as {
                    ok: boolean
                    valid: boolean
                    message: string
                    suggestion?: {
                      streetAddress: string
                      city: string
                      state: string
                      zipCode: string
                      county: string
                      displayName: string
                    }
                  }

                  if (addrData.ok && addrData.valid && addrData.suggestion) {
                    // Apply the geocoder-normalised values (county, zip corrections, etc.)
                    const s = addrData.suggestion
                    const addrPatch = {
                      address: s.streetAddress || streetAddress,
                      city: s.city || city,
                      state: s.state || state,
                      zip: s.zipCode || zipCode,
                      ...(s.county ? { county: s.county } : {}),
                    }
                    setLocalFields((prev) => ({ ...prev, ...addrPatch }))
                    dispatch(patchNewApplicationForm({
                      applicationId: sessionApplicationId,
                      patch: addrPatch,
                    }))

                    setMessages((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        type: "text" as const,
                        role: "assistant" as const,
                        content: `✅ Address verified: **${s.displayName}**${s.county ? ` (${s.county})` : ""}`,
                      },
                    ])
                  } else if (addrData.ok && !addrData.valid) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        type: "text" as const,
                        role: "assistant" as const,
                        content: addrData.suggestion
                          ? `⚠️ I couldn't fully verify that address. Did you mean **${addrData.suggestion.displayName}**? If so, just confirm and I'll update it.`
                          : `⚠️ I couldn't verify that address. Could you double-check the street, city, and ZIP?`,
                      },
                    ])
                  }
                }
              } catch {
                // Address validation is best-effort — silently skip on error
              }
            }
          }

          scheduleDraftSave()
        }

        if (data.noHouseholdMembers) setNoHouseholdMembers(true)
        if (data.noIncome) setNoIncome(true)

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "text",
            role: "assistant",
            content: data.reply,
          },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "text",
            role: "assistant",
            content: "I'm having trouble connecting right now. Please try again in a moment.",
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, messages, formData, language, currentSection, dispatch, scheduleDraftSave, sessionApplicationId],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        void handleSubmit()
      }
    },
    [handleSubmit],
  )

  const toggleSection = useCallback((section: FormSection) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[600px] gap-4">
      {/* ── Left: Chat panel ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Application Assistant</p>
              <p className="text-xs text-muted-foreground capitalize">{SECTION_LABELS[currentSection]} step</p>
            </div>
          </div>
          {/* Language selector */}
          <div className="flex items-center gap-1">
            {SUPPORTED_LANGUAGES.map(({ code, label: _label }) => (
              <button
                key={code}
                onClick={() => dispatch(setLanguage(code))}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                  language === code
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {LANGUAGE_LABELS[code]}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              applicationId={sessionApplicationId}
            />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t p-4">
          <form onSubmit={(e) => void handleSubmit(e)} className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer or click the mic to speak…"
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
              disabled={isLoading}
            />
            <div className="flex shrink-0 flex-col gap-1">
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={isListening ? stopListening : startListening}
                title={isListening ? "Stop listening" : "Start voice input"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
          {isListening && (
            <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <Volume2 className="h-3 w-3" />
              Listening… speak clearly, then pause
            </p>
          )}
        </div>
      </div>

      {/* ── Right: Progress sidebar ──────────────────────────────────────────── */}
      <div className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto">
        {/* Overall progress */}
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Application Progress</p>
            <Badge variant={progress === 100 ? "default" : "secondary"} className="text-xs">
              {progress}%
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="mt-1 text-xs text-muted-foreground">
            {progress < 100
              ? `Complete the ${SECTION_LABELS[currentSection]} step`
              : "All sections complete — upload documents to finish"}
          </p>
        </div>

        {/* Section accordions */}
        <div className="rounded-xl border bg-background shadow-sm">
          {SECTION_ORDER.map((section, index) => {
            const isComplete = isSectionComplete(formData ?? ({} as ApplicationFormData), section, noHouseholdMembers, noIncome)
            const isActive = section === currentSection
            const isExpanded = expandedSections.has(section)
            const fields = getSectionFields(formData ?? ({} as ApplicationFormData), section)

            return (
              <div key={section} className={cn("border-b last:border-b-0", isActive && "bg-primary/5")}>
                <button
                  onClick={() => toggleSection(section)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <Circle
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isActive && "text-primary",
                        isComplete && "text-green-700",
                      )}
                    >
                      {index + 1}. {SECTION_LABELS[section]}
                    </span>
                    {isActive && (
                      <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px] text-primary">
                        Active
                      </Badge>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <div className="space-y-1 px-4 pb-3">
                    {fields.map((field) => (
                      <div key={field.label} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{field.label}</span>
                        {field.value ? (
                          <span className="max-w-[120px] truncate text-xs font-medium text-green-700">
                            {field.value}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Switch to wizard */}
        {onSwitchToWizard && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            onClick={onSwitchToWizard}
          >
            <span>Review in Form Wizard</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        {/* Help note */}
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          Your information is saved automatically as you chat. SSN is collected securely in the wizard.
        </p>
      </div>
    </div>
  )
}

// ── Message bubble sub-component ──────────────────────────────────────────────

function MessageBubble({
  message,
  applicationId,
}: {
  message: AssistantMessage
  applicationId: string
}) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-2">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {message.content}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </div>
      </div>
    )
  }

  if (message.type === "upload_prompt") {
    return (
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Bot className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm">
            {message.content}
          </div>
          <div className="space-y-2">
            {message.docTypes.map((doc) => (
              <DocumentUploader
                key={doc.type}
                applicationId={applicationId}
                documentType={doc.type}
                requiredDocumentLabel={doc.label}
                title={doc.label}
                description={doc.description}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Standard assistant text message
  return (
    <div className="flex items-start gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed">
        {message.content}
      </div>
    </div>
  )
}
