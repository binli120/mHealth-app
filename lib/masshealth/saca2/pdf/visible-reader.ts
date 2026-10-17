/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { getAtPath } from "../answer-paths"
import { getStepContent, getStepPersonIndex } from "../questions"
import {
  isQuestionVisible,
  resolveQuestionPath,
  type Saca2Question,
  type Saca2QuestionContext,
  type Saca2StepContent,
} from "../questions/types"
import type { Saca2StepId } from "../schema"
import type { Saca2Answers } from "../types"
import { isStepVisible } from "../visibility"
import type { Source } from "./types"

export type AnswerSource = Extract<Source, { kind: "answer" | "row" }>

export interface VisibleReader {
  /** The value for an answer or row source, or `undefined` when it is absent or not visible. */
  get(source: AnswerSource | Extract<Source, { kind: "derived" }>): unknown
  /** Number of rows in a repeater, `0` when the repeater (or its step) is hidden. */
  rows(stepId: Saca2StepId, path: string, person?: 0 | 1): number
}

interface Scope {
  /** The step whose visibility gates the read (a person block selects person1 / person2). */
  gateStepId: Saca2StepId
  content: Saca2StepContent
  personIndex: number
}

function requireContent(stepId: Saca2StepId): Saca2StepContent {
  const content = getStepContent(stepId)
  if (!content) throw new Error(`No question content for step "${stepId}"`)
  return content
}

function findQuestion(questions: Saca2Question[], path: string): Saca2Question | undefined {
  return questions.find((q) => q.path === path)
}

function findInStep(content: Saca2StepContent, path: string): Saca2Question | undefined {
  for (const section of content.sections) {
    const hit = findQuestion(section.questions, path)
    if (hit) return hit
  }
  return undefined
}

/**
 * Reads answers the way the wizard's validation sees them: a value is only returned when its step
 * is visible, the person block exists, and every `visibleWhen` on the way (the question, or the
 * repeater and then the item question with the row as `ctx.item`) holds. Stale values left behind
 * by a flipped gate therefore never reach the PDF. Unknown paths and keys throw (a mapping bug)
 * and name only the path, never an answer.
 */
export function createVisibleReader(answers: Saca2Answers, on: Date): VisibleReader {
  function resolveScope(stepId: Saca2StepId, person: 0 | 1 | undefined): Scope {
    const content = requireContent(stepId)
    if (content.scope === "root") {
      if (person !== undefined) throw new Error(`"person" is only valid on person-scope steps (step "${stepId}")`)
      return { gateStepId: stepId, content, personIndex: 0 }
    }
    const personIndex = person ?? getStepPersonIndex(stepId)
    // person1 and person2 share one content table; the block chosen decides which step gates it
    const gateStepId: Saca2StepId = personIndex === 1 ? "person2" : "person1"
    return { gateStepId, content, personIndex }
  }

  function ctxFor(scope: Scope): Saca2QuestionContext | null {
    if (!isStepVisible(scope.gateStepId, answers, on)) return null
    if (scope.content.scope === "person" && answers.persons[scope.personIndex] === undefined) return null
    return { answers, personIndex: scope.personIndex, on }
  }

  function absolutePath(scope: Scope, path: string): string {
    return resolveQuestionPath(scope.content.scope, scope.personIndex, path)
  }

  function locateRepeater(stepId: Saca2StepId, path: string, person: 0 | 1 | undefined) {
    const scope = resolveScope(stepId, person)
    const question = findInStep(scope.content, path)
    if (!question?.repeater) throw new Error(`No repeater at path "${path}" in step "${stepId}"`)
    return { scope, question, repeater: question.repeater }
  }

  /** The repeater's rows and context, or `null` when its step or the repeater itself is hidden. */
  function readRows(located: ReturnType<typeof locateRepeater>, path: string) {
    const ctx = ctxFor(located.scope)
    if (!ctx || !isQuestionVisible(located.question, ctx)) return null
    const value = getAtPath(answers, absolutePath(located.scope, path))
    const rows = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
    return { rows, ctx }
  }

  return {
    get(source) {
      if (source.kind === "derived") {
        throw new Error(`Source "${source.id}" is derived; pdf-fill resolves derived sources`)
      }
      if (source.kind === "answer") {
        const scope = resolveScope(source.stepId, source.person)
        const question = findInStep(scope.content, source.path)
        if (!question) throw new Error(`No question at path "${source.path}" in step "${source.stepId}"`)
        const ctx = ctxFor(scope)
        if (!ctx || !isQuestionVisible(question, ctx)) return undefined
        return getAtPath(answers, absolutePath(scope, source.path))
      }

      const located = locateRepeater(source.stepId, source.path, source.person)
      // `key` names an item question by id first (income rows reuse one row field, e.g. `description`,
      // under several ids with different visibility), then by path; the value is stored under the path.
      const itemQuestion =
        located.repeater.questions.find((q) => q.id === source.key) ?? findQuestion(located.repeater.questions, source.key)
      if (!itemQuestion) throw new Error(`No item question "${source.key}" in repeater "${source.path}"`)
      const read = readRows(located, source.path)
      const row = read?.rows[source.index]
      if (!read || row === null || typeof row !== "object") return undefined
      if (!isQuestionVisible(itemQuestion, { ...read.ctx, item: row })) return undefined
      return row[itemQuestion.path]
    },

    rows(stepId, path, person) {
      return readRows(locateRepeater(stepId, path, person), path)?.rows.length ?? 0
    },
  }
}
