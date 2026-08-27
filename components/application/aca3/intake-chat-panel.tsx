/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { type FormEvent, type RefObject, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { ArrowLeft, Loader2, Mic, MicOff, Pencil, RotateCcw, SendHorizontal } from "lucide-react"
import { toast } from "sonner"

import { IntakeMessageBubble, type IntakeMessage } from "@/components/application/aca3/intake-chat-message-bubble"
import { IntakeQuestionWidget, type WidgetSpec } from "@/components/application/aca3/intake-question-widget"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/languages"
import { HandoffTrigger } from "@/components/handoff/handoff-trigger"

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "EN",
  "zh-CN": "中文",
  ht: "HT",
  "pt-BR": "PT",
  es: "ES",
  vi: "VI",
}

// BCP-47 tags for the Web Speech API. Haitian Creole has no speech engine;
// French is the closest fallback so the button still does something.
const SPEECH_LANG: Record<SupportedLanguage, string> = {
  en: "en-US",
  "zh-CN": "zh-CN",
  ht: "fr-FR",
  "pt-BR": "pt-BR",
  es: "es-US",
  vi: "vi-VN",
}

export interface IntakeChatCopy {
  title: string
  subtitle: string
  openingMemoPrompt: string
  switchToWizard: string
  placeholder: string
  saving: string
  send: string
  resetChat: string
  autoPlay: string
  complete: string
  savedPrefix: string
}

export interface CollectedSection {
  title: string
  items: { label: string; value: string; questionId: string }[]
}

interface IntakeChatPanelProps {
  copy: IntakeChatCopy
  onSaveAndExit?: () => void
  onSwitchToWizard: () => void
  autoSpeak: boolean
  onAutoSpeakChange: (value: boolean) => void
  selectedLanguage: SupportedLanguage
  onLanguageChange: (value: string) => void
  messages: IntakeMessage[]
  isLoading: boolean
  onSpeakQuestion: (question: string) => void
  bottomAnchorRef: RefObject<HTMLDivElement | null>
  draft: string
  onDraftChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  disableInput: boolean
  disableSubmit: boolean
  onResetChat: () => void
  collectedSections?: CollectedSection[]
  onEditAnswer?: (questionId: string) => void
  completionPercent?: number
  widgetSpec?: WidgetSpec | null
  onWidgetAnswer?: (value: string) => void
  widgetKey?: string
  onHandoff?: () => void
  mobileMode?: boolean
}

