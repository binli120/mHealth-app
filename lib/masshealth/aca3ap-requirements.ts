/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import aca3apRaw from '@/data/aca_3ap-0325.json';
import { AnswerType } from './types';
import type {
  Aca3QuestionInputType,
  Aca3WorkflowStep,
  Aca3QuestionResponseValue,
  Aca3QuestionResponses,
  Aca3RequiredQuestion,
  Aca3RequiredQuestionSection,
} from './types';

// Re-export shared question types for consumers.
export type {
  Aca3QuestionInputType,
  Aca3WorkflowStep,
  Aca3QuestionResponseValue,
  Aca3QuestionResponses,
  Aca3RequiredQuestion,
  Aca3RequiredQuestionSection,
};

type RawAnswerType =
  | 'text'
  | 'text_or_unknown'
  | 'single_choice_yes_no'
  | 'single_or_multi_choice'
  | 'multi_choice';

interface RawFormItem {
  page?: number;
  section?: string;
  question_id?: string;
  question_text?: string;
  answer_type?: RawAnswerType;
  options?: string[];
}

interface RawAca3ApPayload {
  form_items?: RawFormItem[];
}

const rawPayload = aca3apRaw as RawAca3ApPayload;

function normalizeText(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeOptions(options: string[] | undefined): string[] {
  const unique = new Set<string>();
  for (const option of options || []) {
    const normalized = normalizeText(option);
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique);
}

function inferInputType(
  item: RawFormItem,
  options: string[],
): Aca3QuestionInputType {
  const answerType = item.answer_type;
  const questionText = normalizeText(item.question_text).toLowerCase();
  const hasYesNoOptions =
    options.some((o) => o.toLowerCase() === 'yes') &&
    options.some((o) => o.toLowerCase() === 'no');

  if (answerType === 'single_choice_yes_no' || hasYesNoOptions) {
    return AnswerType.YesNo;
  }
  if (answerType === 'multi_choice') {
    return AnswerType.MultiChoice;
  }
  if (answerType === 'single_or_multi_choice') {
    return questionText.includes('select up to') ? AnswerType.MultiChoice : 'single_choice';
  }
  if (answerType === AnswerType.Text || answerType === AnswerType.TextOrUnknown) {
    return questionText.includes('date') ? AnswerType.Date : AnswerType.Text;
  }
  if (options.length > 1) return 'single_choice';
  return questionText.includes('date') ? AnswerType.Date : AnswerType.Text;
}

/**
 * ACA-3-AP workflow steps:
 *  1 — Existing application info + additional person personal details
 *  2 — Citizenship and immigration status
 *  3 — Massachusetts residency
 *  4 — Income
 *  5 — Health coverage + signature
 */
const ACA3AP_WORKFLOW_STEP_RULES: ReadonlyArray<{
  step: Aca3WorkflowStep;
  patterns: ReadonlyArray<string | RegExp>;
}> = [
  {
    step: 2,
    patterns: ['citizenship', 'immigration', 'citizen', 'noncitizen', 'immigrant', 'visa', 'document'],
  },
  {
    step: 3,
    patterns: ['residency', 'residence', 'address', 'city', 'zip', 'live in massachusetts'],
  },
  {
    step: 4,
    patterns: ['income', 'wage', 'salary', 'employer', 'self-employment', 'social security', 'pension', 'unemployment', 'alimony', 'rental'],
  },
  {
    step: 5,
    patterns: ['health coverage', 'insurance', 'pregnant', 'disability', 'signature', 'authorization', 'sign'],
  },
];

function matchesPattern(source: string, pattern: string | RegExp): boolean {
  return typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source);
}

function inferWorkflowStep(section: string, questionText: string): Aca3WorkflowStep {
  const source = `${section} ${questionText}`.toLowerCase();
  for (const { step, patterns } of ACA3AP_WORKFLOW_STEP_RULES) {
    if (patterns.some((p) => matchesPattern(source, p))) return step;
  }
  return 1;
}

function buildAca3ApRequiredQuestions(): Aca3RequiredQuestion[] {
  const questions: Aca3RequiredQuestion[] = [];
  for (const [index, item] of (rawPayload.form_items || []).entries()) {
    const questionText = normalizeText(item.question_text);
    if (!questionText) continue;
    const section = normalizeText(item.section) || 'General';
    const options = normalizeOptions(item.options);
    questions.push({
      key: `aca3ap-q-${String(index + 1).padStart(3, '0')}`,
      page: item.page || 0,
      section,
      questionId: normalizeText(item.question_id) || `${index + 1}`,
      questionText,
      inputType: inferInputType(item, options),
      options,
      workflowStep: inferWorkflowStep(section, questionText),
    });
  }
  return questions;
}

export const ACA3AP_REQUIRED_QUESTIONS = buildAca3ApRequiredQuestions();

export const ACA3AP_REQUIRED_QUESTION_SECTIONS: Aca3RequiredQuestionSection[] =
  ACA3AP_REQUIRED_QUESTIONS.reduce<Aca3RequiredQuestionSection[]>(
    (sections, question) => {
      const existing = sections.find((s) => s.title === question.section);
      if (existing) {
        existing.questions.push(question);
        return sections;
      }
      sections.push({
        id: `aca3ap-section-${sections.length + 1}`,
        title: question.section,
        questions: [question],
      });
      return sections;
    },
    [],
  );

const ACA3AP_WORKFLOW_STEPS: Aca3WorkflowStep[] = [1, 2, 3, 4, 5];

export const ACA3AP_REQUIRED_QUESTION_SECTIONS_BY_STEP: Record<
  Aca3WorkflowStep,
  Aca3RequiredQuestionSection[]
> = ACA3AP_WORKFLOW_STEPS.reduce(
  (byStep, step) => {
    byStep[step] = [];
    return byStep;
  },
  {} as Record<Aca3WorkflowStep, Aca3RequiredQuestionSection[]>,
);

for (const question of ACA3AP_REQUIRED_QUESTIONS) {
  const stepSections = ACA3AP_REQUIRED_QUESTION_SECTIONS_BY_STEP[question.workflowStep];
  const existing = stepSections.find((s) => s.title === question.section);
  if (existing) {
    existing.questions.push(question);
    continue;
  }
  stepSections.push({
    id: `aca3ap-step-${question.workflowStep}-section-${stepSections.length + 1}`,
    title: question.section,
    questions: [question],
  });
}

export function isAca3ApQuestionAnswered(
  question: Aca3RequiredQuestion,
  responses: Aca3QuestionResponses,
): boolean {
  const response = responses[question.key];
  if (Array.isArray(response)) return response.some((v) => normalizeText(v).length > 0);
  if (typeof response === 'string') return normalizeText(response).length > 0;
  return false;
}

export function getMissingAca3ApQuestions(
  responses: Aca3QuestionResponses,
): Aca3RequiredQuestion[] {
  return ACA3AP_REQUIRED_QUESTIONS.filter(
    (q) => !isAca3ApQuestionAnswered(q, responses),
  );
}

export function getAca3ApQuestionCompletion(responses: Aca3QuestionResponses): {
  answered: number;
  total: number;
  missing: number;
} {
  const total = ACA3AP_REQUIRED_QUESTIONS.length;
  const missing = getMissingAca3ApQuestions(responses).length;
  return { answered: total - missing, total, missing };
}
