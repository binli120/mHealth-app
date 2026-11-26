/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { Button } from "@/components/ui/button"
import { getAtPath } from "@/lib/masshealth/saca2/answer-paths"
import { getStepContent } from "@/lib/masshealth/saca2/questions"
import {
  isQuestionVisible,
  resolveQuestionPath,
  resolveText,
  type Saca2Question,
  type Saca2QuestionContext,
} from "@/lib/masshealth/saca2/questions/types"
import type { Saca2StepId } from "@/lib/masshealth/saca2/schema"
import type { Saca2Answers } from "@/lib/masshealth/saca2/types"
import { Saca2Field } from "./saca2-field"

interface Saca2StepFormProps {
  stepId: Saca2StepId
  answers: Saca2Answers
  personIndex: number
  errors: Record<string, string>
  onChange: (path: string, value: unknown) => void
  /** Reference date for age-based rules; defaults to now. */
  on?: Date
}

export function Saca2StepForm({ stepId, answers, personIndex, errors, onChange, on }: Saca2StepFormProps) {
  const content = getStepContent(stepId)
  if (!content) return null

  const ctx: Saca2QuestionContext = { answers, personIndex, on: on ?? new Date() }

  const renderQuestion = (question: Saca2Question) => {
    if (!isQuestionVisible(question, ctx)) return null
    const path = resolveQuestionPath(content.scope, personIndex, question.path)
    const label = resolveText(question.label, ctx)
    const help = question.help ? resolveText(question.help, ctx) : undefined

    if (question.kind === "repeater" && question.repeater) {
      const config = question.repeater
      const raw = getAtPath(answers, path)
      const items = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []
      return (
        <fieldset key={question.id} className="space-y-3">
          <legend className="text-sm font-medium">{label}</legend>
          {help ? <p className="text-sm text-muted-foreground">{help}</p> : null}
          {errors[path] ? (
            <p role="alert" className="text-sm text-destructive">
              {errors[path]}
            </p>
          ) : null}
          {items.map((item, index) => {
            const itemCtx: Saca2QuestionContext = { ...ctx, item }
            return (
              <div key={index} className="space-y-3 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">
                    {config.itemTitle} {index + 1}
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Remove ${config.itemTitle} ${index + 1}`}
                    onClick={() =>
                      onChange(
                        path,
                        items.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
                {config.questions.map((itemQuestion) => {
                  if (!isQuestionVisible(itemQuestion, itemCtx)) return null
                  const itemPath = `${path}.${index}.${itemQuestion.path}`
                  return (
                    <Saca2Field
                      key={itemQuestion.id}
                      id={itemPath}
                      question={itemQuestion}
                      label={resolveText(itemQuestion.label, itemCtx)}
                      help={itemQuestion.help ? resolveText(itemQuestion.help, itemCtx) : undefined}
                      value={item[itemQuestion.path]}
                      error={errors[itemPath]}
                      onChange={(value) => onChange(itemPath, value)}
                    />
                  )
                })}
              </div>
            )
          })}
          {items.length < config.maxItems ? (
            <Button type="button" variant="outline" onClick={() => onChange(path, [...items, config.emptyItem()])}>
              {config.addLabel}
            </Button>
          ) : null}
        </fieldset>
      )
    }

    return (
      <Saca2Field
        key={question.id}
        id={path}
        question={question}
        label={label}
        help={help}
        value={getAtPath(answers, path)}
        error={errors[path]}
        onChange={(value) => onChange(path, value)}
      />
    )
  }

  return (
    <div className="space-y-8">
      {content.sections.map((section) => {
        const rendered = section.questions.map(renderQuestion).filter(Boolean)
        if (rendered.length === 0) return null
        return (
          <section key={section.id} className="space-y-4">
            <h3 className="text-lg font-semibold">{resolveText(section.title, ctx)}</h3>
            {section.description ? (
              <p className="text-sm text-muted-foreground">{resolveText(section.description, ctx)}</p>
            ) : null}
            {rendered}
          </section>
        )
      })}
    </div>
  )
}
