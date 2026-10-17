/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import {
  ETHNICITY_KEYS,
  ETHNICITY_LABELS,
  GENDER_IDENTITY_KEYS,
  GENDER_IDENTITY_LABELS,
  RACE_KEYS,
  RACE_LABELS,
  SEXUAL_ORIENTATION_KEYS,
  SEXUAL_ORIENTATION_LABELS,
  countChecked,
} from "../demographic-options"
import type { Saca2Answers } from "../types"
import { checkbox, opts, select, text } from "./builders"
import { applying, person, who } from "./person-context"
import type { Saca2Question, Saca2QuestionContext, Saca2Section } from "./types"

type CheckGroup = "genderIdentity" | "sexualOrientation" | "race" | "ethnicity"

const ticked = (group: CheckGroup, key: string) => (ctx: Saca2QuestionContext) =>
  applying(ctx) && Boolean((person(ctx)?.demographics[group] as Record<string, boolean>)[key])

function checkGroup<K extends string>(
  group: CheckGroup,
  keys: readonly K[],
  labels: Record<K, string>,
  otherPath: string,
): Saca2Question[] {
  return [
    ...keys.map((key) => checkbox(`demographics.${group}.${key}`, labels[key], { visibleWhen: applying })),
    text(otherPath, "Please specify", { required: true, visibleWhen: ticked(group, "notListed") }),
  ]
}

export const DEMOGRAPHICS_SECTION: Saca2Section = {
  id: "demographics",
  title: "Optional: language and cultural needs",
  description:
    "MassHealth is committed to providing equitable care for all members regardless of race, ethnicity, gender, sexual orientation, or language spoken. Your answers are voluntary and will not affect eligibility or be used for any discriminatory purpose.",
  questions: [
    ...checkGroup("genderIdentity", GENDER_IDENTITY_KEYS, GENDER_IDENTITY_LABELS, "demographics.genderIdentityOther"),
    ...checkGroup("sexualOrientation", SEXUAL_ORIENTATION_KEYS, SEXUAL_ORIENTATION_LABELS, "demographics.sexualOrientationOther"),
    select(
      "demographics.hispanicOrLatino",
      who("Are you of Hispanic or Latino origin or descent?", "Is this person of Hispanic or Latino origin or descent?"),
      opts([
        ["yes", "Yes, Hispanic or Latino"],
        ["no", "No, not Hispanic or Latino"],
        ["dontKnow", "Don't know"],
        ["declined", "Choose not to answer"],
      ]),
      { visibleWhen: applying },
    ),
    ...checkGroup("race", RACE_KEYS, RACE_LABELS, "demographics.raceOther"),
    ...checkGroup("ethnicity", ETHNICITY_KEYS, ETHNICITY_LABELS, "demographics.ethnicityOther"),
  ],
}

const CAPPED: Array<{ group: "genderIdentity" | "sexualOrientation"; first: string }> = [
  { group: "genderIdentity", first: GENDER_IDENTITY_KEYS[0] },
  { group: "sexualOrientation", first: SEXUAL_ORIENTATION_KEYS[0] },
]

/** "Select up to five options" for gender identity and sexual orientation. */
export function validateDemographics(answers: Saca2Answers, personIndex: number): Record<string, string> {
  const p = answers.persons[personIndex]
  if (!p || p.applyingForCoverage !== "yes") return {}
  const errors: Record<string, string> = {}
  for (const { group, first } of CAPPED) {
    if (countChecked(p.demographics[group]) > 5) {
      errors[`persons.${personIndex}.demographics.${group}.${first}`] = "Select up to five options."
    }
  }
  return errors
}
