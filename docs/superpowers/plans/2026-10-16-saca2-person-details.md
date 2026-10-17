# SACA-2 Remaining Person-Block Questions (Phase 1b-3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Person 1 / Person 2 steps so the wizard collects every question on form pages 2–6 (Person 1) and 7–11 (Person 2) that plans 2 and 2b-1 left out: optional demographics, SSN-card name and immigration details, tax / Health Connector answers, child-caregiver, pregnancy, foster-care, rent/own, accommodations, job and self-employment details, other-income details, rental income, one-time income, and tax deductions.

**Architecture:** Same platform as plans 2–2b-2: new typed fields on `Saca2Person` (so they are PHI and per-person automatically), new section modules under `lib/masshealth/saca2/questions/` that `person.ts` composes into `PERSON_STEP_CONTENT`, no new UI components. Multi-select questions are groups of checkbox booleans (the renderer already supports `checkbox`). The `SACA2_ENABLED` flag stays **off**.

**Tech Stack:** TypeScript, Vitest, the existing question model, builders, and validators.

**Spec:** `docs/superpowers/specs/2026-10-13-saca2-application-design.md` (Phase 1b-3). Builds on `2026-10-13-saca2-wizard-core.md`, `2026-10-14-saca2-remaining-steps.md`, `2026-10-14-saca2-supplements.md` (all merged on `dev`).

## Scope and sequence

| Plan | Content | Status |
|---|---|---|
| 1, 2, 2b-1, 2b-2 | foundation; wizard platform; remaining steps; supplements and attachment data | merged |
| **2b-3 (this file)** | remaining Person-block questions | ready |
| 2c (to be written) | the "gate before the flag" items (ungated ACA-3 social-worker and mobile routes, modal resume prompt, Save & Exit backoff, autosave status/retry) | after 2b-3 |
| 3, 4, 5 | PDF fill; eligibility engine; i18n, chat, touchpoints, e2e, rollout | after 2c |

## Decisions made here (easy to change)

1. **Everything per person lives on `Saca2Person`.** Both Person 1 (form Q1–34) and Person 2 (Q1–44) ask the same questions in the same order; one set of section modules serves both, with `who(you, they)` wording as in plan 2.
2. **Multi-select = checkbox groups.** `demographics.genderIdentity.*`, `race.*`, `ethnicity.*`, accommodation conditions and accommodations are fixed-key boolean maps whose key lists are exported constants (`lib/masshealth/saca2/demographic-options.ts`), shared by types, defaults, and question modules. "Select up to five" for gender identity and sexual orientation is enforced in a step-level check.
3. **Demographics (form Q5–9) are optional.** No required flags; they are asked only when the person is applying for coverage (as on the form).
4. **Form routing is followed exactly.** Q5–19 only when applying; Q20 (accommodations) and income (Q22+) for everyone; Q23–30 only when the person has income (form: "If No, skip to question 31"); Q31–34 always (Q33/34 stay gated on `hasIncome` as built in plan 2).
5. **Spouse name/date of birth in the tax section are asked as the form asks**, even when the spouse is Person 2. Pre-filling from Person 2 is a UX improvement for a later plan.
6. **Pregnancy is asked of every applying person** (the form does); it is not inferred from sex at birth.
7. **Income rows gain optional fields rather than new row types.** The existing `income` repeater (plan 2) gets: `employerFederalTaxId`, `effectiveDate`, `seasonal` + twelve `season*` booleans (wages), `description` (self-employment work type / pension source / other-taxable type), `isLoss` (self-employment, capital gains, farming/fishing: monthly net profit or loss), `preTcjaAmount` (alimony finalized before 2019). Two income kinds are added: `capitalGains`, `farmingFishing`. The `rental` kind is **removed from the picker** because Q29 has its own section; rows of that kind from older drafts are ignored by the picker (flag is off, no real drafts exist).
8. **Profit-or-loss kinds are monthly.** For `selfEmployment`, `capitalGains`, and `farmingFishing` the form asks a monthly net amount, so the "How often" select is hidden and not required for those kinds.
9. **Deductions need an explicit answer:** either "None" or at least one yearly amount (form Q32).

## Global Constraints

- Run commands from `/Users/blee/dev/masshealth-repo/mHealth-app` with Node 22: `export PATH=/Users/blee/.nvm/versions/node/v22.23.0/bin:$PATH` (the shell default, Node 18, cannot run vitest).
- Form source of truth: SACA-2_2026-08 PDF, Person 1 pages 2–6, Person 2 pages 7–11, lists on page 32. The text is extracted at `/private/tmp/claude-503/saca/p.txt` (pages 3–12) and the PDF is `~/Downloads/ SACA-2 PDF.pdf`; re-extract with `pdftotext -layout -f 3 -l 12` if needed. Wording follows the form.
- PHI never in the server `draft_state`: all person data is already in the PHI key `persons`; do not add top-level answer keys.
- Every question `path` must resolve to a non-`undefined` default on `emptySaca2Answers()` (the registry test enforces this for person steps too): every field a question reads needs an explicit default in `emptySaca2Person()`.
- Chain-aware visibility (children under a hidden parent never show or block); stale answers under a flipped gate never produce errors.
- Repeater `emptyItem()` returns a complete row and uses `satisfies <Row>` where the row has a named interface.
- Person-specific wording uses `who(you, they)` or an explicit word-parts factory; pin exact strings in a test (lesson from plans 2b-1 and 2b-2).
- Each task that adds required questions must extend `completePerson()` in `lib/masshealth/saca2/__tests__/complete-answers.ts` so the three complete fixtures keep validating (no assertion loosened), and update `questions-content.test.ts` ("passes a complete single applicant" and its neighbours) the same way.
- No `APPROVED`/determination wording; English only. Shared validators (`validateStateCode`, `validateZip`) come from `questions/validators.ts`.
- Repo style: 2-space indent, no semicolons, double quotes, `@author: Bin Lee` / `@email: blee@comura.ai` header on every new file, tests in `__tests__/` next to the module, `@/` imports.
- ACA-3 behaviour must not change; its tests stay green. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Routing exactly as the form**: nothing in Q5–19 is asked of a non-applying person; accommodations and income are asked of everyone; Q23–30 are skipped when `hasIncome` is not yes. → Tasks 2–7.
2. **Stale answers**: flipping `applyingForCoverage`, `usCitizenOrNational`, `isLegallyMarried`, `hasIncome`, `pregnant`, `needsAccommodation`, `rental.hasRentalIncome` back must never leave a hidden required error. → every task.
3. **Checkbox-group questions can be satisfied**: a required "at least one" group (accommodation conditions, accommodations, deductions) can only be satisfied through checkboxes that are visible. → Tasks 5, 7.
4. **Person 2 wording** reads correctly for every new question (no "Do you" for Person 2, no "does you"). → Tasks 3–7.
5. **Hydration of older drafts**: a draft with a person lacking all new fields, with an old `income` row of kind `rental`, or with stale types loads with defaults and never crashes. → Task 1.
6. **Income picker changes** (`rental` removed, two kinds added, monthly kinds hide frequency) do not break existing income tests or the complete fixtures. → Task 6.
7. **The Person step stays completable**: every new required question has a visible, answerable control in the same step. → Task 8 (flow + rich fixture).

---

### Task 1: Shared helpers, option constants, types, defaults

