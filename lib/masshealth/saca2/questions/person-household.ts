/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import {
  ACCOMMODATION_CONDITION_KEYS,
  ACCOMMODATION_CONDITION_LABELS,
  ACCOMMODATION_KEYS,
  ACCOMMODATION_LABELS,
  countChecked,
} from "../demographic-options"
import type { CaregiverChild, Saca2Answers } from "../types"
import { checkbox, date, number, opts, repeater, select, text, yesNo } from "./builders"
import { applying, person, who } from "./person-context"
import type { Saca2Question, Saca2QuestionContext, Saca2Section } from "./types"
import { validateStateCode } from "./validators"

const caresForChild = (ctx: Saca2QuestionContext) => applying(ctx) && person(ctx)?.caregiverOfChildUnder19 === "yes"
const pregnant = (ctx: Saca2QuestionContext) => applying(ctx) && person(ctx)?.pregnant === "yes"
const inFosterCare = (ctx: Saca2QuestionContext) => applying(ctx) && person(ctx)?.everInFosterCare === "yes"
/** Q20 is asked of every person, applying or not. */
const needsAccommodation = (ctx: Saca2QuestionContext) => person(ctx)?.needsAccommodation === "yes"
const conditionOther = (ctx: Saca2QuestionContext) => needsAccommodation(ctx) && Boolean(person(ctx)?.accommodationConditions.other)
const accommodationOther = (ctx: Saca2QuestionContext) => needsAccommodation(ctx) && Boolean(person(ctx)?.accommodations.other)

function validateBabies(value: unknown): string | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10
    ? null
    : "Enter a whole number from 1 to 10."
}

const conditionBoxes: Saca2Question[] = ACCOMMODATION_CONDITION_KEYS.map((key) =>
  checkbox(`accommodationConditions.${key}`, ACCOMMODATION_CONDITION_LABELS[key], { visibleWhen: needsAccommodation }),
)
const accommodationBoxes: Saca2Question[] = ACCOMMODATION_KEYS.map((key) =>
  checkbox(`accommodations.${key}`, ACCOMMODATION_LABELS[key], { visibleWhen: needsAccommodation }),
)

/** Form Q15-18 and Q20 (Person 2: Q25-28 and Q30). */
export const HOUSEHOLD_SECTION: Saca2Section = {
  id: "household",
  title: "Household, housing, and accommodations",
  questions: [
    repeater(
      "caregiverChildren",
      who("Names and dates of birth of the children", "Names and dates of birth of the children"),
      {
        questions: [
          text("name", "Child's name", { required: true }),
          date("dateOfBirth", "Child's date of birth", { required: true }),
        ],
        emptyItem: () => ({ name: "", dateOfBirth: null }) satisfies CaregiverChild,
        addLabel: "Add a child",
        itemTitle: "Child",
        maxItems: 6,
      },
      { required: caresForChild, visibleWhen: caresForChild },
    ),
    yesNo("pregnant", who("Are you pregnant?", "Is this person pregnant?"), { required: applying, visibleWhen: applying }),
    number(
      "babiesExpected",
      who("How many babies are you expecting?", "How many babies are they expecting?"),
      { required: true, visibleWhen: pregnant, validate: validateBabies },
    ),
    date("dueDate", "What is the expected due date?", { required: true, visibleWhen: pregnant }),
    yesNo("everInFosterCare", who("Were you ever in foster care?", "Was this person ever in foster care?"), {
      required: applying,
      visibleWhen: applying,
    }),
    text(
      "fosterCareState",
      who("In what state were you in foster care?", "In what state was this person in foster care?"),
      { required: true, visibleWhen: inFosterCare, validate: validateStateCode },
    ),
    yesNo(
      "fosterCareMedicaid",
      who(
        "Did you get health care through a state Medicaid program?",
        "Was this person getting health care through a state Medicaid program?",
      ),
      { required: inFosterCare, visibleWhen: inFosterCare },
    ),
    select(
      "rentOrOwn",
      who("Do you rent or own your property?", "Does this person rent or own their property?"),
      opts([["rent", "Rent"], ["own", "Own"]]),
      { required: applying, visibleWhen: applying },
    ),
    yesNo(
      "needsAccommodation",
      who(
        "Do you need reasonable accommodation(s) because of a disability or injury?",
        "Does this person need reasonable accommodation(s) because of a disability or injury?",
      ),
      { required: true },
    ),
  ],
}

/** Q20a and Q20b (Person 2: Q30a and Q30b) get their own sections so the checkboxes sit under their prompts. */
export const ACCOMMODATION_CONDITIONS_SECTION: Saca2Section = {
  id: "accommodationConditions",
  title: "Condition",
  questions: [
    ...conditionBoxes,
    text("accommodationConditionOther", "Condition: please explain", { required: true, visibleWhen: conditionOther }),
  ],
}

export const ACCOMMODATION_TYPES_SECTION: Saca2Section = {
  id: "accommodationTypes",
  title: "Accommodation",
  questions: [
    ...accommodationBoxes,
    text("accommodationOther", "Accommodation: please explain", { required: true, visibleWhen: accommodationOther }),
  ],
}

/** Q20 a and b each need at least one box ticked when accommodations are needed. */
export function validateAccommodations(answers: Saca2Answers, personIndex: number): Record<string, string> {
  const p = answers.persons[personIndex]
  if (!p || p.needsAccommodation !== "yes") return {}
  const errors: Record<string, string> = {}
  if (countChecked(p.accommodationConditions) === 0) {
    errors[`persons.${personIndex}.accommodationConditions.${ACCOMMODATION_CONDITION_KEYS[0]}`] = "Select at least one."
  }
  if (countChecked(p.accommodations) === 0) {
    errors[`persons.${personIndex}.accommodations.${ACCOMMODATION_KEYS[0]}`] = "Select at least one."
  }
  return errors
}
