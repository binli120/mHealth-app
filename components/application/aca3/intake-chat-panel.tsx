/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import type { FormEvent, RefObject } from "react"
import { Loader2, RotateCcw, SendHorizontal } from "lucide-react"

import { IntakeMessageBubble, type IntakeMessage } from "@/components/application/aca3/intake-chat-message-bubble"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/languages"

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

interface IntakeChatPanelProps {
  copy: IntakeChatCopy
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
}

export function IntakeChatPanel({
  copy,
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
}: IntakeChatPanelProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">{copy.title}</CardTitle>
          <Button type="button" variant="outline" onClick={onSwitchToWizard}>
            {copy.switchToWizard}
          </Button>
        </div>
        <CardDescription>{copy.subtitle}</CardDescription>
        <div className="flex items-center gap-2">
          <Switch checked={autoSpeak} onCheckedChange={onAutoSpeakChange} id="intake-auto-speak" />
          <Label htmlFor="intake-auto-speak">{copy.autoPlay}</Label>
        </div>
        <div className="max-w-[220px]">
          <Select value={selectedLanguage} onValueChange={onLanguageChange}>
            <SelectTrigger>
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
          <div className="flex items-center gap-2">
            <Input
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
  )
}

