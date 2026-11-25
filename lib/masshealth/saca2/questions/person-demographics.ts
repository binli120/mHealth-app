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

const CAP_NOTE = "Select up to five options."

/**
 * Each checkbox group is its own section so the step form can show the form's question text above it.
 * The first section keeps the `demographics` id and carries the optional-demographics intro.
 */
export const DEMOGRAPHICS_SECTION: Saca2Section = {
  id: "demographics",
  title: who(`Which best describes your current gender identity? ${CAP_NOTE}`, `Which best describes this person's current gender identity? ${CAP_NOTE}`),
  description:
    "Optional. MassHealth is committed to providing equitable care for all members regardless of race, ethnicity, gender, sexual orientation, or language spoken. Your answers are voluntary and will not affect eligibility or be used for any discriminatory purpose. Gender identity is how a person defines and understands their gender as a man, a woman, nonbinary, gender nonconforming, transgender, or something else.",
  questions: checkGroup("genderIdentity", GENDER_IDENTITY_KEYS, GENDER_IDENTITY_LABELS, "demographics.genderIdentityOther"),
}

export const DEMOGRAPHICS_ORIENTATION_SECTION: Saca2Section = {
  id: "demographicsOrientation",
  title: who(`Which of these describes your current sexual orientation? ${CAP_NOTE}`, `Which of these describes this person's current sexual orientation? ${CAP_NOTE}`),
  description: "Sexual orientation describes how a person defines their physical and/or emotional attraction to others.",
  questions: checkGroup("sexualOrientation", SEXUAL_ORIENTATION_KEYS, SEXUAL_ORIENTATION_LABELS, "demographics.sexualOrientationOther"),
}

export const DEMOGRAPHICS_ORIGIN_SECTION: Saca2Section = {
  id: "demographicsOrigin",
  title: "Hispanic or Latino origin",
  description:
    "Hispanic or Latino refers to someone of Cuban, Mexican, Puerto Rican, South or Central American, or other Spanish culture or origin regardless of race.",
  questions: [
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
  ],
}

export const DEMOGRAPHICS_RACE_SECTION: Saca2Section = {
  id: "demographicsRace",
  title: "Race",
  description: "Race refers to a person's self-identification with one or more social groups. You may report multiple races.",
  questions: checkGroup("race", RACE_KEYS, RACE_LABELS, "demographics.raceOther"),
}

export const DEMOGRAPHICS_ETHNICITY_SECTION: Saca2Section = {
  id: "demographicsEthnicity",
  title: "Ethnicity",
  description: who(
    "Ethnicity refers to your background, heritage, culture, ancestry, or the country where you or your family were born.",
    "Ethnicity refers to this person's background, heritage, culture, ancestry, or the country where they or their family were born.",
  ),
  questions: checkGroup("ethnicity", ETHNICITY_KEYS, ETHNICITY_LABELS, "demographics.ethnicityOther"),
}

export const DEMOGRAPHICS_SECTIONS: Saca2Section[] = [
  DEMOGRAPHICS_SECTION,
  DEMOGRAPHICS_ORIENTATION_SECTION,
  DEMOGRAPHICS_ORIGIN_SECTION,
  DEMOGRAPHICS_RACE_SECTION,
  DEMOGRAPHICS_ETHNICITY_SECTION,
]

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