**Files:**
- Create: `lib/masshealth/saca2/demographic-options.ts`
- Create: `lib/masshealth/saca2/questions/person-context.ts`
- Modify: `lib/masshealth/saca2/types.ts`
- Modify: `lib/masshealth/saca2/questions/person.ts` (import the shared helpers instead of defining them locally; behaviour unchanged)
- Test: `lib/masshealth/saca2/__tests__/types.test.ts`, `lib/masshealth/saca2/__tests__/wizard-state.test.ts`

**Interfaces:**
- Produces from `demographic-options.ts` (all `as const` key tuples plus label maps):
  - `GENDER_IDENTITY_KEYS = ["male","female","transMan","transWoman","nonbinary","notListed","dontKnow","declined"]`, `SEXUAL_ORIENTATION_KEYS = ["straight","gayOrLesbian","bisexual","queerPansexual","notListed","dontKnow","declined"]`, `RACE_KEYS = ["americanIndianAlaskaNative","asian","black","nativeHawaiianPacificIslander","white","notListed","dontKnow","declined"]`, `ETHNICITY_KEYS` (38 keys, see Step 3), `ACCOMMODATION_CONDITION_KEYS = ["lowVision","blind","deaf","hardOfHearing","developmentallyDisabled","intellectuallyDisabled","physicallyDisabled","other"]`, `ACCOMMODATION_KEYS = ["tty","largePrint","asl","videoRelay","cart","braille","assistiveListening","electronicFormat","other"]`, `DEDUCTION_KEYS = ["educator","reservistExpenses","hsa","movingExpenses","selfEmploymentTax","selfEmployedRetirement","selfEmployedHealthInsurance","earlyWithdrawalPenalty","alimonyPaid","ira","studentLoanInterest"]`, `MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]`, each with a `*_LABELS: Record<Key, string>` and a type `XKey = (typeof X_KEYS)[number]`, plus `emptyChecks<K extends string>(keys: readonly K[]): Record<K, boolean>` and `countChecked(map: Record<string, boolean>): number`.
  - From `person-context.ts`: `person(ctx)`, `who(you, they)`, `isSecondPerson(ctx)`, `applying(ctx)` (moved verbatim from `person.ts`) and new `noncitizen(ctx)` = applying and `usCitizenOrNational === "no"`.
  - New `Saca2Person` fields and defaults (exact shapes in Step 3).
  - `Saca2IncomeItem` extended with optional fields and two new kinds.

- [ ] **Step 1: Write the failing tests**

In `lib/masshealth/saca2/__tests__/types.test.ts` append:

```ts
import { ACCOMMODATION_CONDITION_KEYS, ACCOMMODATION_KEYS, DEDUCTION_KEYS, ETHNICITY_KEYS, GENDER_IDENTITY_KEYS, RACE_KEYS, countChecked, emptyChecks } from "@/lib/masshealth/saca2/demographic-options"

describe("person detail defaults", () => {
  it("starts demographics unanswered with every checkbox unticked", () => {
    const p = emptySaca2Person()
    expect(p.demographics.hispanicOrLatino).toBeNull()
    expect(Object.keys(p.demographics.genderIdentity).sort()).toEqual([...GENDER_IDENTITY_KEYS].sort())
    expect(Object.keys(p.demographics.race).sort()).toEqual([...RACE_KEYS].sort())
    expect(Object.keys(p.demographics.ethnicity).sort()).toEqual([...ETHNICITY_KEYS].sort())
    expect(ETHNICITY_KEYS).toHaveLength(38)
    expect(countChecked(p.demographics.genderIdentity)).toBe(0)
    expect(p.demographics.genderIdentityOther).toBe("")
  })

  it("starts the tax block, household extras, accommodations, rental, one-time income and deductions empty", () => {
    const p = emptySaca2Person()
    expect(p.tax).toMatchObject({ agreesToFileIfAptc: null, spouseName: "", plansJointReturn: null, claimsDependents: null, dependents: [], claimedAsDependent: null, filingSeparatelyAbuse: null, filedForAptcYears: null })
    expect(p.tax.taxFiler).toMatchObject({ name: "", dateOfBirth: null, relationship: "", marriedFilingJointly: null, spouseName: "", otherDependents: "" })
    expect(p.pregnant).toBeNull()
    expect(p.everInFosterCare).toBeNull()
    expect(p.rentOrOwn).toBeNull()
    expect(p.caregiverChildren).toEqual([])
    expect(p.needsAccommodation).toBeNull()
    expect(Object.keys(p.accommodationConditions).sort()).toEqual([...ACCOMMODATION_CONDITION_KEYS].sort())
    expect(Object.keys(p.accommodations).sort()).toEqual([...ACCOMMODATION_KEYS].sort())
    expect(p.rental).toEqual({ hasRentalIncome: null, realEstateType: null, realEstateTypeOther: "", units: [], paysHeatOrUtilities: null })
    expect(p.oneTimeIncome).toEqual({ thisYear: null, thisYearItems: [], nextYear: null, nextYearItems: [] })
    expect(p.deductions.none).toBe(false)
    expect(Object.keys(p.deductions.amounts).sort()).toEqual([...DEDUCTION_KEYS].sort())
    expect(Object.values(p.deductions.amounts).every((v) => v === null)).toBe(true)
  })

  it("starts the SSN-card and immigration extras empty", () => {
    const p = emptySaca2Person()
    expect(p).toMatchObject({
      nameMatchesSsnCard: null,
      ssnCardName: "",
      isLprCheCofa: null,
      immigrationStatusDate: null,
      immigrationCountry: "",
      immigrationSameName: null,
      immigrationOtherName: "",
      arrivedAfterAug1996: null,
      isVeteranOrMilitaryFamily: null,
      isTraffickingOrBatteredVictim: null,
    })
  })

  it("gives each person independent objects", () => {
    const a = emptySaca2Person()
    const b = emptySaca2Person()
    expect(a.demographics.race).not.toBe(b.demographics.race)
    expect(a.deductions.amounts).not.toBe(b.deductions.amounts)
    expect(emptyChecks(["x", "y"])).toEqual({ x: false, y: false })
  })
})
```

In `lib/masshealth/saca2/__tests__/wizard-state.test.ts` append:

```ts
  it("fills the new person fields on a person saved before they existed", () => {
    const s = normalizeSaca2State({
      schemaVersion: SACA2_SCHEMA_VERSION,
      data: {
        persons: [{ firstName: "Old", income: [{ kind: "rental", amount: 100, frequency: "monthly" }, { kind: "capitalGains", amount: 5 }] }],
      },
    })!
    const p = s.data.persons[0]
    expect(p.firstName).toBe("Old")
    expect(p.demographics.race.white).toBe(false)
    expect(p.tax.dependents).toEqual([])
    expect(p.deductions.amounts.ira).toBeNull()
    expect(p.rental.units).toEqual([])
    expect(p.income).toHaveLength(2)
  })

  it("ignores wrong types inside the new person objects", () => {
    const s = normalizeSaca2State({
      schemaVersion: SACA2_SCHEMA_VERSION,
      data: { persons: [{ demographics: { race: { white: "yes", bogus: true } }, deductions: { none: "x", amounts: { ira: "5" } } }] },
    })!
    const p = s.data.persons[0]
    expect(p.demographics.race.white).toBe(false)
    expect(p.demographics.race).not.toHaveProperty("bogus")
    expect(p.deductions.none).toBe(false)
    expect(p.deductions.amounts.ira).toBeNull()
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/masshealth/saca2/__tests__/types.test.ts lib/masshealth/saca2/__tests__/wizard-state.test.ts`
Expected: FAIL — `demographic-options` module missing, `p.demographics` undefined.

- [ ] **Step 3: Implement**

