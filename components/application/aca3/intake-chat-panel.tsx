/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { type FormEvent, type RefObject, useEffect, useRef } from "react"
import { ArrowLeft, Loader2, Pencil, RotateCcw, SendHorizontal } from "lucide-react"

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

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "EN",
  "zh-CN": "中文",
  ht: "HT",
  "pt-BR": "PT",
  es: "ES",
  vi: "VI",
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
}: IntakeChatPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isLoading) return
    const last = messages[messages.length - 1]
    if (last?.role === "assistant") {
      inputRef.current?.focus()
    }
  }, [isLoading, messages])

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
            <Input
              ref={inputRef}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={copy.placeholder}
              disabled={disableInput}
            />
            <Button type="submit" disabled={disableSubmit}>
              <SendHorizontal className="h-4 w-4" />
              {copy.send}
            </Button>
          </div>
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
