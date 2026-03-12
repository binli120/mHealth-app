import aca3Raw from '@/data/aca_3-0235.json';
import { AnswerType } from './types';

// Re-export ACA-3 question types so existing consumers keep working.
export type {
  Aca3QuestionInputType,
  Aca3WorkflowStep,
  Aca3QuestionResponseValue,
  Aca3QuestionResponses,
  Aca3RequiredQuestion,
  Aca3RequiredQuestionSection,
} from './types';

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

interface RawAca3Payload {
  form_items?: RawFormItem[];
}

const rawPayload = aca3Raw as RawAca3Payload;

function normalizeText(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeOptions(options: string[] | undefined): string[] {
  const unique = new Set<string>();

  for (const option of options || []) {
    const normalized = normalizeText(option);
    if (normalized) {
      unique.add(normalized);
    }
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
    options.some((option) => option.toLowerCase() === 'yes') &&
    options.some((option) => option.toLowerCase() === 'no');

  if (answerType === 'single_choice_yes_no' || hasYesNoOptions) {
    return AnswerType.YesNo;
  }

  if (answerType === 'multi_choice') {
    return AnswerType.MultiChoice;
  }

  if (answerType === 'single_or_multi_choice') {
    return questionText.includes('select up to')
      ? AnswerType.MultiChoice
      : 'single_choice';
  }

  if (
    answerType === AnswerType.Text ||
    answerType === AnswerType.TextOrUnknown
  ) {
    return questionText.includes('date') ? AnswerType.Date : AnswerType.Text;
  }

  if (options.length > 1) {
    return 'single_choice';
  }

  return questionText.includes('date') ? AnswerType.Date : AnswerType.Text;
}

/**
 * Ordered rules: the first matching entry wins.
 * Use a RegExp for multi-value patterns (e.g. "person N") and plain strings
 * for everything else.  Add or adjust entries here without touching the
 * function logic below.
 */
const WORKFLOW_STEP_RULES: ReadonlyArray<{
  step: Aca3WorkflowStep;
  patterns: ReadonlyArray<string | RegExp>;
}> = [
  {
    // Step 2 — Household members & family details
    step: 2,
    patterns: [
      /\bperson \d+\b/, // "Person 2", "Person 3", … — generalized from literals
      'household',
      'dependent',
      'relationship',
      'pregnan',         // covers "pregnant" and "pregnancy"
      'parental',
      'spouse',
      'child',
    ],
  },
  {
    // Step 3 — Income & employment
    step: 3,
    patterns: [
      'income',
      'employer',
      'wage',
      'salary',
      'self-employment',
      'social security',
      'pension',
      'unemployment',
      'tax return',
    ],
  },
  {
    // Step 4 — Assets
    step: 4,
    patterns: ['asset', 'bank account', 'investment', 'real estate', 'property'],
  },
  {
    // Step 5 — Submission, signatures, and late-stage form steps
    step: 5,
    patterns: [
      'step 9',
      'step 7',
      "step 5: your household's health coverage",
      'step 4: previous medical bills',
      'send us your completed application',
      'signature',
    ],
  },
];

function matchesPattern(source: string, pattern: string | RegExp): boolean {
  return typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source);
}

function inferWorkflowStep(
  section: string,
  questionText: string,
): Aca3WorkflowStep {
  const source = `${section} ${questionText}`.toLowerCase();

  for (const { step, patterns } of WORKFLOW_STEP_RULES) {
    if (patterns.some((p) => matchesPattern(source, p))) {
      return step;
    }
  }

  return 1; // Step 1 — Applicant personal info (default)
}

function buildRequiredQuestions(): Aca3RequiredQuestion[] {
  const questions: Aca3RequiredQuestion[] = [];

  for (const [index, item] of (rawPayload.form_items || []).entries()) {
    const questionText = normalizeText(item.question_text);

    if (!questionText) {
      continue;
    }

    const section = normalizeText(item.section) || 'General';
    const options = normalizeOptions(item.options);

    questions.push({
      key: `aca3-q-${String(index + 1).padStart(3, '0')}`,
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

export const ACA3_REQUIRED_QUESTIONS = buildRequiredQuestions();

export const ACA3_REQUIRED_QUESTION_SECTIONS: Aca3RequiredQuestionSection[] =
  ACA3_REQUIRED_QUESTIONS.reduce<Aca3RequiredQuestionSection[]>(
    (sections, question) => {
      const existing = sections.find(
        (section) => section.title === question.section,
      );

      if (existing) {
        existing.questions.push(question);
        return sections;
      }

      sections.push({
        id: `section-${sections.length + 1}`,
        title: question.section,
        questions: [question],
      });
      return sections;
    },
    [],
  );

const ACA3_WORKFLOW_STEPS: Aca3WorkflowStep[] = [1, 2, 3, 4, 5];

export const ACA3_REQUIRED_QUESTION_SECTIONS_BY_STEP: Record<
  Aca3WorkflowStep,
  Aca3RequiredQuestionSection[]
> = ACA3_WORKFLOW_STEPS.reduce(
  (byStep, step) => {
    byStep[step] = [];
    return byStep;
  },
  {} as Record<Aca3WorkflowStep, Aca3RequiredQuestionSection[]>,
);

for (const question of ACA3_REQUIRED_QUESTIONS) {
  const stepSections =
    ACA3_REQUIRED_QUESTION_SECTIONS_BY_STEP[question.workflowStep];
  const existing = stepSections.find(
    (section) => section.title === question.section,
  );

  if (existing) {
    existing.questions.push(question);
    continue;
  }

  stepSections.push({
    id: `step-${question.workflowStep}-section-${stepSections.length + 1}`,
    title: question.section,
    questions: [question],
  });
}

export function isAca3QuestionAnswered(
  question: Aca3RequiredQuestion,
  responses: Aca3QuestionResponses,
): boolean {
  const response = responses[question.key];

  if (Array.isArray(response)) {
    return response.some((value) => normalizeText(value).length > 0);
  }

  if (typeof response === 'string') {
    return normalizeText(response).length > 0;
  }

  return false;
}

export function getMissingAca3Questions(
  responses: Aca3QuestionResponses,
): Aca3RequiredQuestion[] {
  return ACA3_REQUIRED_QUESTIONS.filter(
    (question) => !isAca3QuestionAnswered(question, responses),
  );
}

export function getAca3QuestionCompletion(responses: Aca3QuestionResponses): {
  answered: number;
  total: number;
  missing: number;
} {
  const total = ACA3_REQUIRED_QUESTIONS.length;
  const missing = getMissingAca3Questions(responses).length;

  return {
    answered: total - missing,
    total,
    missing,
  };
}