Create `lib/masshealth/saca2/demographic-options.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

export const GENDER_IDENTITY_KEYS = ["male", "female", "transMan", "transWoman", "nonbinary", "notListed", "dontKnow", "declined"] as const
export const GENDER_IDENTITY_LABELS: Record<GenderIdentityKey, string> = {
  male: "Male",
  female: "Female",
  transMan: "Transgender man/trans man",
  transWoman: "Transgender woman/trans woman",
  nonbinary: "Genderqueer / gender nonconforming / non-binary / neither exclusively male nor female",
  notListed: "Gender identity not listed (please specify)",
  dontKnow: "Don't know",
  declined: "Choose not to answer",
}

export const SEXUAL_ORIENTATION_KEYS = ["straight", "gayOrLesbian", "bisexual", "queerPansexual", "notListed", "dontKnow", "declined"] as const
export const SEXUAL_ORIENTATION_LABELS: Record<SexualOrientationKey, string> = {
  straight: "Straight or heterosexual",
  gayOrLesbian: "Lesbian or gay",
  bisexual: "Bisexual",
  queerPansexual: "Queer, pansexual, or questioning",
  notListed: "Sexual orientation is not listed (please specify)",
  dontKnow: "Don't know",
  declined: "Choose not to answer",
}

export const RACE_KEYS = ["americanIndianAlaskaNative", "asian", "black", "nativeHawaiianPacificIslander", "white", "notListed", "dontKnow", "declined"] as const
export const RACE_LABELS: Record<RaceKey, string> = {
  americanIndianAlaskaNative: "American Indian or Alaska Native",
  asian: "Asian",
  black: "Black or African American",
  nativeHawaiianPacificIslander: "Native Hawaiian or Other Pacific Islander",
  white: "White",
  notListed: "Race is not listed here (please specify)",
  dontKnow: "Don't know",
  declined: "Choose not to answer",
}

export const ETHNICITY_KEYS = [
  "african", "africanAmerican", "american", "asianIndian", "brazilian", "cambodian", "capeVerdean", "caribbeanIslander",
  "centralAmerican", "chicano", "chinese", "colombian", "cuban", "dominican", "easternEuropean", "european",
  "filipino", "guamanianChamorro", "guatemalan", "haitian", "honduran", "japanese", "korean", "laotian",
  "mexican", "mexicanAmerican", "middleEasternNorthAfrican", "otherAsian", "portuguese", "puertoRican", "russian", "salvadoran",
  "samoan", "southAmerican", "vietnamese", "notListed", "dontKnow", "declined",
] as const
export const ETHNICITY_LABELS: Record<EthnicityKey, string> = {
  african: "African",
  africanAmerican: "African American",
  american: "American",
  asianIndian: "Asian Indian",
  brazilian: "Brazilian",
  cambodian: "Cambodian",
  capeVerdean: "Cape Verdean",
  caribbeanIslander: "Caribbean Islander",
  centralAmerican: "Central American",
  chicano: "Chicano/a",
  chinese: "Chinese",
  colombian: "Colombian",
  cuban: "Cuban",
  dominican: "Dominican",
  easternEuropean: "Eastern European",
  european: "European",
  filipino: "Filipino",
  guamanianChamorro: "Guamanian or Chamorro",
  guatemalan: "Guatemalan",
  haitian: "Haitian",
  honduran: "Honduran",
  japanese: "Japanese",
  korean: "Korean",
  laotian: "Laotian/Lao",
  mexican: "Mexican",
  mexicanAmerican: "Mexican American",
  middleEasternNorthAfrican: "Middle Eastern or North African",
  otherAsian: "Other Asian",
  portuguese: "Portuguese",
  puertoRican: "Puerto Rican",
  russian: "Russian",
  salvadoran: "Salvadoran",
  samoan: "Samoan",
  southAmerican: "South American",
  vietnamese: "Vietnamese",
  notListed: "Ethnicity is not listed (please specify)",
  dontKnow: "Don't know",
  declined: "Choose not to answer",
}
```

`ETHNICITY_KEYS` has 38 entries: the form's page-32 list (Africa through Vietnamese = 34 named options, then "Ethnicity is not listed", "Don't know", "Choose not to answer"); count them against the PDF and make the constant and the test agree with the form exactly.

Continue the file:

```ts
export const ACCOMMODATION_CONDITION_KEYS = ["lowVision", "blind", "deaf", "hardOfHearing", "developmentallyDisabled", "intellectuallyDisabled", "physicallyDisabled", "other"] as const
export const ACCOMMODATION_CONDITION_LABELS: Record<AccommodationConditionKey, string> = {
  lowVision: "Low vision",
  blind: "Blind",
  deaf: "Deaf",
  hardOfHearing: "Hard of hearing",
  developmentallyDisabled: "Developmentally disabled",
  intellectuallyDisabled: "Intellectually disabled",
  physicallyDisabled: "Physically disabled",
  other: "Other (please explain)",
}

export const ACCOMMODATION_KEYS = ["tty", "largePrint", "asl", "videoRelay", "cart", "braille", "assistiveListening", "electronicFormat", "other"] as const
export const ACCOMMODATION_LABELS: Record<AccommodationKey, string> = {
  tty: "Text telephone (TTY)",
  largePrint: "Large-print publications",
  asl: "American Sign Language interpreter",
  videoRelay: "Video Relay Service",
  cart: "Communication Access Real-time Translation (CART)",
  braille: "Publications in braille",
  assistiveListening: "Assistive listening device",
  electronicFormat: "Publications in electronic format",
  other: "Other (please explain)",
}

export const DEDUCTION_KEYS = [
  "educator", "reservistExpenses", "hsa", "movingExpenses", "selfEmploymentTax", "selfEmployedRetirement",
  "selfEmployedHealthInsurance", "earlyWithdrawalPenalty", "alimonyPaid", "ira", "studentLoanInterest",
] as const
export const DEDUCTION_LABELS: Record<DeductionKey, string> = {
  educator: "Educator expenses",
  reservistExpenses: "Certain business expenses of reservists, performing artists, or fee-based government officials",
  hsa: "Health Savings Account deduction",
  movingExpenses: "Moving expenses for members of the Armed Forces",
  selfEmploymentTax: "Deductible part of self-employment tax",
  selfEmployedRetirement: "Contribution to self-employed SEP, SIMPLE, and qualified plans",
  selfEmployedHealthInsurance: "Self-employed health insurance deduction",
  earlyWithdrawalPenalty: "Penalty on early withdrawal of savings",
  alimonyPaid: "Alimony paid from a divorce, separation agreement, or court order that was finalized before January 1, 2019",
  ira: "Individual Retirement Account (IRA) deduction",
  studentLoanInterest: "Student loan interest deduction (interest only, not total payment)",
}

export const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const
export const MONTH_LABELS: Record<MonthKey, string> = {
  jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June",
  jul: "July", aug: "August", sep: "September", oct: "October", nov: "November", dec: "December",
}

export type GenderIdentityKey = (typeof GENDER_IDENTITY_KEYS)[number]
export type SexualOrientationKey = (typeof SEXUAL_ORIENTATION_KEYS)[number]
export type RaceKey = (typeof RACE_KEYS)[number]
export type EthnicityKey = (typeof ETHNICITY_KEYS)[number]
export type AccommodationConditionKey = (typeof ACCOMMODATION_CONDITION_KEYS)[number]
export type AccommodationKey = (typeof ACCOMMODATION_KEYS)[number]
export type DeductionKey = (typeof DEDUCTION_KEYS)[number]
export type MonthKey = (typeof MONTH_KEYS)[number]

export function emptyChecks<K extends string>(keys: readonly K[]): Record<K, boolean> {
  return Object.fromEntries(keys.map((key) => [key, false])) as Record<K, boolean>
}

export function countChecked(map: Record<string, boolean>): number {
  return Object.values(map).filter(Boolean).length
}
```

