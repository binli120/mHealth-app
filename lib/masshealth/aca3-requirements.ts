import aca3Raw from "@/data/aca_3-0235.json"

type RawAnswerType =
  | "text"
  | "text_or_unknown"
  | "single_choice_yes_no"
  | "single_or_multi_choice"
  | "multi_choice"

interface RawFormItem {
  page?: number
  section?: string
  question_id?: string
  question_text?: string
  answer_type?: RawAnswerType
  options?: string[]
}

interface RawAca3Payload {
  form_items?: RawFormItem[]
}

export type Aca3QuestionInputType =
  | "text"
  | "date"
  | "yes_no"
  | "single_choice"
  | "multi_choice"

export type Aca3WorkflowStep = 1 | 2 | 3 | 4 | 5

export type Aca3QuestionResponseValue = string | string[]
export type Aca3QuestionResponses = Record<string, Aca3QuestionResponseValue>

export interface Aca3RequiredQuestion {
  key: string
  page: number
  section: string
  questionId: string
  questionText: string
  inputType: Aca3QuestionInputType
  options: string[]
  workflowStep: Aca3WorkflowStep
}

export interface Aca3RequiredQuestionSection {
  id: string
  title: string
  questions: Aca3RequiredQuestion[]
}

const rawPayload = aca3Raw as RawAca3Payload

function normalizeText(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim()
}

function normalizeOptions(options: string[] | undefined): string[] {
  const unique = new Set<string>()

  for (const option of options || []) {
    const normalized = normalizeText(option)
    if (normalized) {
      unique.add(normalized)
    }
  }

  return Array.from(unique)
}

function inferInputType(item: RawFormItem, options: string[]): Aca3QuestionInputType {
  const answerType = item.answer_type
  const questionText = normalizeText(item.question_text).toLowerCase()
  const hasYesNoOptions =
    options.some((option) => option.toLowerCase() === "yes") &&
    options.some((option) => option.toLowerCase() === "no")

  if (answerType === "single_choice_yes_no" || hasYesNoOptions) {
    return "yes_no"
  }

  if (answerType === "multi_choice") {
    return "multi_choice"
  }

  if (answerType === "single_or_multi_choice") {
    return questionText.includes("select up to") ? "multi_choice" : "single_choice"
  }

  if (answerType === "text" || answerType === "text_or_unknown") {
    return questionText.includes("date") ? "date" : "text"
  }

  if (options.length > 1) {
    return "single_choice"
  }

  return questionText.includes("date") ? "date" : "text"
}

function inferWorkflowStep(section: string, questionText: string): Aca3WorkflowStep {
  const source = `${section} ${questionText}`.toLowerCase()

  if (
    source.includes("person 2") ||
    source.includes("person 3") ||
    source.includes("person 4") ||
    source.includes("household") ||
    source.includes("dependent") ||
    source.includes("relationship") ||
    source.includes("pregnan") ||
    source.includes("parental") ||
    source.includes("spouse") ||
    source.includes("child")
  ) {
    return 2
  }

  if (
    source.includes("income") ||
    source.includes("employer") ||
    source.includes("wage") ||
    source.includes("salary") ||
    source.includes("self-employment") ||
    source.includes("social security") ||
    source.includes("pension") ||
    source.includes("unemployment") ||
    source.includes("tax return")
  ) {
    return 3
  }

  if (
    source.includes("asset") ||
    source.includes("bank account") ||
    source.includes("investment") ||
    source.includes("real estate") ||
    source.includes("property")
  ) {
    return 4
  }

  if (
    source.includes("step 9") ||
    source.includes("send us your completed application") ||
    source.includes("step 7") ||
    source.includes("step 5: your household's health coverage") ||
    source.includes("step 4: previous medical bills") ||
    source.includes("signature")
  ) {
    return 5
  }

  return 1
}

function buildRequiredQuestions(): Aca3RequiredQuestion[] {
  const questions: Aca3RequiredQuestion[] = []

  for (const [index, item] of (rawPayload.form_items || []).entries()) {
    const questionText = normalizeText(item.question_text)

    if (!questionText) {
      continue
    }

    const section = normalizeText(item.section) || "General"
    const options = normalizeOptions(item.options)

    questions.push({
      key: `aca3-q-${String(index + 1).padStart(3, "0")}`,
      page: item.page || 0,
      section,
      questionId: normalizeText(item.question_id) || `${index + 1}`,
      questionText,
      inputType: inferInputType(item, options),
      options,
      workflowStep: inferWorkflowStep(section, questionText),
    })
  }

  return questions
}

export const ACA3_REQUIRED_QUESTIONS = buildRequiredQuestions()

export const ACA3_REQUIRED_QUESTION_SECTIONS: Aca3RequiredQuestionSection[] =
  ACA3_REQUIRED_QUESTIONS.reduce<Aca3RequiredQuestionSection[]>((sections, question) => {
    const existing = sections.find((section) => section.title === question.section)

    if (existing) {
      existing.questions.push(question)
      return sections
    }

    sections.push({
      id: `section-${sections.length + 1}`,
      title: question.section,
      questions: [question],
    })
    return sections
  }, [])

const ACA3_WORKFLOW_STEPS: Aca3WorkflowStep[] = [1, 2, 3, 4, 5]

export const ACA3_REQUIRED_QUESTION_SECTIONS_BY_STEP: Record<
  Aca3WorkflowStep,
  Aca3RequiredQuestionSection[]
> = ACA3_WORKFLOW_STEPS.reduce(
  (byStep, step) => {
    byStep[step] = []
    return byStep
  },
  {} as Record<Aca3WorkflowStep, Aca3RequiredQuestionSection[]>,
)

for (const question of ACA3_REQUIRED_QUESTIONS) {
  const stepSections = ACA3_REQUIRED_QUESTION_SECTIONS_BY_STEP[question.workflowStep]
  const existing = stepSections.find((section) => section.title === question.section)

  if (existing) {
    existing.questions.push(question)
    continue
  }

  stepSections.push({
    id: `step-${question.workflowStep}-section-${stepSections.length + 1}`,
    title: question.section,
    questions: [question],
  })
}

export function isAca3QuestionAnswered(
  question: Aca3RequiredQuestion,
  responses: Aca3QuestionResponses,
): boolean {
  const response = responses[question.key]

  if (Array.isArray(response)) {
    return response.some((value) => normalizeText(value).length > 0)
  }

  if (typeof response === "string") {
    return normalizeText(response).length > 0
  }

  return false
}

export function getMissingAca3Questions(
  responses: Aca3QuestionResponses,
): Aca3RequiredQuestion[] {
  return ACA3_REQUIRED_QUESTIONS.filter(
    (question) => !isAca3QuestionAnswered(question, responses),
  )
}

export function getAca3QuestionCompletion(
  responses: Aca3QuestionResponses,
): {
  answered: number
  total: number
  missing: number
} {
  const total = ACA3_REQUIRED_QUESTIONS.length
  const missing = getMissingAca3Questions(responses).length

  return {
    answered: total - missing,
    total,
    missing,
  }
}