export function IntakeChatPanel({
  copy,
  onSaveAndExit,
  onSwitchToWizard,
  autoSpeak,
  onAutoSpeakChange,
  selectedLanguage,
  onLanguageChange,
  messages,
  isLoading,
  onSpeakQuestion,
  bottomAnchorRef,
  draft,
  onDraftChange,
  onSubmit,
  disableInput,
  disableSubmit,
  onResetChat,
  collectedSections,
  onEditAnswer,
  completionPercent,
  widgetSpec,
  onWidgetAnswer,
  widgetKey,
  onHandoff,
  mobileMode,
}: IntakeChatPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isListening, setIsListening] = useState(false)
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const baseDraftRef = useRef("")        // draft text present when recording started
  const finalTranscriptRef = useRef("")  // final segments accumulated this session
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Live mic-permission state, kept in a ref so async callbacks read the latest value.
  const micPermissionRef = useRef<PermissionState | "unknown">("unknown")

  // `window` is undefined during SSR; a render-time check would desync hydration.
  // useSyncExternalStore renders `false` on the server, then the real value once mounted.
  const speechSupported = useSyncExternalStore(
    () => () => {},
    () => "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
    () => false,
  )

  // Tear down any live recognition if the panel unmounts mid-session.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current)
    }
  }, [])

  // Track the mic permission so we can (a) give targeted recovery steps when it
  // was blocked earlier and (b) auto-clear the error the moment the user flips
  // it back to "Allow" in the browser's site settings.
  useEffect(() => {
    const permissions = navigator.permissions
    if (!permissions?.query) return
    let status: PermissionStatus | null = null
    const onChange = () => {
      if (!status) return
      micPermissionRef.current = status.state
      if (status.state === "granted") setVoiceError(null)
    }
    permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        status = result
        micPermissionRef.current = result.state
        result.addEventListener("change", onChange)
      })
      .catch(() => {
        /* Firefox/Safari: "microphone" not queryable — fall back to start() */
      })
    return () => {
      status?.removeEventListener("change", onChange)
    }
  }, [])

  const voiceErrorMessage = (error: string) => {
    switch (error) {
      case "not-allowed":
      case "service-not-allowed":
        return "Microphone access denied. Enable microphone permissions in your browser to use voice input."
      case "denied-blocked":
        return "Microphone is blocked for this site. Open the site permissions (the icon just left of the web address) → set Microphone to Allow → reload, then try again."
      case "no-speech":
        return "No speech detected. Try again."
      case "network":
        return "Voice input needs an internet connection."
      case "audio-capture":
        return "No microphone found on this device."
      case "language-not-supported":
        return "Voice input isn't available for this language. Try English or type your answer."
      case "browser-unsupported":
        return "Voice input isn't supported in this browser."
      default:
        return "Voice input failed. Please try again or type your answer."
    }
  }

  const clearStopTimeout = useCallback(() => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current)
      stopTimeoutRef.current = null
    }
  }, [])

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    setIsVoiceProcessing(true)
    try {
      rec.stop()
    } catch {
      /* already stopped */
    }
    // Some engines never fire `onend` after stop() — force-settle after 3s.
    stopTimeoutRef.current = setTimeout(() => {
      try {
        rec.abort()
      } catch {
        /* noop */
      }
      setIsListening(false)
      setIsVoiceProcessing(false)
    }, 3000)
  }, [])

  const reportVoiceError = useCallback((code: string) => {
    const message = voiceErrorMessage(code)
    setVoiceError(message)
    toast.error(message)
  }, [])

  // Explicitly request the mic before starting recognition. When the permission
  // is in the "prompt" state this reliably surfaces the native dialog (some
  // Chromium builds don't show it for SpeechRecognition alone) — that's the
  // user's second chance to accept. When it was already blocked, the browser
  // won't re-prompt from script, so we return a code that tells them how to
  // un-block it in site settings.
  const ensureMicAccess = useCallback(async (): Promise<boolean> => {
    if (micPermissionRef.current === "granted") return true
    // Don't trust a cached "denied": an OS-level or site-settings change never
    // fires the Permissions API `change` event, so re-probe getUserMedia every
    // time — it's the real source of truth and lets the panel recover without a
    // full page reload.
    const media = navigator.mediaDevices
    if (!media?.getUserMedia) return true // Safari etc. — let start() do the asking
    try {
      const stream = await media.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop()) // release immediately; SR opens its own
      micPermissionRef.current = "granted"
      return true
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ""
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        reportVoiceError("audio-capture")
      } else {
        // NotAllowedError / SecurityError — dismissed or blocked
        micPermissionRef.current = "denied"
        reportVoiceError("denied-blocked")
      }
      return false
    }
  }, [reportVoiceError])

  const startListening = useCallback(async () => {
    setVoiceError(null)
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) {
      reportVoiceError("browser-unsupported")
      return
    }
    setIsVoiceProcessing(true)
    const granted = await ensureMicAccess()
    if (!granted) {
      setIsVoiceProcessing(false)
      return
    }
    const recognition = new SR()
    recognition.lang = SPEECH_LANG[selectedLanguage] ?? "en-US"
    // `continuous` keeps the mic open across pauses instead of stopping after
    // the first phrase; `interimResults` streams partial text for live feedback.
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    baseDraftRef.current = draft ? draft.trimEnd() + " " : ""
    finalTranscriptRef.current = ""

    recognition.onstart = () => {
      setVoiceError(null)
      setIsListening(true)
      setIsVoiceProcessing(false)
    }
    recognition.onresult = (event) => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        if (res.isFinal) {
          finalTranscriptRef.current += res[0].transcript + " "
        } else {
          interim += res[0].transcript
        }
      }
      onDraftChange((baseDraftRef.current + finalTranscriptRef.current + interim).trimStart())
    }
    recognition.onerror = (event) => {
      clearStopTimeout()
      setIsListening(false)
      setIsVoiceProcessing(false)
      if (event.error !== "aborted") {
        reportVoiceError(event.error)
      }
    }
    recognition.onend = () => {
      clearStopTimeout()
      setIsListening(false)
      setIsVoiceProcessing(false)
      // Commit finals only — drop any trailing interim text.
      onDraftChange((baseDraftRef.current + finalTranscriptRef.current).trimEnd())
    }

    recognitionRef.current = recognition
    try {
      recognition.start() // permission already granted above; waiting for onstart
    } catch {
      recognitionRef.current = null
      setIsVoiceProcessing(false)
      reportVoiceError("audio-capture")
    }
  }, [selectedLanguage, draft, onDraftChange, clearStopTimeout, reportVoiceError, ensureMicAccess])

  const toggleVoiceInput = useCallback(() => {
    if (isListening) stopListening()
    else void startListening()
  }, [isListening, startListening, stopListening])

  useEffect(() => {
    if (isLoading) return
    const last = messages[messages.length - 1]
    if (last?.role === "assistant") {
      inputRef.current?.focus()
    }
  }, [isLoading, messages])

  if (mobileMode) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="shrink-0 border-b bg-card px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            {onSaveAndExit && (
              <Button type="button" variant="ghost" size="sm" onClick={onSaveAndExit} className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
                Save & Exit
              </Button>
            )}
            <span className="min-w-0 flex-1 truncate font-semibold text-base">{copy.title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {SUPPORTED_LANGUAGES.map(({ code }) => (
              <button
                key={code}
                type="button"
                onClick={() => onLanguageChange(code)}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium transition-colors",
                  selectedLanguage === code
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {LANGUAGE_LABELS[code]}
              </button>
            ))}
          </div>
          {completionPercent !== undefined && completionPercent > 0 && (
            <Progress value={completionPercent} className="h-1.5" />
          )}
        </div>

        {/* Scrollable messages — flex-1 fills remaining height */}
        <div className="flex-1 overflow-y-auto bg-secondary/10 px-4 py-3 space-y-3">
          {messages.map((message) => (
            <IntakeMessageBubble key={message.id} message={message} onSpeakQuestion={onSpeakQuestion} />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2 text-sm text-secondary-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.saving}
              </div>
            </div>
          )}
          <div ref={bottomAnchorRef} />
        </div>

        {/* Input bar — pinned to bottom */}
        <div className="shrink-0 border-t bg-card px-4 py-3 space-y-2">
          <form onSubmit={onSubmit}>
            {widgetSpec && onWidgetAnswer && (
              <div className="mb-3">
                <IntakeQuestionWidget
                  key={widgetKey}
                  spec={widgetSpec}
                  onAnswer={onWidgetAnswer}
                  disabled={disableInput}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              {speechSupported && (
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "outline"}
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={toggleVoiceInput}
                  disabled={disableInput || isVoiceProcessing}
                  aria-label={isListening ? "Stop voice input" : "Voice input"}
                >
                  {isVoiceProcessing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isListening ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              )}
              <Input
                ref={inputRef}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder={isVoiceProcessing ? "Processing…" : isListening ? "Listening…" : copy.placeholder}
                disabled={disableInput}
                className="h-12 text-base"
              />
              <Button type="submit" disabled={disableSubmit} size="icon" className="h-12 w-12 shrink-0">
                <SendHorizontal className="h-5 w-5" />
              </Button>
            </div>
            {voiceError && (
              <p className="mt-1.5 text-xs text-destructive" role="alert">{voiceError}</p>
            )}
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-4">
    <Card className="min-w-0 flex-1 border-border bg-card">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onSaveAndExit && (
              <Button type="button" variant="ghost" size="sm" onClick={onSaveAndExit} className="gap-1.5 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Save & Exit
              </Button>
            )}
            <CardTitle className="text-lg">{copy.title}</CardTitle>
          </div>
          <Button type="button" variant="outline" onClick={onSwitchToWizard}>
            {copy.switchToWizard}
          </Button>
        </div>

        {/* Progress bar */}
        {completionPercent !== undefined && completionPercent > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Application progress</span>
              <span>{completionPercent}%</span>
            </div>
            <Progress value={completionPercent} className="h-1.5" />
          </div>
        )}

        <CardDescription>{copy.subtitle}</CardDescription>

        {/* Controls row: auto-speak + language */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Switch checked={autoSpeak} onCheckedChange={onAutoSpeakChange} id="intake-auto-speak" />
            <Label htmlFor="intake-auto-speak" className="text-sm">{copy.autoPlay}</Label>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {onHandoff && <HandoffTrigger onTrigger={onHandoff} />}
            {SUPPORTED_LANGUAGES.map(({ code }) => (
              <button
                key={code}
                type="button"
                onClick={() => onLanguageChange(code)}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                  selectedLanguage === code
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {LANGUAGE_LABELS[code]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <ScrollArea className="h-[55vh] rounded-lg border bg-secondary/20 p-4 md:h-[60vh]">
          <div className="space-y-3">
            {messages.map((message) => (
              <IntakeMessageBubble key={message.id} message={message} onSpeakQuestion={onSpeakQuestion} />
            ))}
            {isLoading ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2 text-sm text-secondary-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.saving}
                </div>
              </div>
            ) : null}
            <div ref={bottomAnchorRef} />
          </div>
        </ScrollArea>

        <form onSubmit={onSubmit} className="space-y-2">
          {widgetSpec && onWidgetAnswer && (
            <IntakeQuestionWidget
              key={widgetKey}
              spec={widgetSpec}
              onAnswer={onWidgetAnswer}
              disabled={disableInput}
            />
          )}
          <div className="flex items-center gap-2">
            {speechSupported && (
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                className="shrink-0"
                onClick={toggleVoiceInput}
                disabled={disableInput || isVoiceProcessing}
                aria-label={isListening ? "Stop voice input" : "Voice input"}
              >
                {isVoiceProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}
            <Input
              ref={inputRef}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={isVoiceProcessing ? "Processing…" : isListening ? "Listening…" : copy.placeholder}
              disabled={disableInput}
            />
            <Button type="submit" disabled={disableSubmit}>
              <SendHorizontal className="h-4 w-4" />
              {copy.send}
            </Button>
          </div>
          {voiceError && (
            <p className="text-xs text-destructive" role="alert">{voiceError}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              This intake flow follows the ACA-3 schema and saves directly to your wizard draft.
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={onResetChat}>
              <RotateCcw className="h-4 w-4" />
              {copy.resetChat}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    {collectedSections && collectedSections.length > 0 && (
      <div className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto" style={{ maxHeight: "calc(60vh + 220px)" }}>
        {collectedSections.map((section) => (
          <div key={section.title} className="rounded-xl border bg-background p-4 shadow-sm">
            <p className="mb-2 text-sm font-medium">{section.title}</p>
            <div className="space-y-2">
              {section.items.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="truncate text-sm">{item.value}</p>
                  </div>
                  {onEditAnswer && (
                    <button
                      type="button"
                      onClick={() => onEditAnswer(item.questionId)}
                      className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={`Edit ${item.label}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )}
    </div>
  )
}