Create `lib/masshealth/saca2/questions/person-context.ts` by moving, verbatim, the helpers `person`, `who`, `isSecondPerson`, `applying` out of `person.ts` (export them), and add:

```ts
export const noncitizen = (ctx: Saca2QuestionContext) => applying(ctx) && person(ctx)?.usCitizenOrNational === "no"
```

`person.ts` then imports them from `./person-context` (delete the local copies; `hasHomeAddress` and `needsMailingAddress` stay local).

In `types.ts`:

1. Import the key types and `emptyChecks` from `./demographic-options`.
2. In `Saca2IncomeItem`: add kinds `"capitalGains"` and `"farmingFishing"` to the `kind` union, and these optional fields (each with a one-line doc):

```ts
  employerFederalTaxId?: string
  /** ISO YYYY-MM-DD: when the wages took effect. */
  effectiveDate?: string | null
  seasonal?: YesNo | null
  /** Work type (self-employment), source (pension), or type (other taxable income). */
  description?: string
  /** Monthly net amount is a loss (self-employment, capital gains, farming/fishing). */
  isLoss?: boolean
  /** Alimony received under an agreement finalized before January 1, 2019. */
  preTcjaAmount?: number | null
  seasonJan?: boolean
  seasonFeb?: boolean
  seasonMar?: boolean
  seasonApr?: boolean
  seasonMay?: boolean
  seasonJun?: boolean
  seasonJul?: boolean
  seasonAug?: boolean
  seasonSep?: boolean
  seasonOct?: boolean
  seasonNov?: boolean
  seasonDec?: boolean
```

3. Add these exported interfaces above `Saca2Person`:

```ts
export interface PersonDemographics {
  genderIdentity: Record<GenderIdentityKey, boolean>
  genderIdentityOther: string
  sexualOrientation: Record<SexualOrientationKey, boolean>
  sexualOrientationOther: string
  hispanicOrLatino: "yes" | "no" | "dontKnow" | "declined" | null
  race: Record<RaceKey, boolean>
  raceOther: string
  ethnicity: Record<EthnicityKey, boolean>
  ethnicityOther: string
}

export interface TaxDependent {
  name: string
  /** ISO YYYY-MM-DD. */
  dateOfBirth: string | null
}

export interface PersonTax {
  /** Q11 (Person 2: Q21): agrees to file a federal return for any year APTC is received. */
  agreesToFileIfAptc: YesNo | null
  spouseName: string
  spouseDateOfBirth: string | null
  plansJointReturn: YesNo | null
  claimsDependents: YesNo | null
  dependents: TaxDependent[]
  claimedAsDependent: YesNo | null
  taxFiler: {
    name: string
    dateOfBirth: string | null
    relationship: string
    marriedFilingJointly: YesNo | null
    spouseName: string
    spouseDateOfBirth: string | null
    otherDependents: string
  }
  filingSeparatelyAbuse: YesNo | null
  /** Optional attestation about prior-year returns when APTC was received. */
  filedForAptcYears: YesNo | null
}

export interface RentalUnit {
  address: string
  unit: string
  amount: number | null
  isLoss: boolean
  ownerOccupied: YesNo | null
}

export interface PersonRental {
  hasRentalIncome: YesNo | null
  realEstateType: "oneFamily" | "twoFamily" | "threeFamily" | "other" | null
  realEstateTypeOther: string
  units: RentalUnit[]
  paysHeatOrUtilities: YesNo | null
}

export interface OneTimeIncomeItem {
  type: string
  amount: number | null
  /** 1-12. */
  month: number | null
  year: number | null
}

export interface PersonOneTimeIncome {
  thisYear: YesNo | null
  thisYearItems: OneTimeIncomeItem[]
  nextYear: YesNo | null
  nextYearItems: OneTimeIncomeItem[]
}

export interface PersonDeductions {
  none: boolean
  /** Yearly amount per deduction; null = not claimed. */
  amounts: Record<DeductionKey, number | null>
}

export interface CaregiverChild {
  name: string
  /** ISO YYYY-MM-DD. */
  dateOfBirth: string | null
}
```

4. In `Saca2Person` add (placing each next to its related fields, with the fields exactly named as below):

```ts
  demographics: PersonDemographics

  /** Q10: is the name on this application the name on the Social Security card? */
  nameMatchesSsnCard: YesNo | null
  ssnCardName: string

  tax: PersonTax

  /** Q13a: LPR / Cuban-Haitian entrant / COFA migrant. */
  isLprCheCofa: YesNo | null
  /** Q13b status award date, ISO YYYY-MM-DD. */
  immigrationStatusDate: string | null
  immigrationCountry: string
  immigrationSameName: YesNo | null
  immigrationOtherName: string
  arrivedAfterAug1996: YesNo | null
  isVeteranOrMilitaryFamily: YesNo | null
  /** Q13f, optional. */
  isTraffickingOrBatteredVictim: YesNo | null

  caregiverChildren: CaregiverChild[]
  pregnant: YesNo | null
  babiesExpected: number | null
  /** ISO YYYY-MM-DD. */
  dueDate: string | null
  everInFosterCare: YesNo | null
  fosterCareState: string
  fosterCareMedicaid: YesNo | null
  rentOrOwn: "rent" | "own" | null
  needsAccommodation: YesNo | null
  accommodationConditions: Record<AccommodationConditionKey, boolean>
  accommodationConditionOther: string
  accommodations: Record<AccommodationKey, boolean>
  accommodationOther: string

  rental: PersonRental
  oneTimeIncome: PersonOneTimeIncome
  deductions: PersonDeductions
```

5. In `emptySaca2Person()` add matching defaults (use `emptyChecks(GENDER_IDENTITY_KEYS)` etc. so every call builds fresh objects; `deductions.amounts` is `Object.fromEntries(DEDUCTION_KEYS.map((k) => [k, null])) as Record<DeductionKey, number | null>`; `tax.taxFiler` and all strings `""`, selects/yes-no `null`, arrays `[]`, `deductions.none: false`, `rental` and `oneTimeIncome` as asserted in Step 1).

- [ ] **Step 4: Run tests, type check, lint**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS. `normalizeSaca2State` needs no code change: persons are overlaid on `emptySaca2Person()`, whose nested objects are non-empty bases (typed keys only) and whose arrays are replaced wholesale. If a "wrong type" case fails, fix `overlay`, not the test.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/demographic-options.ts lib/masshealth/saca2/questions/person-context.ts lib/masshealth/saca2/questions/person.ts lib/masshealth/saca2/types.ts lib/masshealth/saca2/__tests__
git commit -m "feat(saca2): add person-detail types, option constants, and shared person helpers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Optional demographics (form Q5–9 / Person 2 Q15–19)

