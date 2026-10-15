/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { isStepVisible } from "../visibility"
import { text, yesNo } from "./builders"
import type { Saca2Question, Saca2QuestionContext, Saca2StepContent } from "./types"

const pca = (ctx: Saca2QuestionContext) => ctx.answers.pca
const needsPca = (ctx: Saca2QuestionContext) => pca(ctx).needsPca === "yes"
/** Step 8 Q3 is asked only when MassHealth has not paid for PCA services in the last six months. */
const asksDisabilityQuestions = (ctx: Saca2QuestionContext) =>
  needsPca(ctx) && pca(ctx).paidByMassHealthLastSixMonths === "no"
const spouseIsPresent = (ctx: Saca2QuestionContext) => isStepVisible("person2", ctx.answers, ctx.on)

function personQuestions(index: 0 | 1, who: string, whose: string, present: (ctx: Saca2QuestionContext) => boolean): Saca2Question[] {
  const row = (ctx: Saca2QuestionContext) => pca(ctx).byPerson[index]
  const base = (ctx: Saca2QuestionContext) => asksDisabilityQuestions(ctx) && present(ctx)
  const blocks = (ctx: Saca2QuestionContext) => base(ctx) && row(ctx)?.permanentDisability === "yes"
  const contact = (ctx: Saca2QuestionContext) => blocks(ctx) && row(ctx)?.disabilityBlocksAdls === "yes"
  return [
    yesNo(`pca.byPerson.${index}.permanentDisability`, `Do ${who} have a permanent or long-lasting disability?`, {
      required: true,
      visibleWhen: base,
    }),
    yesNo(
      `pca.byPerson.${index}.disabilityBlocksAdls`,
      `Does ${whose} disability keep ${who === "you" ? "you" : "your spouse"} from being able to do daily living activities, like bathing, eating, toileting, and dressing, unless someone physically helps?`,
      { required: true, visibleWhen: blocks },
    ),
    yesNo(
      `pca.byPerson.${index}.willContactPcmAgency`,
      `Do ${who} plan to contact a MassHealth personal-care-management (PCM) agency to ask for personal-care-attendant services?`,
      {
        required: true,
        visibleWhen: contact,
        help: "You must contact the PCM agency within 90 days of the date MassHealth decides you are eligible, or you will not be able to benefit from the special PCA rules. If both of you answered Yes to all parts of Question 3, each of you completes your own Supplement C.",
      },
    ),
  ]
}

export const PCA_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "pca",
      title: "Personal-care attendant (PCA) services",
      description: "For people 65 or older who are not going to be in a long-term-care facility.",
      questions: [
        yesNo("pca.needsPca", "Do you need the services of a personal-care attendant?", { required: true }),
        yesNo("pca.paidByMassHealthLastSixMonths", "Have you or your spouse had the services of a personal-care attendant paid for by MassHealth within the last six months?", {
          required: true,
          visibleWhen: needsPca,
          help: "If Yes, you can skip the rest of this step.",
        }),
      ],
    },
    {
      id: "pcaYou",
      title: "About you",
      questions: personQuestions(0, "you", "your", () => true),
    },
    {
      id: "pcaSpouse",
      title: "About your spouse",
      questions: personQuestions(1, "your spouse", "your spouse's", spouseIsPresent),
    },
  ],
}

const additional = (ctx: Saca2QuestionContext) => ctx.answers.health.additionalCoverage

export const ADDITIONAL_COVERAGE_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "additionalCoverage",
      title: "Additional (optional) coverage for married persons younger than 65",
      description: "Answer only for the spouse who is under 65. These questions are optional; MassHealth has special coverage rules for these conditions.",
      questions: [
        yesNo("health.additionalCoverage.breastOrCervicalCancer", "Does the spouse under 65 have breast or cervical cancer?"),
        text("health.additionalCoverage.breastOrCervicalName", "Name of the person with breast or cervical cancer", {
          required: true,
          visibleWhen: (ctx) => additional(ctx).breastOrCervicalCancer === "yes",
        }),
        yesNo("health.additionalCoverage.hivPositive", "Is the spouse under 65 HIV positive?", {
          help: "If you are HIV positive, you may be eligible for additional coverage or benefits.",
        }),
        text("health.additionalCoverage.hivName", "Name of the person who is HIV positive", {
          required: true,
          visibleWhen: (ctx) => additional(ctx).hivPositive === "yes",
        }),
      ],
    },
  ],
}
