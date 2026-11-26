/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { DailyLivingActivity } from "../types"
import { isStepVisible } from "../visibility"
import { number, repeater, text, yesNo } from "./builders"
import type { Saca2Question, Saca2QuestionContext, Saca2Section, Saca2StepContent } from "./types"

interface Wording {
  /** "Do you" / "Does your spouse" */
  ask: string
  /** "you" / "your spouse" */
  subject: string
  /** "your" / "your spouse's" */
  possessive: string
  /** "you" / "your spouse" */
  object: string
  /** "do" / "does" */
  aux: string
  /** "are" / "is" */
  be: string
}

const YOU: Wording = { ask: "Do you", subject: "you", possessive: "your", object: "you", aux: "do", be: "are" }
const SPOUSE: Wording = { ask: "Does your spouse", subject: "your spouse", possessive: "your spouse's", object: "your spouse", aux: "does", be: "is" }

const ACTIVITIES: Array<{ key: DailyLivingActivity; helpWith: string; short: string }> = [
  { key: "mobility", helpWith: "mobility (moving from bed to chair, walking, or using approved medical equipment)", short: "mobility" },
  { key: "medications", helpWith: "taking medications", short: "taking medications" },
  { key: "bathing", helpWith: "bathing (tub, bed bath, shower, or washing chair) or general grooming (like brushing teeth or combing hair)", short: "bathing or grooming" },
  { key: "dressing", helpWith: "dressing or undressing", short: "dressing or undressing" },
  { key: "rangeOfMotion", helpWith: "range-of-motion exercises (exercising joints by moving them)", short: "range-of-motion exercises" },
  { key: "eating", helpWith: "eating", short: "eating" },
  { key: "toileting", helpWith: "toileting (like getting on or off the toilet, wiping, getting clothes off and on, or changing diapers)", short: "toileting" },
]

const pca = (ctx: Saca2QuestionContext) => ctx.answers.pca

/** A person gets their own Supplement C when every PCA question 3 answer is Yes. */
function qualifies(index: 0 | 1) {
  return (ctx: Saca2QuestionContext): boolean => {
    const entry = pca(ctx).byPerson[index]
    const allYes =
      entry?.permanentDisability === "yes" && entry.disabilityBlocksAdls === "yes" && entry.willContactPcmAgency === "yes"
    const spouseOk = index === 0 || isStepVisible("person2", ctx.answers, ctx.on)
    return pca(ctx).needsPca === "yes" && pca(ctx).paidByMassHealthLastSixMonths !== "yes" && allYes && spouseOk
  }
}

const integerInRange = (min: number, max: number, message: string) => (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? null : message

function personSection(index: 0 | 1, w: Wording, title: string): Saca2Section {
  const base = `supplements.c.${index}`
  const visibleWhen = qualifies(index)
  const questions: Saca2Question[] = [
    text(`${base}.healthProblems.0`, `List and describe ${w.possessive} medical and mental health problems (including anything that makes it hard to do daily living activities, even if ${w.subject} ${w.be} not getting treatment)`, {
      required: true,
      visibleWhen,
    }),
    text(`${base}.healthProblems.1`, "Another health problem", { visibleWhen }),
    text(`${base}.healthProblems.2`, "Another health problem", { visibleWhen }),
  ]

  for (const activity of ACTIVITIES) {
    const helpPath = `${base}.activities.${activity.key}`
    const needsHelp = (ctx: Saca2QuestionContext) =>
      visibleWhen(ctx) && ctx.answers.supplements.c[index]?.activities[activity.key]?.needsHandsOnHelp === "yes"
    questions.push(
      yesNo(`${helpPath}.needsHandsOnHelp`, `${w.ask} need hands-on help from another person with ${activity.helpWith}?`, {
        required: true,
        visibleWhen,
      }),
      number(`${helpPath}.timesPerDay`, `How many times a day ${w.aux} ${w.subject} need hands-on help with ${activity.short}?`, {
        required: true,
        visibleWhen: needsHelp,
        validate: integerInRange(1, 20, "Enter a whole number from 1 to 20."),
      }),
      number(`${helpPath}.daysPerWeek`, `How many days a week ${w.aux} ${w.subject} need hands-on help with ${activity.short}?`, {
        required: true,
        visibleWhen: needsHelp,
        validate: integerInRange(1, 7, "Enter a whole number from 1 to 7."),
      }),
    )
  }

  questions.push(
    repeater(
      `${base}.caregivers`,
      `People who now help ${w.object}`,
      {
        questions: [
          text("name", "Caregiver name", { required: true }),
          text("relationship", `Relationship to ${w.object} (like relative, neighbor, personal-care attendant)`, { required: true }),
        ],
        emptyItem: () => ({ name: "", relationship: "" }),
        addLabel: "Add a caregiver",
        itemTitle: "Caregiver",
        maxItems: 2,
      },
      { visibleWhen },
    ),
  )

  return { id: `suppC${index}`, title, questions }
}

export const SUPPLEMENT_C_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [personSection(0, YOU, "Personal-care attendant: you"), personSection(1, SPOUSE, "Personal-care attendant: your spouse")],
}