**Files:**
- Create: `lib/masshealth/saca2/questions/person-demographics.ts`
- Modify: `lib/masshealth/saca2/questions/person.ts` (insert the section after `contact`; add `validateStep`)
- Test: `lib/masshealth/saca2/__tests__/questions-person-demographics.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 constants and `person-context`; builders `checkbox`, `select`, `text`, `opts`.
- Produces: `DEMOGRAPHICS_SECTION: Saca2Section` and `validateDemographics(answers, personIndex): Record<string, string>`; `PERSON_STEP_CONTENT.validateStep` calls it (later tasks add more checks to the same hook through a small composer — see Step 3).

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-person-demographics.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { getStepContent, validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, emptySaca2Person, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  a.persons[0].applyingForCoverage = "yes"
  mutate(a)
  return a
}

/** Errors for person1 whose key sits under `persons.0.demographics`. */
function errs(a: Saca2Answers, prefix = "persons.0.demographics"): Record<string, string> {
  return Object.fromEntries(Object.entries(validateStep("person1", a, ON)).filter(([k]) => k.startsWith(prefix)))
}

describe("person demographics (optional)", () => {
  it("asks nothing required, even when applying", () => {
    expect(errs(answers())).toEqual({})
  })

  it("is not shown to someone who is not applying", () => {
    const content = getStepContent("person1")!
    const section = content.sections.find((s) => s.id === "demographics")!
    const ctx = { answers: answers((a) => (a.persons[0].applyingForCoverage = "no")), personIndex: 0, on: ON }
    expect(section.questions.every((q) => q.visibleWhen?.(ctx) === false)).toBe(true)
  })

  it("lets a person tick up to five gender identities and rejects six", () => {
    const five = answers((a) => {
      for (const k of ["male", "female", "transMan", "transWoman", "nonbinary"] as const) a.persons[0].demographics.genderIdentity[k] = true
    })
    expect(errs(five)).toEqual({})
    five.persons[0].demographics.genderIdentity.declined = true
    expect(errs(five)).toEqual({ "persons.0.demographics.genderIdentity.male": "Select up to five options." })
  })

  it("applies the same five-option cap to sexual orientation", () => {
    const six = answers((a) => {
      for (const k of ["straight", "gayOrLesbian", "bisexual", "queerPansexual", "notListed", "dontKnow"] as const) a.persons[0].demographics.sexualOrientation[k] = true
    })
    expect(errs(six)).toEqual({ "persons.0.demographics.sexualOrientation.straight": "Select up to five options." })
  })

  it("asks for the written description only when 'not listed' is ticked", () => {
    const a = answers((x) => (x.persons[0].demographics.genderIdentity.notListed = true))
    expect(errs(a)).toEqual({ "persons.0.demographics.genderIdentityOther": "This question is required." })
    a.persons[0].demographics.genderIdentityOther = "Two-spirit"
    expect(errs(a)).toEqual({})
    a.persons[0].demographics.genderIdentity.notListed = false
    a.persons[0].demographics.genderIdentityOther = ""
    expect(errs(a)).toEqual({})
  })

  it.each([
    ["sexualOrientation", "sexualOrientationOther"],
    ["race", "raceOther"],
    ["ethnicity", "ethnicityOther"],
  ] as const)("requires a description for %s only when 'not listed' is ticked", (group, other) => {
    const a = answers((x) => ((x.persons[0].demographics[group] as Record<string, boolean>).notListed = true))
    expect(errs(a)).toEqual({ [`persons.0.demographics.${other}`]: "This question is required." })
  })

  it("words Person 2's questions in the third person", () => {
    const content = getStepContent("person2")!
    const section = content.sections.find((s) => s.id === "demographics")!
    const ctx = { answers: answers(), personIndex: 1, on: ON }
    const label = (path: string) => {
      const q = section.questions.find((x) => x.path === path)!
      return typeof q.label === "function" ? q.label(ctx) : q.label
    }
    expect(label("demographics.hispanicOrLatino")).toBe("Is this person of Hispanic or Latino origin or descent?")
    const ctx0 = { ...ctx, personIndex: 0 }
    const q = section.questions.find((x) => x.path === "demographics.hispanicOrLatino")!
    expect(typeof q.label === "function" ? q.label(ctx0) : q.label).toBe("Are you of Hispanic or Latino origin or descent?")
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-person-demographics.test.ts`
Expected: FAIL — no `demographics` section.

- [ ] **Step 3: Implement**

Create `lib/masshealth/saca2/questions/person-demographics.ts`:

```ts
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
```

In `person.ts`: import `DEMOGRAPHICS_SECTION, validateDemographics`; insert `DEMOGRAPHICS_SECTION` into `sections` immediately after the `contact` section; and add to `PERSON_STEP_CONTENT`:

```ts
  validateStep: (answers, personIndex) => ({
    ...validateDemographics(answers, personIndex),
  }),
```

(Later tasks append their own validators inside this spread; do not create a second `validateStep`.)

- [ ] **Step 4: Run tests, type check, lint**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS. Demographics are optional, so no fixture changes are needed. If the registry's "ids are unique" test fails, check that no two questions share a `path` (the two `notListed` checkboxes live under different groups).

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/person-demographics.ts lib/masshealth/saca2/questions/person.ts lib/masshealth/saca2/__tests__/questions-person-demographics.test.ts
git commit -m "feat(saca2): add optional demographic questions to the person steps" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: SSN-card name and immigration details (form Q10, Q13a–f)

