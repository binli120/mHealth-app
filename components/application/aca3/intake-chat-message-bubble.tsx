"use client"

import { Volume2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ChatMessage } from "@/lib/masshealth/chat-knowledge"

export interface IntakeMessage extends ChatMessage {
  id: string
}

export function splitTrailingQuestion(content: string): { prefix: string; question: string | null } {
  const trimmed = content.trim()
  if (!trimmed.endsWith("?")) {
    return { prefix: content, question: null }
  }

  const questionEndIndex = trimmed.lastIndexOf("?")
  const delimiterCandidates = [
    trimmed.lastIndexOf("\n", questionEndIndex),
    trimmed.lastIndexOf(": ", questionEndIndex),
    trimmed.lastIndexOf(". ", questionEndIndex),
    trimmed.lastIndexOf("! ", questionEndIndex),
  ]

  const bestDelimiter = Math.max(...delimiterCandidates)
  const questionStartIndex = bestDelimiter >= 0 ? bestDelimiter + 1 : 0
  const question = trimmed.slice(questionStartIndex, questionEndIndex + 1).trim()

  if (question.length < 6) {
    return { prefix: content, question: null }
  }

  return {
    prefix: trimmed.slice(0, questionStartIndex).trimEnd(),
    question,
  }
}

export function IntakeMessageBubble({
  message,
  onSpeakQuestion,
}: {
  message: IntakeMessage
  onSpeakQuestion: (question: string) => void
}) {
  const isUser = message.role === "user"
  const { prefix, question } = splitTrailingQuestion(message.content)

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground",
        ].join(" ")}
      >
        {isUser || !question ? (
          message.content
        ) : (
          <>
            {prefix ? <span>{`${prefix} `}</span> : null}
            <span className="font-semibold">{question}</span>
          </>
        )}

        {!isUser && question ? (
          <div className="mt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onSpeakQuestion(question)}>
              <Volume2 className="h-4 w-4" />
              Play question
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