**Files:**
- Create: `lib/masshealth/saca2/questions/person-identity.ts`
- Modify: `lib/masshealth/saca2/questions/person.ts` (splice the new questions into the `status` section at the right points)
- Modify: `lib/masshealth/saca2/__tests__/complete-answers.ts` (`completePerson`)
- Test: `lib/masshealth/saca2/__tests__/questions-person-identity.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 fields and `noncitizen`, `applying`, `who`, `person`.
- Produces: `SSN_CARD_QUESTIONS: Saca2Question[]` (insert directly after `noSsnReason`) and `IMMIGRATION_DETAIL_QUESTIONS: Saca2Question[]` (insert directly after `immigrationDocumentExpiry`). Rules:
  - `nameMatchesSsnCard` required when applying and `hasSsn === "yes"`; `ssnCardName` required when that is `"no"`.
  - `isLprCheCofa` (13a) required when `noncitizen` and `hasEligibleImmigrationStatus === "yes"`.
  - `immigrationStatusDate` and `immigrationCountry` optional when the person has an eligible status (form 13b rows).
  - `immigrationSameName` (13c) required for a noncitizen; `immigrationOtherName` required when it is `"no"`.
  - `arrivedAfterAug1996` (13d) and `isVeteranOrMilitaryFamily` (13e) required for a noncitizen; `isTraffickingOrBatteredVictim` (13f) optional for a noncitizen.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-person-identity.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { getStepContent, validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")
const REQ = "This question is required."

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  a.persons[0].applyingForCoverage = "yes"
  mutate(a)
  return a
}

const KEYS = [
  "nameMatchesSsnCard",
  "ssnCardName",
  "isLprCheCofa",
  "immigrationStatusDate",
  "immigrationCountry",
  "immigrationSameName",
  "immigrationOtherName",
  "arrivedAfterAug1996",
  "isVeteranOrMilitaryFamily",
  "isTraffickingOrBatteredVictim",
].map((k) => `persons.0.${k}`)

function errs(a: Saca2Answers): Record<string, string> {
  return Object.fromEntries(Object.entries(validateStep("person1", a, ON)).filter(([k]) => KEYS.includes(k)))
}

describe("SSN card name", () => {
  it("is not asked unless the person has an SSN", () => {
    expect(errs(answers((a) => (a.persons[0].hasSsn = "no")))).toEqual({})
  })

  it("requires the yes/no when the person has an SSN, and the card name only when the names differ", () => {
    const a = answers((x) => (x.persons[0].hasSsn = "yes"))
    expect(errs(a)).toEqual({ "persons.0.nameMatchesSsnCard": REQ })
    a.persons[0].nameMatchesSsnCard = "no"
    expect(errs(a)).toEqual({ "persons.0.ssnCardName": REQ })
    a.persons[0].ssnCardName = "Edna M Testcase"
    expect(errs(a)).toEqual({})
  })

  it("ignores a stale card name after the answer flips to yes", () => {
    const a = answers((x) => {
      x.persons[0].hasSsn = "yes"
      x.persons[0].nameMatchesSsnCard = "yes"
      x.persons[0].ssnCardName = ""
    })
    expect(errs(a)).toEqual({})
  })
})

describe("immigration details", () => {
  const noncitizen = (a: Saca2Answers) => (a.persons[0].usCitizenOrNational = "no")

  it("asks nothing extra of a citizen or of someone not applying", () => {
    expect(errs(answers((a) => (a.persons[0].usCitizenOrNational = "yes")))).toEqual({})
    expect(errs(answers((a) => {
      noncitizen(a)
      a.persons[0].applyingForCoverage = "no"
    }))).toEqual({})
  })

  it("requires 13c-e for a noncitizen without an eligible status", () => {
    const a = answers((x) => {
      noncitizen(x)
      x.persons[0].hasEligibleImmigrationStatus = "no"
    })
    expect(Object.keys(errs(a)).sort()).toEqual([
      "persons.0.arrivedAfterAug1996",
      "persons.0.immigrationSameName",
      "persons.0.isVeteranOrMilitaryFamily",
    ])
  })

  it("also requires 13a when the person has an eligible status, but never the date, country, or trafficking question", () => {
    const a = answers((x) => {
      noncitizen(x)
      x.persons[0].hasEligibleImmigrationStatus = "yes"
      x.persons[0].immigrationSameName = "yes"
      x.persons[0].arrivedAfterAug1996 = "no"
      x.persons[0].isVeteranOrMilitaryFamily = "no"
    })
    expect(errs(a)).toEqual({ "persons.0.isLprCheCofa": REQ })
    a.persons[0].isLprCheCofa = "yes"
    expect(errs(a)).toEqual({})
  })

  it("requires the other name only when the name differs", () => {
    const a = answers((x) => {
      noncitizen(x)
      x.persons[0].hasEligibleImmigrationStatus = "no"
      x.persons[0].immigrationSameName = "no"
      x.persons[0].arrivedAfterAug1996 = "no"
      x.persons[0].isVeteranOrMilitaryFamily = "no"
    })
    expect(errs(a)).toEqual({ "persons.0.immigrationOtherName": REQ })
  })

  it("ignores answers left behind after the person becomes a citizen", () => {
    const a = answers((x) => {
      x.persons[0].usCitizenOrNational = "yes"
      x.persons[0].immigrationSameName = "no"
      x.persons[0].isLprCheCofa = null
    })
    expect(errs(a)).toEqual({})
  })

  it("words Person 2's labels in the third person", () => {
    const content = getStepContent("person2")!
    const q = content.sections.flatMap((s) => s.questions).find((x) => x.path === "immigrationSameName")!
    const label = (personIndex: number) =>
      typeof q.label === "function" ? q.label({ answers: answers(), personIndex, on: ON }) : q.label
    expect(label(0)).toBe("Did you use the same name on this application that you did to get your immigration status?")
    expect(label(1)).toBe("Did this person use the same name on this application that they used to get their immigration status?")
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/masshealth/saca2/__tests__/questions-person-identity.test.ts` → FAIL (questions missing).

- [ ] **Step 3: Implement** `person-identity.ts` exporting the two arrays with exact labels from the form:
  - `nameMatchesSsnCard`: who("Is your name on this application the same as your name on your Social Security card?", "Is this person's name on this application the same as their name on their Social Security card?"); `ssnCardName`: "Name on the Social Security card (first, middle, last, and suffix)".
  - `isLprCheCofa`: "Are you a Lawful Permanent Resident (LPR or green card holder), a Cuban-Haitian Entrant (CHE), or a Compact of Free Association (COFA) Migrant?" with `who` variant for Person 2; `immigrationStatusDate`: date, "Status award date (for battered persons, the date the petition was approved)"; `immigrationCountry`: "Country (on the passport or document)"; `immigrationSameName`: who("Did you use the same name on this application that you did to get your immigration status?", "Did this person use the same name on this application that they used to get their immigration status?"); `immigrationOtherName`: "Name used to get immigration status (first, middle, last, and suffix)"; `arrivedAfterAug1996`: who("Did you arrive in the U.S. after August 22, 1996?", "Did this person arrive in the U.S. after August 22, 1996?"); `isVeteranOrMilitaryFamily`: who("Are you an honorably discharged veteran or active-duty member of the US military, or the spouse or child of one?", "Is this person an honorably discharged veteran or active-duty member of the US military, or the spouse or child of one?"); `isTraffickingOrBatteredVictim`: who("Optional: Are you a victim of severe trafficking; a spouse, child, sibling, or parent of a trafficking victim; a battered spouse; or a child or parent of a battered spouse?", "Optional: Is this person …" (same list)).
  - All gates use chains from `person-context` (`applying`, `noncitizen`) plus the sibling answers named in the Interfaces block.
  In `person.ts`, import and spread the arrays at the two insertion points. Extend `completePerson()`: `nameMatchesSsnCard` is not needed (fixture has `hasSsn: "no"`); citizens (all current fixtures) need no new answers — verify and report.

- [ ] **Step 4: Run tests, type check, lint** — `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2` → PASS.

- [ ] **Step 5: Commit** — `feat(saca2): add SSN-card name and immigration detail questions`.

---

### Task 4: Tax and Health Connector (form Q11 / Person 2 Q21)

**Files:**
- Create: `lib/masshealth/saca2/questions/person-tax.ts`
- Modify: `lib/masshealth/saca2/questions/person.ts` (insert `TAX_SECTION` after `status`)
- Modify: `lib/masshealth/saca2/__tests__/complete-answers.ts` (`completePerson`: `tax.agreesToFileIfAptc = "no"`, `tax.claimedAsDependent = "no"`, `tax.filingSeparatelyAbuse = "no"`)
- Test: `lib/masshealth/saca2/__tests__/questions-person-tax.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 `tax` fields, `applying`, `who`, `person`, `isLegallyMarried` (already asked in `status`).
- Produces: `TAX_SECTION`. Rules (all inside `applying`):
  - `tax.agreesToFileIfAptc` (Q11) required.
  - When `"yes"`: `tax.spouseName` + `tax.spouseDateOfBirth` required if `isLegallyMarried === "yes"`; `tax.plansJointReturn` (11b) required if married; `tax.claimsDependents` (11c) required; `tax.dependents` repeater (name, date of birth required; max 6) required when `claimsDependents === "yes"`.
  - `tax.claimedAsDependent` (11d) required whenever applying (asked even when 11 is No — the form says "skip to question d").
  - When 11d is `"yes"`: `tax.taxFiler.name`, `.dateOfBirth`, `.relationship`, `.marriedFilingJointly` required; `.spouseName` + `.spouseDateOfBirth` required when `marriedFilingJointly === "yes"`; `.otherDependents` optional.
  - `tax.filingSeparatelyAbuse` (11e) required.
  - `tax.filedForAptcYears` optional (the form marks it "Optional").
  - `Saca2Question` for a nested repeater `emptyItem`: `({ name: "", dateOfBirth: null }) satisfies TaxDependent`.

- [ ] **Step 1: Write the failing tests** covering: not asked of a non-applying person; empty applying person gets exactly `agreesToFileIfAptc`, `claimedAsDependent`, `filingSeparatelyAbuse`; "yes" adds `claimsDependents` (and spouse/joint questions only when married); the dependents repeater requirement + row validation; 11d "yes" chain incl. spouse of the tax filer; stale answers after `agreesToFileIfAptc` flips to "no", `claimsDependents` to "no", `claimedAsDependent` to "no" produce no errors; Person 2 wording pin for 11a–e (e.g. "Does this person plan to file a joint federal tax return with a spouse for the tax year for which this person is applying?" and "Will this person be claimed as a dependent on someone else's federal income tax return for the year for which this person is applying?"). Expected exact key lists (sorted, all prefixed `persons.0.`): empty applying person → `tax.agreesToFileIfAptc`, `tax.claimedAsDependent`, `tax.filingSeparatelyAbuse`; agrees "yes" adds `tax.claimsDependents`; agrees "yes" + married adds `tax.spouseName`, `tax.spouseDateOfBirth`, `tax.plansJointReturn`; `claimsDependents` "yes" adds `tax.dependents` ("Add at least one."); a blank dependent row adds `tax.dependents.0.name` and `tax.dependents.0.dateOfBirth`; `claimedAsDependent` "yes" adds `tax.taxFiler.name`, `.dateOfBirth`, `.relationship`, `.marriedFilingJointly`, and `marriedFilingJointly` "yes" adds `tax.taxFiler.spouseName`, `.spouseDateOfBirth`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** `person-tax.ts` with labels from form text (Person 1 wording from form lines 142–181; Person 2 wording via `who` — pin the two strings quoted above). Use the same help texts as the form where short (APTC must-file note on the agree question; "Do not answer Yes if you are a child younger than 21 being claimed by a non-custodial parent" on 11d). Insert `TAX_SECTION` in `person.ts` after the `status` section; extend `completePerson`.

- [ ] **Step 4: Run tests, type check, lint.**

- [ ] **Step 5: Commit** — `feat(saca2): add tax filing and Health Connector questions to the person steps`.

---

### Task 5: Household extras and accommodations (form Q15–18, Q20)

**Files:**
- Create: `lib/masshealth/saca2/questions/person-household.ts`
- Modify: `lib/masshealth/saca2/questions/person.ts` (insert `HOUSEHOLD_SECTION` after `tax`; add the accommodations validator to `validateStep`)
- Modify: `lib/masshealth/saca2/__tests__/complete-answers.ts` (`completePerson`: `pregnant: "no"`, `everInFosterCare: "no"`, `rentOrOwn: "rent"`, `needsAccommodation: "no"`)
- Test: `lib/masshealth/saca2/__tests__/questions-person-household.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 fields, `applying`, `who`, `person`.
- Produces: `HOUSEHOLD_SECTION` (+ `validateAccommodations(answers, personIndex)`). Rules:
  - `caregiverChildren` repeater (name, date of birth; max 6) required when applying and `caregiverOfChildUnder19 === "yes"` (the existing question stays in `status`).
  - `pregnant` (Q16) required when applying; when `"yes"`: `babiesExpected` (number, 1–10, whole) and `dueDate` (date) required.
  - `everInFosterCare` (Q17) required when applying; when `"yes"`: `fosterCareState` (validated with `validateStateCode`) and `fosterCareMedicaid` required.
  - `rentOrOwn` (Q18) required when applying.
  - **`needsAccommodation` (Q20) is asked of everyone, applying or not**, required. When `"yes"`: the 8 condition checkboxes and 9 accommodation checkboxes appear; `accommodationConditionOther` required if the `other` condition is ticked; `accommodationOther` required if the `other` accommodation is ticked; `validateAccommodations` requires at least one condition AND at least one accommodation (error keys: first checkbox of each group, message "Select at least one."), only when `needsAccommodation === "yes"`.
  - Wording: Q20 via `who("Do you need reasonable accommodation(s) because of a disability or injury?", "Does this person need reasonable accommodation(s) because of a disability or injury?")`.

- [ ] **Step 1: Write the failing tests** including: Q20 asked of a non-applying person (and nothing else in the section is); caregiver children repeater appears only for yes and validates rows; pregnancy chain incl. `babiesExpected` range errors (`0`, `11`, `1.5` rejected with "Enter a whole number from 1 to 10."); foster-care chain incl. invalid state code rejection; accommodations: yes → both "Select at least one." errors, ticking one of each clears them, `other` ticked → description required, flipping back to "no" clears everything; Person 2 wording pin for Q20 and for "Is this person pregnant?" / "Was this person ever in foster care?".

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** `person-household.ts`; generate the two checkbox groups from `ACCOMMODATION_CONDITION_KEYS/LABELS` and `ACCOMMODATION_KEYS/LABELS` (paths `accommodationConditions.<key>`, `accommodations.<key>`, `visibleWhen` = `needsAccommodation === "yes"`). Add to `person.ts`'s `validateStep` spread: `...validateAccommodations(answers, personIndex)`. Extend `completePerson`.

- [ ] **Step 4: Run tests, type check, lint.**

- [ ] **Step 5: Commit** — `feat(saca2): add child-caregiver, pregnancy, foster-care, rent/own, and accommodation questions`.

---

### Task 6: Job, self-employment, and other-income details (form Q23–28)

**Files:**
- Create: `lib/masshealth/saca2/questions/person-income.ts`
- Modify: `lib/masshealth/saca2/questions/person.ts` (replace the inline `income` repeater and `INCOME_KINDS` with the new module)
- Modify: `lib/masshealth/saca2/__tests__/questions-content.test.ts` and any existing income tests that pin the old picker or the always-required frequency
- Test: `lib/masshealth/saca2/__tests__/questions-person-income.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 income-row fields, `MONTH_KEYS/LABELS`, `INCOME_FREQUENCIES`, `person`, `who`.
- Produces: `INCOME_SECTION` (replaces the existing section with the same id `income`), exporting also `INCOME_KINDS`.
- Row rules (kind = `ctx.item?.kind`):
  - Picker kinds: wages, selfEmployment, socialSecurity, pension, annuity, trust, unemployment, investment, royalty, alimony, veterans, militaryRetirement, otherTaxable, capitalGains ("Capital gains"), farmingFishing ("Net farming or fishing income"), lottery. **`rental` is not offered** (Q29 owns it).
  - `amount` label depends on kind: monthly-net kinds (`selfEmployment`, `capitalGains`, `farmingFishing`) read "Average monthly net income or loss ($)"; others keep "Amount before taxes ($)". `isLoss` checkbox ("This is a monthly loss, not a profit") visible for monthly-net kinds. `frequency` is hidden and not required for monthly-net kinds and required otherwise.
  - Wages: `employerNameAndAddress` (existing), `employerFederalTaxId` (optional), `effectiveDate` (date, optional), `hoursPerWeek` (existing, number), `seasonal` (yes/no, required), and when `seasonal === "yes"` the twelve `season*` checkboxes with a step-free "at least one month" check done as a row-level validator on `seasonal`: implement by making `seasonJan` the `required`-style anchor — simplest: add a hidden-until-seasonal text-free approach: validate inside the repeater via the `validate` option of the `seasonal` question, which checks `ctx.item` for at least one `season*` true and returns "Select at least one month." otherwise.
  - Self-employment: `description` (work type, required), `hoursPerWeek` (existing, number, required for self-employment).
  - Pension: `description` labelled "Source" (optional). Other taxable income: `description` labelled "Type" (required). Alimony: `preTcjaAmount` money (optional) labelled "Alimony received under an agreement finalized before January 1, 2019 ($)". Lottery: `effectiveDate` (date, required) — frequency options already include `oneTime`.
  - `emptyItem` stays `{ kind: null, amount: null, frequency: null }` (extras are optional on the row type).

- [ ] **Step 1: Write the failing tests**, in the plan-2b-2 style, covering: each kind's required/hidden fields (table-driven `it.each` over kinds with the exact error key lists); monthly-net kinds do not require or show `frequency`; wages `seasonal` yes requires a month and ticking one clears it; stale `seasonal`→no with months left ticked produces nothing; stale kind switch (wages→pension with leftover employer fields) produces nothing; picker no longer lists `rental` but lists the two new kinds; labels for the monthly-net amount.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** `person-income.ts` by moving the existing income section out of `person.ts` (keep `hasIncome`, `expectedIncomeThisYear`, `expectedIncomeNextYear` with their current gates and wording) and applying the row rules above. Update existing tests that referenced the old picker or the frequency requirement on self-employment rows — each such change must be justified in the report and must not loosen an assertion about other kinds.

- [ ] **Step 4: Run tests, type check, lint**; confirm `completePerson` fixtures (all `hasIncome: "no"`) still pass unchanged.

- [ ] **Step 5: Commit** — `feat(saca2): add job, self-employment, and other-income detail questions`.

---

### Task 7: Rental income, one-time income, and deductions (form Q29–32)

**Files:**
- Create: `lib/masshealth/saca2/questions/person-income-extras.ts`
- Modify: `lib/masshealth/saca2/questions/person.ts` (append the three sections after `income`; add `validateDeductions` to `validateStep`)
- Modify: `lib/masshealth/saca2/__tests__/complete-answers.ts` (`completePerson`: `oneTimeIncome.nextYear = "no"`, `deductions.none = true`)
- Test: `lib/masshealth/saca2/__tests__/questions-person-income-extras.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 fields, `person`, `who`.
- Produces: `RENTAL_SECTION`, `ONE_TIME_SECTION`, `DEDUCTIONS_SECTION`, `validateDeductions`. Rules:
  - **Rental (Q29, "you must answer")**: `rental.hasRentalIncome` required only when `hasIncome === "yes"`. When `"yes"`: `rental.realEstateType` (select oneFamily/twoFamily/threeFamily/other) required; `rental.realEstateTypeOther` required if `other`; `rental.units` repeater required (address required, unit optional, amount required, `isLoss` checkbox, `ownerOccupied` yes/no required; max 6; `emptyItem` `satisfies RentalUnit`); `rental.paysHeatOrUtilities` required.
  - **One-time income**: `oneTimeIncome.thisYear` (Q30) required only when `hasIncome === "yes"`; `oneTimeIncome.nextYear` (Q31) **always** required. When yes, the matching items repeater is required (type, amount, month 1–12 whole, year whole four-digit ≥ the current calendar year for this year / next year; max 4; `satisfies OneTimeIncomeItem`). The year validators use `ctx.on` (this year = `ctx.on.getUTCFullYear()`, next year = +1) and require exactly that year for the respective repeater.
  - **Deductions (Q32)**: `deductions.none` checkbox ("None"); eleven `deductions.amounts.<key>` money questions visible when `none` is not ticked (label `"<DEDUCTION_LABELS[key]>: yearly amount ($)"`, each optional, non-negative). `validateDeductions` (only when `none` is false and no amount is non-null) returns `{ "persons.N.deductions.none": "Check None or enter at least one deduction." }`. If `none` is true any stored amounts are ignored (hidden).

- [ ] **Step 1: Write the failing tests** with exact key lists for: rental not asked when `hasIncome` is not yes (even with `rental.hasRentalIncome = "yes"` leftover); full rental chain and row validation; one-time this-year hidden without income but next-year always required; year/month validators (month 0/13, year 2025 for "this year" at `ON`=2026-10-13, year 2027 for next year); deductions: empty → the single `none` error, ticking None clears it, one amount clears it, ticking None hides amounts (stale amount ignored), negative amount rejected.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** `person-income-extras.ts` and wire into `person.ts`. Use `ctx.on` (not `new Date()`) for year checks. Extend `completePerson`.

- [ ] **Step 4: Run tests, type check, lint.**

- [ ] **Step 5: Commit** — `feat(saca2): add rental, one-time income, and deduction questions`.

---

### Task 8: Rich-household fixture, flow checks, and docs

**Files:**
- Modify: `lib/masshealth/saca2/__tests__/complete-answers.ts` (add `completeRichHousehold()`)
- Modify: `lib/masshealth/saca2/__tests__/complete-flow.test.ts`
- Modify: `docs/superpowers/specs/2026-10-13-saca2-application-design.md` (§6 Phase 1 row: name this plan and "done once merged")

**Interfaces:**
- Consumes: everything above.
- Produces: `completeRichHousehold()` — a married couple, both applying, Person 1 a noncitizen with an eligible status who has wages (seasonal, with months), self-employment, a pension (source), and capital gains; claims a dependent; is pregnant with one baby; was in foster care; needs accommodations (one condition, one accommodation); receives rental income (two units); has one-time income this year and next year; reports two deductions; ticks several demographic options. Person 2 is a citizen with no income, claimed as a dependent by Person 1's tax filer is not used (keep simple: `claimedAsDependent: "no"`), `deductions.none: true`.

- [ ] **Step 1: Add `completeRichHousehold()`** (fresh objects each call; build from `emptySaca2Answers()`, reuse `completePerson` for both people with overrides, then set the rich answers; sign as `applicant`, `longTermCare` intake box off so Supplement A stays hidden). Verify the visible steps are exactly the expected list for a household whose Person 1 is under 65 and Person 2 under 65 (`intake, person1, person2, aian, previousBills, assets, healthInsurance, hra, signature` — confirm against `getWizardSteps` and fix the expectation, not the rules).

- [ ] **Step 2: Flow tests** — add to `complete-flow.test.ts`: (a) `completeRichHousehold` has the expected steps and every step validates `{}`; (b) dropping one required answer from each new area is caught by the right step with the exact error object (spot-check: `tax.agreesToFileIfAptc`, `pregnant`, `rentOrOwn`, `oneTimeIncome.nextYear`, `deductions` neither None nor an amount, a wages row without `seasonal`); (c) the three existing fixtures still pass unchanged.

- [ ] **Step 3: Spec line edit** in §6 mirroring plan 2b-2's edit: `**1b-3** (plan \`2026-10-16-saca2-person-details.md\`: …remaining Person-block questions… — done once merged)`. Verify with `grep -n "2026-10-16-saca2-person-details" docs/superpowers/specs/2026-10-13-saca2-application-design.md`.

- [ ] **Step 4: Full verification**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2 components/application lib/phi-token lib/db app/application app/api/config`
Expected: everything passes (re-run load-sensitive unrelated files alone if they time out, and report).

- [ ] **Step 5: Commit** — `test(saca2): cover the full person block with a rich-household fixture`.

---

## What comes next (not part of this plan)

- **Plan 2c:** the pre-flag gate items from the earlier final reviews (ungated ACA-3 social-worker and mobile routes that can overwrite SACA-2 drafts, non-modal resume prompt, Save & Exit blocked during backoff and non-429 4xx, autosave status/retry, spec §4.3 stale line, closed-account balance requirement and missing IRA/Keogh/pension asset types, non-emancipated minor `signedBy`, spouse PCA help text, deploy-workflow `SACA2_ENABLED`). The flag stays off until 2c is done.
- **Plan 3:** PDF field map and fill route using these answers; it must fill only what is visible at both step and question level (stale answers persist after gates flip).
