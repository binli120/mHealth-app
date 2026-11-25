# SACA-2 Remaining Steps, Part 1 (Phase 1b-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the question content for the SACA-2 steps that still have none and that do not belong to a supplement: previous-bills detail, Step 5 assets, Step 6 health insurance, Step 7 health reimbursement arrangements, Step 8 personal-care attendant, Step 9 additional coverage, and the Step 10 signer details — so the wizard collects every question on those steps.

**Architecture:** Pure data additions on the platform shipped in plan 2: new answer fields in `types.ts`, new step content modules under `lib/masshealth/saca2/questions/`, registered in `questions/index.ts`. No new UI components (the generic `Saca2StepForm` already renders repeaters, yes/no groups, selects, and checkboxes). The `SACA2_ENABLED` flag stays **off**.

**Tech Stack:** TypeScript, Vitest, existing question model/builders/validators from plan 2.

**Spec:** `docs/superpowers/specs/2026-10-13-saca2-application-design.md` (Phase 1, "1b"). Builds on `docs/superpowers/plans/2026-10-13-saca2-wizard-core.md` (merged).

## Scope and sequence

| Plan | Content | Status |
|---|---|---|
| 1, 2 | foundation; wizard platform + six steps | merged |
| **2b-1 (this file)** | previous-bills detail, assets, health insurance, HRA, PCA, Step 9, signer details | ready |
| 2b-2 | Supplements A–D (long-term care, AI/AN, PCA, jobs), ARD-1122 and IRS 4506 attachment data | after 2b-1 |
| 2b-3 | remaining Person-block questions: optional demographics, tax/Health Connector, accommodations, pregnancy/foster care, deductions, rental/one-time/seasonal/self-employment income | after 2b-2 |
| 3, 4, 5 | PDF fill; eligibility engine; i18n, chat, touchpoints, e2e, rollout | after 2b-3 |

The flag must stay off until 2b-3 ships and the "gate before the flag" items from plan 2's final review are done (ungated ACA-3 routes on the social-worker and mobile pages, modal resume prompt, Save & Exit backoff, autosave status).

## Decisions made here (easy to change)

1. **Asset gates are a fully-typed map.** `assets.gates` becomes `Record<AssetCategory, YesNo | null>` with all 12 keys defaulting to `null` (two new keys for the form's retirement-account and closed-account sub-questions). It stops being a free-form map, so garbage values are type-filtered by the hydration normalizer like every other field.
2. **One new PHI top-level key, `signing`** (responsible-party identity incl. SSN). It is added to both `SACA2_PHI_KEYS` and the shared `PHI_DATA_KEYS`, so the server strip covers it. `signature` stays server-safe and holds only `signedBy`.
3. **Chain-aware visibility.** Every conditional question checks its whole parent chain (e.g. the Part D date shows only when `hasOtherCoverage === "yes"` AND `hasMedicare` AND `hasPartD === "yes"`), because stale answers under a hidden parent must never reappear or block Next (the class of bug fixed for Person 2 in plan 2).
4. **`suppD` visibility tightens**: an "enrolled in employer coverage" tick only counts while `hasOtherCoverage === "yes"`.
5. **`pca.byPerson` defaults to two blank entries** (Person 1, Person 2) so the spouse's PCA answers have a stable path.
6. Facility-only fields (balance on the admission date, trust principal on admission) show only for facility applicants: the Long-term care program box is ticked, or Supplement A says nursing facility.

## Global Constraints

- Run commands from `/Users/blee/dev/masshealth-repo/mHealth-app` with Node 22: `export PATH=/Users/blee/.nvm/versions/node/v22.23.0/bin:$PATH` (the shell default, Node 18.0.0, cannot run vitest).
- Form source of truth: SACA-2_2026-08 PDF, form pages 12–18 (Steps 4–10). Question wording follows the form.
- PHI never in the server `draft_state`: every top-level answer key except `intake` and `signature` is PHI; the client split and the server strip share `PHI_DATA_KEYS` in `lib/phi-token/phi-fields.ts`.
- Question `path`s must resolve to a non-`undefined` default on `emptySaca2Answers()` (the registry test enforces this for every implemented step).
- Repeater `emptyItem()` must return a complete row (every field of the row interface); use `satisfies <Row>` on the literal so a missing or misspelled field is a type error.
- Checkbox-typed row fields (`open`, `joint`, `revocable`) hold booleans, never "yes"/"no" strings.
- No `APPROVED`/determination wording; English only.
- Repo style: 2-space indent, no semicolons, double quotes, `@author: Bin Lee` / `@email: blee@comura.ai` header on every new file, tests in `__tests__/` next to the module, imports via `@/` (relative inside a module folder is fine).
- ACA-3 behaviour must not change; its tests must stay green.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the implementer's own model name is acceptable).

## Review Focus

1. **PHI in the new `signing` key** (responsible party SSN, name, address) never reaches the server draft; the strip test must include it. → Task 1.
2. **Hidden or stale answers must not block Next**: a repeater whose gate is "no" (or whose gate was flipped from "yes" to "no" after rows were added) must produce no errors; chained children under a hidden parent must not be required. → Tasks 2–6.
3. **Spouse-only PCA questions appear only when Person 2 actually exists** (married, or has data) — not for a blank hidden Person 2 and not for a single applicant. → Task 5.
4. **Facility-only fields** (admission-date balances, trust principal on admission) appear only for facility applicants, and an invalid value in a hidden one never blocks. → Task 3.
5. **Row completeness**: an added row has every field of its interface, and checkbox row fields stay booleans. → Tasks 3, 4.
6. **Under-18 applicants**: the emancipated-minor and responsible-party questions appear only when Person 1's age is known and under 18, or when a responsible party is chosen as signer; an unknown date of birth must not trigger them. → Task 6.

---

### Task 1: Answer types, defaults, and the `signing` PHI key

**Files:**
- Modify: `lib/masshealth/saca2/types.ts`
- Modify: `lib/phi-token/phi-fields.ts` (add `"signing"`)
- Modify: `lib/masshealth/saca2/__tests__/types.test.ts`
- Modify: `lib/masshealth/saca2/__tests__/wizard-state.test.ts` (one test)
- Modify: `lib/db/__tests__/application-drafts-phi-strip.test.ts` (add `signing` to the stripped input)

**Interfaces:**
- Consumes: existing types (plans 1–2).
- Produces:
  - `AssetCategory` gains `"retirementAccounts" | "closedAccounts"`.
  - `Saca2Assets.gates: Record<AssetCategory, YesNo | null>`; default is all 12 keys `null`.
  - New row/entry interfaces: `MedicalBillRequest`, `MedicareEntry`, `EmployerCoverageEntry`, `HraType`, `HraEntry`, `ResponsibleParty`.
  - `Saca2Answers.previousMedicalBills: { hasBills; wantsCoverageForPeriod: YesNo | null; earliestDate: string | null; requests: MedicalBillRequest[] }`.
  - `Saca2Answers.health` extended (fields listed in Step 3).
  - `Saca2Answers.signing: { emancipatedMinor: YesNo | null; responsibleParty: ResponsibleParty; registerToVote: YesNo | null }`.
  - `emptySaca2Answers().pca.byPerson` is two blank entries.
  - `SACA2_PHI_KEYS` includes `"signing"`; `PHI_DATA_KEYS` includes `"signing"`.

- [ ] **Step 1: Write the failing tests**

In `lib/masshealth/saca2/__tests__/types.test.ts` append at the end of the file:

```ts
describe("remaining-step defaults", () => {
  it("starts every asset gate unanswered, with all 12 keys present", () => {
    const gates = emptySaca2Answers().assets.gates
    expect(Object.keys(gates).sort()).toEqual([
      "annuities",
      "assistedLivingDeposit",
      "bankAccounts",
      "burial",
      "closedAccounts",
      "lifeInsurance",
      "otherRealEstate",
      "primaryResidence",
      "retirementAccounts",
      "securities",
      "trusts",
      "vehicles",
    ])
    for (const value of Object.values(gates)) expect(value).toBeNull()
  })

  it("starts with one blank PCA entry per possible person", () => {
    const { byPerson } = emptySaca2Answers().pca
    expect(byPerson).toHaveLength(2)
    for (const entry of byPerson) {
      expect(entry).toEqual({ permanentDisability: null, disabilityBlocksAdls: null, willContactPcmAgency: null })
    }
  })

  it("starts the previous-bills, health, and signing blocks empty", () => {
    const a = emptySaca2Answers()
    expect(a.previousMedicalBills).toEqual({ hasBills: null, wantsCoverageForPeriod: null, earliestDate: null, requests: [] })
    expect(a.health.hasOtherCoverage).toBeNull()
    expect(a.health.hasMedicare).toBe(false)
    expect(a.health.medicare).toEqual([])
    expect(a.health.otherPrograms).toEqual({ peaceCorps: false, tricare: false, vaHealth: false, masshealth: false, otherCoverage: false })
    expect(a.health.employerCoverage).toEqual([])
    expect(a.health.hra).toEqual({ anyoneOffered: null, entries: [] })
    expect(a.health.additionalCoverage).toEqual({
      breastOrCervicalCancer: null,
      breastOrCervicalName: "",
      hivPositive: null,
      hivName: "",
    })
    expect(a.signing.emancipatedMinor).toBeNull()
    expect(a.signing.registerToVote).toBeNull()
    expect(a.signing.responsibleParty.ssn).toBe("")
    expect(a.signing.responsibleParty.dateOfBirth).toBeNull()
  })

  it("keeps defaults independent between calls", () => {
    const a = emptySaca2Answers()
    const b = emptySaca2Answers()
    a.pca.byPerson[0].permanentDisability = "yes"
    a.health.medicare.push({
      personName: "A",
      claimNumber: "",
      coverageStart: null,
      hasPartD: null,
      partDStart: null,
      hasMedigap: null,
      medigapPlan: "",
      medigapStart: null,
    })
    expect(b.pca.byPerson[0].permanentDisability).toBeNull()
    expect(b.health.medicare).toHaveLength(0)
  })
})
```

In `lib/masshealth/saca2/__tests__/wizard-state.test.ts` replace the whole test named `keeps free-form maps such as asset gates and daily-living activities` with:

```ts
  it("keeps typed asset gates and free-form daily-living activities", () => {
    const s = normalizeSaca2State({
      schemaVersion: SACA2_SCHEMA_VERSION,
      data: {
        assets: { gates: { bankAccounts: "yes", trusts: "no", notAGate: "yes" } },
        supplements: { c: { activities: { eating: { needsHandsOnHelp: "yes", timesPerDay: 3, daysPerWeek: 7 } } } },
      },
    })!
    expect(s.data.assets.gates.bankAccounts).toBe("yes")
    expect(s.data.assets.gates.trusts).toBe("no")
    expect(s.data.assets.gates.vehicles).toBeNull()
    expect(s.data.assets.gates).not.toHaveProperty("notAGate")
    expect(s.data.supplements.c.activities.eating?.timesPerDay).toBe(3)
  })
```

In `lib/db/__tests__/application-drafts-phi-strip.test.ts`, inside the `wizardState.data` literal add after `supplements: { a: {} },`:

```ts
          signing: { responsibleParty: { ssn: "987654321", firstName: "Pat" } },
```

and change the final regex assertion to `.not.toMatch(/Ada|123456789|9999|987654321|Pat/)`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/masshealth/saca2/__tests__/types.test.ts lib/masshealth/saca2/__tests__/wizard-state.test.ts lib/db/__tests__/application-drafts-phi-strip.test.ts lib/phi-token`
Expected: FAIL — the new defaults are missing (`gates` has no keys, `a.health.hasOtherCoverage` is `undefined`, `signing` is missing), and the strip test fails because `signing` is not yet in the shared PHI list.

- [ ] **Step 3: Implement the type and default changes**

In `lib/masshealth/saca2/types.ts`:

1. In `SACA2_PHI_KEYS` add `"signing",` as the last element (after `"supplements",`).

2. Replace the `AssetCategory` union with:

```ts
export type AssetCategory =
  | "bankAccounts"
  | "retirementAccounts"
  | "closedAccounts"
  | "primaryResidence"
  | "otherRealEstate"
  | "lifeInsurance"
  | "securities"
  | "annuities"
  | "assistedLivingDeposit"
  | "vehicles"
  | "burial"
  | "trusts"
```

3. Replace `gates: Partial<Record<AssetCategory, YesNo | null>>` with `gates: Record<AssetCategory, YesNo | null>`.

4. Immediately above `export interface Saca2Answers {` insert:

```ts
export interface MedicalBillRequest {
  name: string
  /** ISO YYYY-MM-DD. */
  earliestDateRequested: string | null
  circumstancesChanged: YesNo | null
}

export interface MedicareEntry {
  personName: string
  claimNumber: string
  coverageStart: string | null
  hasPartD: YesNo | null
  partDStart: string | null
  hasMedigap: YesNo | null
  medigapPlan: string
  medigapStart: string | null
}

export interface EmployerCoverageEntry {
  employerName: string
  planName: string
  coveredNames: string
  policyNumber: string
  /** Free text: start and end dates (mm/dd/yyyy). */
  startEndDates: string
}

export type HraType = "qsehra" | "ichra"

export interface HraEntry {
  individualName: string
  dateOfBirth: string | null
  employerName: string
  federalTaxId: string
  hraType: HraType | null
  startDate: string | null
  endDate: string | null
  maxSelfOnlyAmount: number | null
  qsehraFamilyIntent: YesNo | null
  qsehraFamilyMax: number | null
  ichraAcceptIntent: YesNo | null
}

export interface ResponsibleParty {
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  ssn: string
  relationship: string
  dateOfBirth: string | null
  street: string
  apartment: string
  city: string
  state: string
  zip: string
  county: string
  phone: string
  phoneType: "mobile" | "home" | "work" | null
  secondPhone: string
  email: string
}
```

5. Replace `previousMedicalBills: { hasBills: YesNo | null }` in `Saca2Answers` with:

```ts
  previousMedicalBills: {
    hasBills: YesNo | null
    wantsCoverageForPeriod: YesNo | null
    /** ISO YYYY-MM-DD: earliest date MassHealth is needed. */
    earliestDate: string | null
    requests: MedicalBillRequest[]
  }
```

6. Replace the `health: { ... }` block in `Saca2Answers` with:

```ts
  health: {
    /** Step 6 Q1: anyone offered coverage from a job. */
    employerOfferedCoverage: YesNo | null
    /** Step 6 Q2 gate: anyone qualifies for or is enrolled in the listed coverage types. */
    hasOtherCoverage: YesNo | null
    hasMedicare: boolean
    medicare: MedicareEntry[]
    wantsPartBHelp: YesNo | null
    partBHelpNames: string
    otherPrograms: {
      peaceCorps: boolean
      tricare: boolean
      vaHealth: boolean
      masshealth: boolean
      otherCoverage: boolean
    }
    otherCoverageDetails: { coveredNames: string; policyNumber: string; startEndDates: string }
    enrolledInEmployerCoverage: boolean
    employerCoverage: EmployerCoverageEntry[]
    /** Step 7. */
    hra: { anyoneOffered: YesNo | null; entries: HraEntry[] }
    /** Step 9 (optional, spouse under 65). */
    additionalCoverage: {
      breastOrCervicalCancer: YesNo | null
      breastOrCervicalName: string
      hivPositive: YesNo | null
      hivName: string
    }
  }
```

7. In `Saca2Answers`, right after the `signature: { ... }` property add:

```ts
  /** Step 10 signer details — PHI (a responsible party's identity), kept out of `signature`. */
  signing: {
    emancipatedMinor: YesNo | null
    responsibleParty: ResponsibleParty
    registerToVote: YesNo | null
  }
```

8. In `emptySaca2Answers()` make these replacements:
   - `previousMedicalBills: { hasBills: null },` → `previousMedicalBills: { hasBills: null, wantsCoverageForPeriod: null, earliestDate: null, requests: [] },`
   - `gates: {},` → 
     ```ts
           gates: {
             bankAccounts: null,
             retirementAccounts: null,
             closedAccounts: null,
             primaryResidence: null,
             otherRealEstate: null,
             lifeInsurance: null,
             securities: null,
             annuities: null,
             assistedLivingDeposit: null,
             vehicles: null,
             burial: null,
             trusts: null,
           },
     ```
   - `health: { employerOfferedCoverage: null, enrolledInEmployerCoverage: false },` →
     ```ts
         health: {
           employerOfferedCoverage: null,
           hasOtherCoverage: null,
           hasMedicare: false,
           medicare: [],
           wantsPartBHelp: null,
           partBHelpNames: "",
           otherPrograms: { peaceCorps: false, tricare: false, vaHealth: false, masshealth: false, otherCoverage: false },
           otherCoverageDetails: { coveredNames: "", policyNumber: "", startEndDates: "" },
           enrolledInEmployerCoverage: false,
           employerCoverage: [],
           hra: { anyoneOffered: null, entries: [] },
           additionalCoverage: { breastOrCervicalCancer: null, breastOrCervicalName: "", hivPositive: null, hivName: "" },
         },
     ```
   - `pca: { needsPca: null, paidByMassHealthLastSixMonths: null, byPerson: [] },` →
     ```ts
         pca: {
           needsPca: null,
           paidByMassHealthLastSixMonths: null,
           byPerson: [
             { permanentDisability: null, disabilityBlocksAdls: null, willContactPcmAgency: null },
             { permanentDisability: null, disabilityBlocksAdls: null, willContactPcmAgency: null },
           ],
         },
     ```
   - `signature: { signedBy: null },` → 
     ```ts
         signature: { signedBy: null },
         signing: {
           emancipatedMinor: null,
           responsibleParty: {
             firstName: "",
             middleName: "",
             lastName: "",
             suffix: "",
             ssn: "",
             relationship: "",
             dateOfBirth: null,
             street: "",
             apartment: "",
             city: "",
             state: "MA",
             zip: "",
             county: "",
             phone: "",
             phoneType: null,
             secondPhone: "",
             email: "",
           },
           registerToVote: null,
         },
     ```

In `lib/phi-token/phi-fields.ts` add `"signing",` as the last element of `PHI_DATA_KEYS` and add a line to the doc comment: `signing — a responsible party's identity (SACA-2 Step 10).`

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run lib/masshealth/saca2 lib/db lib/phi-token components/application/saca2 && npx tsc --noEmit -p tsconfig.json`
Expected: PASS and no type errors. Expect two kinds of mechanical test updates, which you should make and mention in the report:
- a test that builds a `health` or `pca` literal with the old shape and now fails to type-check — update the literal to the new shape;
- a garbage-draft test in `wizard-state.test.ts` that asserts `assets.gates` falls back to `{}` — change its expectation to `emptySaca2Answers().assets.gates` (the default is now the 12-key null map).
Do not loosen any assertion about PHI keys or about rejected garbage values.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/types.ts lib/phi-token/phi-fields.ts lib/masshealth/saca2/__tests__/types.test.ts lib/masshealth/saca2/__tests__/wizard-state.test.ts lib/db/__tests__/application-drafts-phi-strip.test.ts
git commit -m "feat(saca2): add types and defaults for the remaining steps and the signing PHI key" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Previous-medical-bills detail

**Files:**
- Modify: `lib/masshealth/saca2/questions/root-steps.ts` (replace `PREVIOUS_BILLS_STEP_CONTENT`, extend imports)
- Modify: `lib/masshealth/saca2/__tests__/questions-content.test.ts` (loosen the step-list test)
- Test: `lib/masshealth/saca2/__tests__/questions-previous-bills.test.ts` (create)

**Interfaces:**
- Consumes: builders `date`, `repeater`, `text`, `yesNo` (plan 2), `validateStep` (plan 2), `MedicalBillRequest` fields (Task 1).
- Produces: `PREVIOUS_BILLS_STEP_CONTENT` with questions at `previousMedicalBills.{hasBills,wantsCoverageForPeriod,earliestDate,requests}`.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-previous-bills.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

describe("previousBills step", () => {
  it("requires the first answer only when nothing is answered", () => {
    expect(validateStep("previousBills", answers(), ON)).toEqual({
      "previousMedicalBills.hasBills": "This question is required.",
    })
  })

  it("is complete when there are no previous bills", () => {
    expect(validateStep("previousBills", answers((a) => (a.previousMedicalBills.hasBills = "no")), ON)).toEqual({})
  })

  it("asks whether coverage is wanted for that period when there are bills", () => {
    const errors = validateStep("previousBills", answers((a) => (a.previousMedicalBills.hasBills = "yes")), ON)
    expect(errors).toEqual({ "previousMedicalBills.wantsCoverageForPeriod": "This question is required." })
  })

  it("needs nothing more when coverage for the period is not wanted", () => {
    const a = answers((x) => {
      x.previousMedicalBills.hasBills = "yes"
      x.previousMedicalBills.wantsCoverageForPeriod = "no"
    })
    expect(validateStep("previousBills", a, ON)).toEqual({})
  })

  it("needs the earliest date and at least one person when coverage for the period is wanted", () => {
    const a = answers((x) => {
      x.previousMedicalBills.hasBills = "yes"
      x.previousMedicalBills.wantsCoverageForPeriod = "yes"
    })
    expect(validateStep("previousBills", a, ON)).toEqual({
      "previousMedicalBills.earliestDate": "This question is required.",
      "previousMedicalBills.requests": "Add at least one.",
    })
  })

  it("validates each requested person", () => {
    const a = answers((x) => {
      x.previousMedicalBills.hasBills = "yes"
      x.previousMedicalBills.wantsCoverageForPeriod = "yes"
      x.previousMedicalBills.earliestDate = "2026-08-01"
      x.previousMedicalBills.requests = [{ name: "", earliestDateRequested: null, circumstancesChanged: null }]
    })
    expect(validateStep("previousBills", a, ON)).toEqual({
      "previousMedicalBills.requests.0.name": "This question is required.",
      "previousMedicalBills.requests.0.earliestDateRequested": "This question is required.",
      "previousMedicalBills.requests.0.circumstancesChanged": "This question is required.",
    })
  })

  it("passes a complete request", () => {
    const a = answers((x) => {
      x.previousMedicalBills.hasBills = "yes"
      x.previousMedicalBills.wantsCoverageForPeriod = "yes"
      x.previousMedicalBills.earliestDate = "2026-08-01"
      x.previousMedicalBills.requests = [
        { name: "Edna Testcase", earliestDateRequested: "2026-08-01", circumstancesChanged: "no" },
      ]
    })
    expect(validateStep("previousBills", a, ON)).toEqual({})
  })

  it("ignores stale answers once the first answer flips back to no", () => {
    const a = answers((x) => {
      x.previousMedicalBills.hasBills = "no"
      x.previousMedicalBills.wantsCoverageForPeriod = "yes"
      x.previousMedicalBills.earliestDate = null
      x.previousMedicalBills.requests = []
    })
    expect(validateStep("previousBills", a, ON)).toEqual({})
  })
})
```

In `lib/masshealth/saca2/__tests__/questions-content.test.ts` replace the test `implements exactly the six planned steps` with:

```ts
  it("implements exactly the steps listed here (extend the list as steps gain content)", () => {
    const withContent = ["aian", "intake", "person1", "person2", "previousBills", "signature"]
    expect([...IMPLEMENTED_STEP_IDS].sort()).toEqual([...withContent].sort())
    for (const id of IMPLEMENTED_STEP_IDS) expect(getStepContent(id)).not.toBeNull()
    expect(getStepContent("assets")).toBeNull()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-previous-bills.test.ts`
Expected: FAIL — `wantsCoverageForPeriod` is never required and the date and requests never validated (the step still only has the `hasBills` question).

- [ ] **Step 3: Implement**

In `lib/masshealth/saca2/questions/root-steps.ts` change the builders import to:

```ts
import { checkbox, date, opts, repeater, select, text, yesNo } from "./builders"
```

and replace the whole `PREVIOUS_BILLS_STEP_CONTENT` export with:

```ts
const hasPreviousBills = (ctx: Saca2QuestionContext) => ctx.answers.previousMedicalBills.hasBills === "yes"
const wantsPreviousPeriod = (ctx: Saca2QuestionContext) =>
  hasPreviousBills(ctx) && ctx.answers.previousMedicalBills.wantsCoverageForPeriod === "yes"

export const PREVIOUS_BILLS_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "bills",
      title: "Previous medical bills",
      questions: [
        yesNo("previousMedicalBills.hasBills", "Do you or your spouse have bills for medical services you got in the three months before submitting this application?", {
          required: true,
          help: "If Yes, MassHealth may be able to pay for these bills.",
        }),
        yesNo("previousMedicalBills.wantsCoverageForPeriod", "Do you or your spouse want to apply for MassHealth for that time period?", {
          required: true,
          visibleWhen: hasPreviousBills,
          help: "If Yes, you must give proof of all income and assets owned during that time period.",
        }),
        date("previousMedicalBills.earliestDate", "What is the earliest date for which you need MassHealth?", {
          required: true,
          visibleWhen: wantsPreviousPeriod,
        }),
        repeater(
          "previousMedicalBills.requests",
          "People requesting payment of previous medical bills",
          {
            questions: [
              text("name", "Name", { required: true }),
              date("earliestDateRequested", "Earliest date requested", { required: true }),
              yesNo("circumstancesChanged", "Any change in circumstances during this time?", { required: true }),
            ],
            emptyItem: () => ({ name: "", earliestDateRequested: null, circumstancesChanged: null }),
            addLabel: "Add a person",
            itemTitle: "Person",
            maxItems: 5,
          },
          { required: true, visibleWhen: wantsPreviousPeriod },
        ),
      ],
    },
  ],
}
```

and add `Saca2QuestionContext` to the type import from `./types` in that file (`import type { Saca2QuestionContext, Saca2StepContent } from "./types"`).

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run lib/masshealth/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS (the registry test "every path resolves on empty answers" now also covers the new `previousBills` paths, which resolve thanks to Task 1's defaults); no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/root-steps.ts lib/masshealth/saca2/__tests__/questions-previous-bills.test.ts lib/masshealth/saca2/__tests__/questions-content.test.ts
git commit -m "feat(saca2): collect the previous-medical-bills coverage period and requesters" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Step 5 — assets

**Files:**
- Create: `lib/masshealth/saca2/questions/assets.ts`
- Modify: `lib/masshealth/saca2/questions/index.ts` (register `assets`)
- Modify: `lib/masshealth/saca2/__tests__/questions-content.test.ts` (list gains `"assets"`; remove the `expect(getStepContent("assets")).toBeNull()` line)
- Test: `lib/masshealth/saca2/__tests__/questions-assets.test.ts` (create)

**Interfaces:**
- Consumes: builders (`checkbox`, `date`, `money`, `opts`, `repeater`, `select`, `text`, `yesNo`), row interfaces and `AssetCategory` (Task 1), `Saca2QuestionContext`.
- Produces: `ASSETS_STEP_CONTENT: Saca2StepContent` (root scope) registered under step id `assets`. Gate questions live at `assets.gates.<AssetCategory>`; row repeaters at `assets.bankAccounts`, `assets.primaryResidence`, `assets.otherRealEstate`, `assets.lifeInsurance`, `assets.securities`, `assets.annuities`, `assets.assistedLivingDeposits`, `assets.vehicles`, `assets.burial`, `assets.trusts`. Every gate is required; a repeater is visible and required only while its gate (for banks: any of the three bank-related gates) is `"yes"`.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-assets.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { getStepContent, validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type AssetCategory, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")
const CATEGORIES: AssetCategory[] = [
  "bankAccounts",
  "retirementAccounts",
  "closedAccounts",
  "primaryResidence",
  "otherRealEstate",
  "lifeInsurance",
  "securities",
  "annuities",
  "assistedLivingDeposit",
  "vehicles",
  "burial",
  "trusts",
]

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

function allNo(a: Saca2Answers) {
  for (const c of CATEGORIES) a.assets.gates[c] = "no"
}

describe("assets step", () => {
  it("is registered with root scope", () => {
    expect(getStepContent("assets")?.scope).toBe("root")
  })

  it("requires every gate question", () => {
    const errors = validateStep("assets", answers(), ON)
    expect(Object.keys(errors).sort()).toEqual(CATEGORIES.map((c) => `assets.gates.${c}`).sort())
  })

  it("is complete when every gate is no", () => {
    expect(validateStep("assets", answers(allNo), ON)).toEqual({})
  })

  it("does not block on rows left behind after a gate flips back to no", () => {
    const a = answers((x) => {
      allNo(x)
      x.assets.bankAccounts = [
        { ownerName: "", accountType: "", institution: "", accountNumber: "", currentBalance: null, balanceOnAdmissionDate: null, open: true, closedOn: null, balanceWhenClosed: null },
      ]
    })
    expect(validateStep("assets", a, ON)).toEqual({})
  })

  describe("bank accounts", () => {
    it("asks for at least one account when any bank-related gate is yes", () => {
      for (const gate of ["bankAccounts", "retirementAccounts", "closedAccounts"] as const) {
        const a = answers((x) => {
          allNo(x)
          x.assets.gates[gate] = "yes"
        })
        expect(validateStep("assets", a, ON)).toEqual({ "assets.bankAccounts": "Add at least one." })
      }
    })

    it("validates each account row", () => {
      const a = answers((x) => {
        allNo(x)
        x.assets.gates.bankAccounts = "yes"
        x.assets.bankAccounts = [
          { ownerName: "", accountType: "", institution: "", accountNumber: "", currentBalance: null, balanceOnAdmissionDate: null, open: true, closedOn: null, balanceWhenClosed: null },
        ]
      })
      expect(Object.keys(validateStep("assets", a, ON)).sort()).toEqual([
        "assets.bankAccounts.0.accountType",
        "assets.bankAccounts.0.currentBalance",
        "assets.bankAccounts.0.institution",
        "assets.bankAccounts.0.ownerName",
      ])
    })

    it("requires the closing details only for a closed account", () => {
      const row = { ownerName: "A", accountType: "checking", institution: "B", accountNumber: "1", currentBalance: 5, balanceOnAdmissionDate: null, open: false, closedOn: null, balanceWhenClosed: null }
      const a = answers((x) => {
        allNo(x)
        x.assets.gates.closedAccounts = "yes"
        x.assets.bankAccounts = [row]
      })
      expect(Object.keys(validateStep("assets", a, ON)).sort()).toEqual([
        "assets.bankAccounts.0.balanceWhenClosed",
        "assets.bankAccounts.0.closedOn",
      ])
      a.assets.bankAccounts = [{ ...row, open: true }]
      expect(validateStep("assets", a, ON)).toEqual({})
    })

    it("checks the admission-date balance only for facility applicants", () => {
      const row = { ownerName: "A", accountType: "savings", institution: "B", accountNumber: "1", currentBalance: 5, balanceOnAdmissionDate: -5, open: true, closedOn: null, balanceWhenClosed: null }
      const home = answers((x) => {
        allNo(x)
        x.assets.gates.bankAccounts = "yes"
        x.assets.bankAccounts = [row]
      })
      expect(validateStep("assets", home, ON)).toEqual({})
      const facility = answers((x) => {
        allNo(x)
        x.intake.programs.longTermCare = true
        x.assets.gates.bankAccounts = "yes"
        x.assets.bankAccounts = [row]
      })
      expect(validateStep("assets", facility, ON)).toEqual({
        "assets.bankAccounts.0.balanceOnAdmissionDate": "Enter a number that is 0 or more.",
      })
    })
  })

  describe("other categories", () => {
    function withRow<K extends keyof Saca2Answers["assets"]>(gate: AssetCategory, key: K, rows: unknown[]) {
      return answers((x) => {
        allNo(x)
        x.assets.gates[gate] = "yes"
        ;(x.assets[key] as unknown[]) = rows
      })
    }

    it("asks for rows under each yes gate (note the deposits and real-estate paths)", () => {
      const expected: Array<[AssetCategory, string]> = [
        ["primaryResidence", "assets.primaryResidence"],
        ["otherRealEstate", "assets.otherRealEstate"],
        ["lifeInsurance", "assets.lifeInsurance"],
        ["securities", "assets.securities"],
        ["annuities", "assets.annuities"],
        ["assistedLivingDeposit", "assets.assistedLivingDeposits"],
        ["vehicles", "assets.vehicles"],
        ["burial", "assets.burial"],
        ["trusts", "assets.trusts"],
      ]
      for (const [gate, path] of expected) {
        const a = answers((x) => {
          allNo(x)
          x.assets.gates[gate] = "yes"
        })
        expect(validateStep("assets", a, ON), gate).toEqual({ [path]: "Add at least one." })
      }
    })

    it("validates a real-estate row", () => {
      const a = withRow("primaryResidence", "primaryResidence", [{ address: "", propertyType: "", currentValue: null }])
      expect(Object.keys(validateStep("assets", a, ON)).sort()).toEqual([
        "assets.primaryResidence.0.address",
        "assets.primaryResidence.0.currentValue",
        "assets.primaryResidence.0.propertyType",
      ])
      const ok = withRow("primaryResidence", "primaryResidence", [{ address: "1 Example St", propertyType: "oneFamily", currentValue: 450000 }])
      expect(validateStep("assets", ok, ON)).toEqual({})
    })

    it("validates a vehicle row and accepts a complete one", () => {
      const bad = withRow("vehicles", "vehicles", [{ owner: "you", vehicleType: "", yearMakeModel: "", fairMarketValue: null, amountOwed: null }])
      expect(Object.keys(validateStep("assets", bad, ON)).sort()).toEqual([
        "assets.vehicles.0.fairMarketValue",
        "assets.vehicles.0.vehicleType",
      ])
      const ok = withRow("vehicles", "vehicles", [{ owner: "spouse", vehicleType: "Car", yearMakeModel: "2018 Honda Civic", fairMarketValue: 9000, amountOwed: 0 }])
      expect(validateStep("assets", ok, ON)).toEqual({})
    })

    it("validates a trust row and checks principal on admission only for facility applicants", () => {
      const row = { name: "Family Trust", revocable: false, currentPrincipal: 90000, principalOnAdmissionDate: -1, trustees: "", grantors: "", beneficiaries: "" }
      expect(validateStep("assets", withRow("trusts", "trusts", [row]), ON)).toEqual({})
      const facility = withRow("trusts", "trusts", [row])
      facility.intake.programs.longTermCare = true
      expect(validateStep("assets", facility, ON)).toEqual({
        "assets.trusts.0.principalOnAdmissionDate": "Enter a number that is 0 or more.",
      })
      const missing = withRow("trusts", "trusts", [{ ...row, name: "", currentPrincipal: null, principalOnAdmissionDate: null }])
      expect(Object.keys(validateStep("assets", missing, ON)).sort()).toEqual([
        "assets.trusts.0.currentPrincipal",
        "assets.trusts.0.name",
      ])
    })

    it("validates life insurance, securities, annuity, deposit, and burial rows", () => {
      expect(
        Object.keys(validateStep("assets", withRow("lifeInsurance", "lifeInsurance", [{ owners: "", company: "", policyNumber: "", faceValue: null, insuranceType: "", cashSurrenderValue: null }]), ON)).sort(),
      ).toEqual([
        "assets.lifeInsurance.0.company",
        "assets.lifeInsurance.0.faceValue",
        "assets.lifeInsurance.0.insuranceType",
        "assets.lifeInsurance.0.policyNumber",
      ])
      expect(
        Object.keys(validateStep("assets", withRow("securities", "securities", [{ kind: "stocks", owners: "", company: "", accountNumber: "", currentValue: null, valueOnAdmissionDate: null, joint: false }]), ON)),
      ).toEqual(["assets.securities.0.currentValue"])
      expect(
        Object.keys(validateStep("assets", withRow("annuities", "annuities", [{ owners: "", institution: "", contractNumber: "", purchasedOn: null }]), ON)).sort(),
      ).toEqual([
        "assets.annuities.0.contractNumber",
        "assets.annuities.0.institution",
        "assets.annuities.0.purchasedOn",
      ])
      expect(
        Object.keys(validateStep("assets", withRow("assistedLivingDeposit", "assistedLivingDeposits", [{ facilityName: "", facilityAddress: "", amount: null, depositedOn: null }]), ON)).sort(),
      ).toEqual(["assets.assistedLivingDeposits.0.amount", "assets.assistedLivingDeposits.0.facilityName"])
      expect(
        validateStep("assets", withRow("burial", "burial", [{ owner: "you", kind: "contract", amount: 5000 }]), ON),
      ).toEqual({})
    })
  })
})
```

In `lib/masshealth/saca2/__tests__/questions-content.test.ts`: in the test `implements exactly the steps listed here` change the array to `["aian", "assets", "intake", "person1", "person2", "previousBills", "signature"]` and delete the line `expect(getStepContent("assets")).toBeNull()` (use `expect(getStepContent("suppA")).toBeNull()` instead).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-assets.test.ts`
Expected: FAIL — `getStepContent("assets")` is `null` and `validateStep("assets", …)` returns `{}`.

- [ ] **Step 3: Write the content module**

Create `lib/masshealth/saca2/questions/assets.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type {
  AnnuityRow,
  AssetCategory,
  BankAccountRow,
  BurialRow,
  FacilityDepositRow,
  LifeInsuranceRow,
  RealEstateRow,
  SecuritiesRow,
  TrustRow,
  VehicleRow,
} from "../types"
import { checkbox, date, money, opts, repeater, select, text, yesNo } from "./builders"
import type { Saca2Question, Saca2QuestionContext, Saca2Section, Saca2StepContent } from "./types"

const gateIs = (category: AssetCategory) => (ctx: Saca2QuestionContext) =>
  ctx.answers.assets.gates[category] === "yes"

const anyBankGate = (ctx: Saca2QuestionContext) =>
  (["bankAccounts", "retirementAccounts", "closedAccounts"] as const).some(
    (category) => ctx.answers.assets.gates[category] === "yes",
  )

/** Facility applicants must also report values on the date of admission (60-month look-back). */
const isFacilityApplicant = (ctx: Saca2QuestionContext) =>
  ctx.answers.intake.programs.longTermCare || ctx.answers.supplements.a.needsNursingFacility === "yes"

const gate = (category: AssetCategory, label: string): Saca2Question =>
  yesNo(`assets.gates.${category}`, label, { required: true })

const OWNER_OPTIONS = opts([
  ["you", "You"],
  ["spouse", "Your spouse"],
])

const PROPERTY_TYPES = opts([
  ["oneFamily", "One-family"],
  ["twoFamily", "Two-family"],
  ["threeFamily", "Three-family"],
  ["other", "Other"],
])

const ACCOUNT_TYPES = opts([
  ["checking", "Checking"],
  ["savings", "Savings"],
  ["certificateOfDeposit", "Certificate of deposit"],
  ["creditUnion", "Credit union"],
  ["now", "NOW account"],
  ["moneyMarket", "Money market"],
  ["pna", "Personal needs allowance (PNA) account"],
  ["other", "Other"],
])

function realEstateRepeater(path: string, label: string, itemTitle: string, addLabel: string, category: AssetCategory): Saca2Question {
  return repeater(
    path,
    label,
    {
      questions: [
        text("address", "Address", { required: true }),
        select("propertyType", "Type of property", PROPERTY_TYPES, { required: true }),
        money("currentValue", "Current value ($)", { required: true }),
      ],
      emptyItem: () => ({ address: "", propertyType: "", currentValue: null }) satisfies RealEstateRow,
      addLabel,
      itemTitle,
      maxItems: 6,
    },
    { required: true, visibleWhen: gateIs(category), help: "Send a copy of the deed, the current tax bill, and proof of the amount owed." },
  )
}

const BANK_SECTION: Saca2Section = {
  id: "bank",
  title: "Bank accounts",
  description: "If you are applying for long-term care, also tell us about every account you or your spouse owned in the past 60 months.",
  questions: [
    gate("bankAccounts", "Do you or your spouse have any bank accounts or certificates of deposit, including checking, savings, credit union, NOW, money-market, and personal needs allowance (PNA) accounts?"),
    gate("retirementAccounts", "Do you or your spouse have any retirement accounts, including individual retirement accounts (IRAs), Keogh, or pension funds?"),
    gate("closedAccounts", "Have you or your spouse or a joint owner closed any accounts in the past 60 months, including any accounts you owned jointly with anyone else?"),
    repeater(
      "assets.bankAccounts",
      "Accounts",
      {
        questions: [
          text("ownerName", "Name on account", { required: true }),
          select("accountType", "Account type", ACCOUNT_TYPES, { required: true }),
          text("institution", "Name of bank or institution", { required: true }),
          text("accountNumber", "Account number"),
          money("currentBalance", "Current balance ($)", { required: true }),
          money("balanceOnAdmissionDate", "Balance on the date of admission to the facility ($)", { visibleWhen: isFacilityApplicant }),
          checkbox("open", "This account is open"),
          date("closedOn", "Date account closed", { required: true, visibleWhen: (ctx) => ctx.item?.open === false }),
          money("balanceWhenClosed", "Amount on the date the account was closed ($)", {
            required: true,
            visibleWhen: (ctx) => ctx.item?.open === false,
          }),
        ],
        emptyItem: () =>
          ({
            ownerName: "",
            accountType: "",
            institution: "",
            accountNumber: "",
            currentBalance: null,
            balanceOnAdmissionDate: null,
            open: true,
            closedOn: null,
            balanceWhenClosed: null,
          }) satisfies BankAccountRow,
        addLabel: "Add an account",
        itemTitle: "Account",
        maxItems: 10,
      },
      { required: true, visibleWhen: anyBankGate, help: "Send a copy of your updated passbooks or current account statements (the past 60 months for nursing-facility coverage)." },
    ),
  ],
}

const REAL_ESTATE_SECTION: Saca2Section = {
  id: "realEstate",
  title: "Real estate",
  questions: [
    gate("primaryResidence", "Do you or your spouse own or have a legal interest in your primary residence?"),
    realEstateRepeater("assets.primaryResidence", "Primary residence", "Primary residence", "Add a property", "primaryResidence"),
    gate("otherRealEstate", "Do you or your spouse own or have a legal interest in any real estate other than your primary residence?"),
    realEstateRepeater("assets.otherRealEstate", "Other real estate", "Property", "Add a property", "otherRealEstate"),
  ],
}

const LIFE_INSURANCE_SECTION: Saca2Section = {
  id: "lifeInsurance",
  title: "Life insurance",
  questions: [
    gate("lifeInsurance", "Do you or your spouse own any life insurance?"),
    repeater(
      "assets.lifeInsurance",
      "Policies",
      {
        questions: [
          text("owners", "Name(s) of owner(s)"),
          text("company", "Insurance company", { required: true }),
          text("policyNumber", "Policy number", { required: true }),
          money("faceValue", "Face value ($)", { required: true }),
          text("insuranceType", "Insurance type", { required: true }),
          money("cashSurrenderValue", "Current cash-surrender value ($)"),
        ],
        emptyItem: () =>
          ({ owners: "", company: "", policyNumber: "", faceValue: null, insuranceType: "", cashSurrenderValue: null }) satisfies LifeInsuranceRow,
        addLabel: "Add a policy",
        itemTitle: "Policy",
        maxItems: 8,
      },
      {
        required: true,
        visibleWhen: gateIs("lifeInsurance"),
        help: "Send a copy of the first page of each policy. If total face value is more than $1,500 per person, also send a letter from the insurer showing the current cash-surrender value (not needed for term policies).",
      },
    ),
  ],
}

const SECURITIES_SECTION: Saca2Section = {
  id: "securities",
  title: "Securities and brokerage accounts",
  questions: [
    gate("securities", "Do you or your spouse own any stocks, bonds, savings bonds, mutual funds, securities, assets held in safe-deposit boxes, cash not in the bank, options, or future contracts?"),
    repeater(
      "assets.securities",
      "Holdings",
      {
        questions: [
          select(
            "kind",
            "Type",
            opts([
              ["cash", "Cash"],
              ["stocks", "Stocks"],
              ["bonds", "Bonds"],
              ["savingsBonds", "Savings bonds"],
              ["mutualFunds", "Mutual funds"],
              ["options", "Options"],
              ["futures", "Future contracts"],
              ["other", "Other"],
            ]),
            { required: true },
          ),
          text("owners", "Owner name(s)"),
          text("company", "Company name"),
          text("accountNumber", "Account number"),
          money("currentValue", "Current value ($)", { required: true }),
          money("valueOnAdmissionDate", "Value on the date of admission to the facility ($)", { visibleWhen: isFacilityApplicant }),
          checkbox("joint", "This is a joint asset"),
        ],
        emptyItem: () =>
          ({ kind: "cash", owners: "", company: "", accountNumber: "", currentValue: null, valueOnAdmissionDate: null, joint: false }) satisfies SecuritiesRow,
        addLabel: "Add a holding",
        itemTitle: "Holding",
        maxItems: 10,
      },
      { required: true, visibleWhen: gateIs("securities"), help: "Send proof of the current value (except cash)." },
    ),
  ],
}

const ANNUITIES_SECTION: Saca2Section = {
  id: "annuities",
  title: "Annuities",
  questions: [
    gate("annuities", "Did you or your spouse or someone on your or your spouse's behalf purchase or in any way change an annuity?"),
    repeater(
      "assets.annuities",
      "Annuities",
      {
        questions: [
          text("owners", "Name(s) of owner(s)"),
          text("institution", "Name of the institution issuing the annuity", { required: true }),
          text("contractNumber", "Contract number", { required: true }),
          date("purchasedOn", "Date purchased", { required: true }),
        ],
        emptyItem: () => ({ owners: "", institution: "", contractNumber: "", purchasedOn: null }) satisfies AnnuityRow,
        addLabel: "Add an annuity",
        itemTitle: "Annuity",
        maxItems: 6,
      },
      {
        required: true,
        visibleWhen: gateIs("annuities"),
        help: "To be eligible you may be required to name the Commonwealth as a remainder beneficiary. Send a copy of the contract and proof of its full value less any penalties and fees.",
      },
    ),
  ],
}

const DEPOSITS_SECTION: Saca2Section = {
  id: "deposits",
  title: "Assisted living and similar deposits",
  questions: [
    gate("assistedLivingDeposit", "Have you, your spouse, or someone acting on your behalf given a deposit to any health-care or residential facility, like an assisted-living facility, a continuing-care retirement community, or a life-care community?"),
    repeater(
      "assets.assistedLivingDeposits",
      "Deposits",
      {
        questions: [
          text("facilityName", "Name of facility", { required: true }),
          text("facilityAddress", "Address of facility"),
          money("amount", "Amount of deposit ($)", { required: true }),
          date("depositedOn", "Date the deposit was given"),
        ],
        emptyItem: () => ({ facilityName: "", facilityAddress: "", amount: null, depositedOn: null }) satisfies FacilityDepositRow,
        addLabel: "Add a deposit",
        itemTitle: "Deposit",
        maxItems: 4,
      },
      { required: true, visibleWhen: gateIs("assistedLivingDeposit"), help: "Send a copy of the contract you signed with the facility and any documents about this deposit." },
    ),
  ],
}

const VEHICLES_SECTION: Saca2Section = {
  id: "vehicles",
  title: "Vehicles and mobile homes",
  questions: [
    gate("vehicles", "Do you or your spouse own any vehicles, like cars, vans, trucks, recreational vehicles, mobile homes, or boats?"),
    repeater(
      "assets.vehicles",
      "Vehicles",
      {
        questions: [
          select("owner", "Owner", OWNER_OPTIONS, { required: true }),
          text("vehicleType", "Type of vehicle", { required: true }),
          text("yearMakeModel", "Year, make, and model (or mobile home address)"),
          money("fairMarketValue", "Fair-market value ($)", { required: true }),
          money("amountOwed", "Amount owed ($)"),
        ],
        emptyItem: () => ({ owner: "you", vehicleType: "", yearMakeModel: "", fairMarketValue: null, amountOwed: null }) satisfies VehicleRow,
        addLabel: "Add a vehicle",
        itemTitle: "Vehicle",
        maxItems: 8,
      },
      {
        required: true,
        visibleWhen: gateIs("vehicles"),
        help: "Send a copy of the registration for each vehicle and proof of the outstanding loan balance (for mobile homes, the bill of sale).",
      },
    ),
  ],
}

const BURIAL_SECTION: Saca2Section = {
  id: "burial",
  title: "Prepaid burial plans",
  questions: [
    gate("burial", "Do you or your spouse have any prepaid burial contracts or trusts, life insurance set up for funeral and burial expenses, or bank accounts set aside for funeral expenses?"),
    repeater(
      "assets.burial",
      "Burial arrangements",
      {
        questions: [
          select("owner", "Owner", OWNER_OPTIONS, { required: true }),
          select(
            "kind",
            "Type",
            opts([
              ["contract", "Burial contract"],
              ["trust", "Burial trust"],
              ["lifeInsurance", "Life insurance for burial"],
              ["burialOnlyAccount", "Burial-only account"],
              ["plot", "Burial plot"],
            ]),
            { required: true },
          ),
          money("amount", "Amount ($)"),
        ],
        emptyItem: () => ({ owner: "you", kind: "contract", amount: null }) satisfies BurialRow,
        addLabel: "Add a burial arrangement",
        itemTitle: "Burial arrangement",
        maxItems: 8,
      },
      { required: true, visibleWhen: gateIs("burial"), help: "Send a copy of the trust contract, trust instrument, insurance policy, or burial-only account." },
    ),
  ],
}

const TRUSTS_SECTION: Saca2Section = {
  id: "trusts",
  title: "Trusts",
  questions: [
    gate("trusts", "Are you or your spouse the grantor/donor, trustee, or beneficiary of any trusts, or have you, your spouse, or someone else on your behalf (including a court or administrative body) contributed income or assets owned by you or your spouse to a trust?"),
    repeater(
      "assets.trusts",
      "Trusts",
      {
        questions: [
          text("name", "Trust name", { required: true }),
          checkbox("revocable", "This trust is revocable"),
          money("currentPrincipal", "Current trust principal ($)", { required: true }),
          money("principalOnAdmissionDate", "Trust principal on the date of admission to the facility ($)", { visibleWhen: isFacilityApplicant }),
          text("trustees", "Trustee(s)"),
          text("grantors", "Grantor(s)/donor(s)"),
          text("beneficiaries", "Beneficiaries"),
        ],
        emptyItem: () =>
          ({
            name: "",
            revocable: false,
            currentPrincipal: null,
            principalOnAdmissionDate: null,
            trustees: "",
            grantors: "",
            beneficiaries: "",
          }) satisfies TrustRow,
        addLabel: "Add a trust",
        itemTitle: "Trust",
        maxItems: 4,
      },
      {
        required: true,
        visibleWhen: gateIs("trusts"),
        help: "Send a copy of the trust documents, any amendments, documents showing financial activity, and the schedule of beneficiaries.",
      },
    ),
  ],
}

export const ASSETS_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    BANK_SECTION,
    REAL_ESTATE_SECTION,
    LIFE_INSURANCE_SECTION,
    SECURITIES_SECTION,
    ANNUITIES_SECTION,
    DEPOSITS_SECTION,
    VEHICLES_SECTION,
    BURIAL_SECTION,
    TRUSTS_SECTION,
  ],
}
```

In `lib/masshealth/saca2/questions/index.ts` add `import { ASSETS_STEP_CONTENT } from "./assets"` next to the other content imports and `assets: ASSETS_STEP_CONTENT,` to the `CONTENT` map (after `previousBills`).

- [ ] **Step 4: Run the tests, type check, and lint**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS. The registry test "ids are unique and every path resolves on empty answers" now also covers `assets`: all gate paths resolve to `null` and all repeater paths to `[]`. If `tsc` rejects a `satisfies` row, the row literal in `emptyItem` disagrees with its interface — fix the literal, not the interface.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/assets.ts lib/masshealth/saca2/questions/index.ts lib/masshealth/saca2/__tests__/questions-assets.test.ts lib/masshealth/saca2/__tests__/questions-content.test.ts
git commit -m "feat(saca2): add Step 5 asset questions with gated row repeaters" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Steps 6 and 7 — health insurance and HRAs

**Files:**
- Create: `lib/masshealth/saca2/questions/health.ts`
- Modify: `lib/masshealth/saca2/questions/index.ts` (register `healthInsurance`, `hra`)
- Modify: `lib/masshealth/saca2/visibility.ts` (`suppD` rule)
- Modify: `lib/masshealth/saca2/__tests__/visibility.test.ts` (the `suppD` test)
- Modify: `lib/masshealth/saca2/__tests__/questions-content.test.ts` (step list gains `"healthInsurance"`, `"hra"`)
- Test: `lib/masshealth/saca2/__tests__/questions-health.test.ts` (create)

**Interfaces:**
- Consumes: builders; `MedicareEntry`, `EmployerCoverageEntry`, `HraEntry` (Task 1); `isStepVisible` is NOT needed here.
- Produces: `HEALTH_INSURANCE_STEP_CONTENT`, `HRA_STEP_CONTENT` (root scope). `suppD` is visible when `health.employerOfferedCoverage === "yes"` OR (`health.hasOtherCoverage === "yes"` AND `health.enrolledInEmployerCoverage`).

- [ ] **Step 1: Write the failing tests**

Create `lib/masshealth/saca2/__tests__/questions-health.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type HraEntry, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

describe("healthInsurance step", () => {
  it("requires the two opening questions", () => {
    expect(Object.keys(validateStep("healthInsurance", answers(), ON)).sort()).toEqual([
      "health.employerOfferedCoverage",
      "health.hasOtherCoverage",
    ])
  })

  it("is complete when nothing is offered and there is no other coverage", () => {
    const a = answers((x) => {
      x.health.employerOfferedCoverage = "no"
      x.health.hasOtherCoverage = "no"
    })
    expect(validateStep("healthInsurance", a, ON)).toEqual({})
  })

  it("asks which type of coverage when the answer is yes and nothing is ticked", () => {
    const a = answers((x) => {
      x.health.employerOfferedCoverage = "no"
      x.health.hasOtherCoverage = "yes"
    })
    expect(validateStep("healthInsurance", a, ON)).toEqual({ "health.hasOtherCoverage": "Select the type of coverage." })
  })

  it("collects Medicare details and the Part B question", () => {
    const base = (x: Saca2Answers) => {
      x.health.employerOfferedCoverage = "no"
      x.health.hasOtherCoverage = "yes"
      x.health.hasMedicare = true
    }
    expect(validateStep("healthInsurance", answers(base), ON)).toEqual({
      "health.medicare": "Add at least one.",
      "health.wantsPartBHelp": "This question is required.",
    })

    const row = {
      personName: "Edna Testcase",
      claimNumber: "1EG4-TE5-MK72",
      coverageStart: "2020-01-01",
      hasPartD: "no" as const,
      partDStart: null,
      hasMedigap: "no" as const,
      medigapPlan: "",
      medigapStart: null,
    }
    const ok = answers((x) => {
      base(x)
      x.health.medicare = [row]
      x.health.wantsPartBHelp = "no"
    })
    expect(validateStep("healthInsurance", ok, ON)).toEqual({})

    const needNames = answers((x) => {
      base(x)
      x.health.medicare = [row]
      x.health.wantsPartBHelp = "yes"
    })
    expect(validateStep("healthInsurance", needNames, ON)).toEqual({ "health.partBHelpNames": "This question is required." })

    const needMedigap = answers((x) => {
      base(x)
      x.health.medicare = [{ ...row, hasMedigap: "yes" }]
      x.health.wantsPartBHelp = "no"
    })
    expect(validateStep("healthInsurance", needMedigap, ON)).toEqual({ "health.medicare.0.medigapPlan": "This question is required." })
  })

  it("requires the covered names and policy number for other coverage types", () => {
    const a = answers((x) => {
      x.health.employerOfferedCoverage = "no"
      x.health.hasOtherCoverage = "yes"
      x.health.otherPrograms.tricare = true
    })
    expect(Object.keys(validateStep("healthInsurance", a, ON)).sort()).toEqual([
      "health.otherCoverageDetails.coveredNames",
      "health.otherCoverageDetails.policyNumber",
    ])
    a.health.otherCoverageDetails = { coveredNames: "Edna", policyNumber: "T-1", startEndDates: "" }
    expect(validateStep("healthInsurance", a, ON)).toEqual({})
  })

  it("requires employer coverage rows when enrolled in employer coverage", () => {
    const a = answers((x) => {
      x.health.employerOfferedCoverage = "yes"
      x.health.hasOtherCoverage = "yes"
      x.health.enrolledInEmployerCoverage = true
    })
    expect(validateStep("healthInsurance", a, ON)).toEqual({ "health.employerCoverage": "Add at least one." })
    a.health.employerCoverage = [{ employerName: "Acme", planName: "Gold", coveredNames: "Edna", policyNumber: "", startEndDates: "" }]
    expect(validateStep("healthInsurance", a, ON)).toEqual({})
  })

  it("ignores stale coverage details once the gate flips back to no", () => {
    const a = answers((x) => {
      x.health.employerOfferedCoverage = "no"
      x.health.hasOtherCoverage = "no"
      x.health.hasMedicare = true
      x.health.otherPrograms.tricare = true
      x.health.enrolledInEmployerCoverage = true
    })
    expect(validateStep("healthInsurance", a, ON)).toEqual({})
  })
})

describe("hra step", () => {
  const entry = (over: Partial<HraEntry> = {}): HraEntry => ({
    individualName: "Edna Testcase",
    dateOfBirth: "1950-04-02",
    employerName: "Acme",
    federalTaxId: "",
    hraType: "qsehra",
    startDate: null,
    endDate: null,
    maxSelfOnlyAmount: 1500,
    qsehraFamilyIntent: "no",
    qsehraFamilyMax: null,
    ichraAcceptIntent: null,
    ...over,
  })

  it("requires the opening question, and is complete when no one is offered an HRA", () => {
    expect(validateStep("hra", answers(), ON)).toEqual({ "health.hra.anyoneOffered": "This question is required." })
    expect(validateStep("hra", answers((x) => (x.health.hra.anyoneOffered = "no")), ON)).toEqual({})
  })

  it("asks for at least one entry when someone is offered an HRA", () => {
    expect(validateStep("hra", answers((x) => (x.health.hra.anyoneOffered = "yes")), ON)).toEqual({
      "health.hra.entries": "Add at least one.",
    })
  })

  it("validates a QSEHRA entry, including the family question", () => {
    const missing = answers((x) => {
      x.health.hra.anyoneOffered = "yes"
      x.health.hra.entries = [entry({ individualName: "", dateOfBirth: null, employerName: "", hraType: null, maxSelfOnlyAmount: null })]
    })
    expect(Object.keys(validateStep("hra", missing, ON)).sort()).toEqual([
      "health.hra.entries.0.dateOfBirth",
      "health.hra.entries.0.employerName",
      "health.hra.entries.0.hraType",
      "health.hra.entries.0.individualName",
      "health.hra.entries.0.maxSelfOnlyAmount",
    ])

    const familyMax = answers((x) => {
      x.health.hra.anyoneOffered = "yes"
      x.health.hra.entries = [entry({ qsehraFamilyIntent: "yes" })]
    })
    expect(validateStep("hra", familyMax, ON)).toEqual({ "health.hra.entries.0.qsehraFamilyMax": "This question is required." })

    const ok = answers((x) => {
      x.health.hra.anyoneOffered = "yes"
      x.health.hra.entries = [entry({ qsehraFamilyIntent: "yes", qsehraFamilyMax: 3000 })]
    })
    expect(validateStep("hra", ok, ON)).toEqual({})
  })

  it("asks the ICHRA question only for ICHRA entries", () => {
    const a = answers((x) => {
      x.health.hra.anyoneOffered = "yes"
      x.health.hra.entries = [entry({ hraType: "ichra", qsehraFamilyIntent: null })]
    })
    expect(validateStep("hra", a, ON)).toEqual({ "health.hra.entries.0.ichraAcceptIntent": "This question is required." })
    a.health.hra.entries = [entry({ hraType: "ichra", qsehraFamilyIntent: null, ichraAcceptIntent: "no" })]
    expect(validateStep("hra", a, ON)).toEqual({})
  })
})
```

In `lib/masshealth/saca2/__tests__/visibility.test.ts` replace the test `suppD follows employer coverage` with:

```ts
  it("suppD follows employer coverage", () => {
    expect(isStepVisible("suppD", answers((a) => (a.health.employerOfferedCoverage = "yes")), ON)).toBe(true)
    expect(isStepVisible("suppD", answers(), ON)).toBe(false)
    expect(
      isStepVisible(
        "suppD",
        answers((a) => {
          a.health.hasOtherCoverage = "yes"
          a.health.enrolledInEmployerCoverage = true
        }),
        ON,
      ),
    ).toBe(true)
  })

  it("suppD ignores a stale employer-enrolment tick when other coverage is not selected", () => {
    expect(isStepVisible("suppD", answers((a) => (a.health.enrolledInEmployerCoverage = true)), ON)).toBe(false)
    expect(
      isStepVisible(
        "suppD",
        answers((a) => {
          a.health.hasOtherCoverage = "no"
          a.health.enrolledInEmployerCoverage = true
        }),
        ON,
      ),
    ).toBe(false)
  })
```

In `questions-content.test.ts` add `"healthInsurance"` and `"hra"` to the `withContent` array (keep it alphabetical in your head — the test sorts both sides).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-health.test.ts lib/masshealth/saca2/__tests__/visibility.test.ts`
Expected: FAIL — the new steps have no content, and the `suppD` stale-tick test fails against the old rule.

- [ ] **Step 3: Implement the content**

Create `lib/masshealth/saca2/questions/health.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EmployerCoverageEntry, HraEntry, MedicareEntry } from "../types"
import { checkbox, date, money, opts, repeater, select, text, yesNo } from "./builders"
import type { Saca2QuestionContext, Saca2StepContent } from "./types"

const health = (ctx: Saca2QuestionContext) => ctx.answers.health
const hasOtherCoverage = (ctx: Saca2QuestionContext) => health(ctx).hasOtherCoverage === "yes"
const hasMedicare = (ctx: Saca2QuestionContext) => hasOtherCoverage(ctx) && health(ctx).hasMedicare
const wantsPartBHelp = (ctx: Saca2QuestionContext) => hasMedicare(ctx) && health(ctx).wantsPartBHelp === "yes"
const anyOtherProgram = (ctx: Saca2QuestionContext) =>
  hasOtherCoverage(ctx) && Object.values(health(ctx).otherPrograms).some(Boolean)
const enrolledInEmployerCoverage = (ctx: Saca2QuestionContext) =>
  hasOtherCoverage(ctx) && health(ctx).enrolledInEmployerCoverage

export const HEALTH_INSURANCE_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "employer",
      title: "Coverage offered through a job",
      description:
        "MassHealth rules require members to get and keep available health insurance, including insurance available through an employer. We may ask you and your employer for more information.",
      questions: [
        yesNo("health.employerOfferedCoverage", "Was anyone listed on this application offered health coverage from a job but is not enrolled in it?", {
          required: true,
          help: "Answer Yes even if the insurance is from another person, like a spouse, even if that person does not live in the household. If Yes, you will complete Supplement D.",
        }),
      ],
    },
    {
      id: "coverage",
      title: "Current health coverage",
      questions: [
        yesNo("health.hasOtherCoverage", "Does anyone qualify for or is anyone enrolled in the following types of health coverage?", {
          required: true,
          help: "Answer Yes even if this insurance is from another person, like a spouse, even if that person does not live in the household.",
        }),
        checkbox("health.hasMedicare", "Enrolled in Medicare or qualifies for a Medicare Part A plan with no premium", { visibleWhen: hasOtherCoverage }),
        repeater(
          "health.medicare",
          "Medicare",
          {
            questions: [
              text("personName", "Name of person covered", { required: true }),
              text("claimNumber", "Medicare claim number", { required: true }),
              date("coverageStart", "When did coverage start?", { required: true }),
              yesNo("hasPartD", "Does this person have a Medicare Part D plan?", { required: true }),
              date("partDStart", "When did Part D coverage start?", { visibleWhen: (ctx) => ctx.item?.hasPartD === "yes" }),
              yesNo("hasMedigap", "Does this person have a Medigap/Medicare supplemental policy?", { required: true }),
              text("medigapPlan", "Name of coverage plan", { required: true, visibleWhen: (ctx) => ctx.item?.hasMedigap === "yes" }),
              date("medigapStart", "When did the Medigap coverage start?", { visibleWhen: (ctx) => ctx.item?.hasMedigap === "yes" }),
            ],
            emptyItem: () =>
              ({
                personName: "",
                claimNumber: "",
                coverageStart: null,
                hasPartD: null,
                partDStart: null,
                hasMedigap: null,
                medigapPlan: "",
                medigapStart: null,
              }) satisfies MedicareEntry,
            addLabel: "Add a person with Medicare",
            itemTitle: "Person with Medicare",
            maxItems: 4,
          },
          { required: true, visibleWhen: hasMedicare },
        ),
        yesNo("health.wantsPartBHelp", "Do any of the people above want to apply for help paying for their Medicare Part B premiums?", {
          required: true,
          visibleWhen: hasMedicare,
        }),
        text("health.partBHelpNames", "Name(s) of the people who want help paying Part B premiums", {
          required: true,
          visibleWhen: wantsPartBHelp,
        }),
        checkbox("health.otherPrograms.peaceCorps", "Qualifies for Peace Corps coverage", { visibleWhen: hasOtherCoverage }),
        checkbox("health.otherPrograms.tricare", "Qualifies for TRICARE (do not check if you have direct care or Line of Duty)", { visibleWhen: hasOtherCoverage }),
        checkbox("health.otherPrograms.vaHealth", "Enrolled in Veterans Affairs (VA) health programs", { visibleWhen: hasOtherCoverage }),
        checkbox("health.otherPrograms.masshealth", "Enrolled in MassHealth", { visibleWhen: hasOtherCoverage }),
        checkbox("health.otherPrograms.otherCoverage", "Other coverage (including COBRA and retiree health plans)", { visibleWhen: hasOtherCoverage }),
        text("health.otherCoverageDetails.coveredNames", "Name(s) of covered household members", { required: true, visibleWhen: anyOtherProgram }),
        text("health.otherCoverageDetails.policyNumber", "Policy number or member ID", { required: true, visibleWhen: anyOtherProgram }),
        text("health.otherCoverageDetails.startEndDates", "Start date and end date (mm/dd/yyyy)", { visibleWhen: anyOtherProgram }),
        checkbox("health.enrolledInEmployerCoverage", "Enrolled in employer coverage (you must also complete Supplement D)", { visibleWhen: hasOtherCoverage }),
        repeater(
          "health.employerCoverage",
          "Employer coverage",
          {
            questions: [
              text("employerName", "Name of employer", { required: true }),
              text("planName", "Plan name", { required: true }),
              text("coveredNames", "Name(s) of covered household members", { required: true }),
              text("policyNumber", "Policy number or member ID"),
              text("startEndDates", "Start date and end date (mm/dd/yyyy)"),
            ],
            emptyItem: () =>
              ({ employerName: "", planName: "", coveredNames: "", policyNumber: "", startEndDates: "" }) satisfies EmployerCoverageEntry,
            addLabel: "Add employer coverage",
            itemTitle: "Employer coverage",
            maxItems: 4,
          },
          { required: true, visibleWhen: enrolledInEmployerCoverage },
        ),
      ],
    },
  ],
  validateStep: (answers) => {
    const { hasOtherCoverage: gate, hasMedicare: medicare, otherPrograms, enrolledInEmployerCoverage: employer } = answers.health
    if (gate !== "yes") return {}
    const anyType = medicare || employer || Object.values(otherPrograms).some(Boolean)
    return anyType ? {} : { "health.hasOtherCoverage": "Select the type of coverage." }
  },
}

const hraEntry = (ctx: Saca2QuestionContext, type: "qsehra" | "ichra") => ctx.item?.hraType === type

export const HRA_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "hra",
      title: "Health reimbursement arrangements (HRAs)",
      questions: [
        yesNo("health.hra.anyoneOffered", "Is anyone in the household offered a Health Reimbursement Arrangement (HRA) from their employer?", { required: true }),
        repeater(
          "health.hra.entries",
          "HRAs offered",
          {
            questions: [
              text("individualName", "Name of individual", { required: true }),
              date("dateOfBirth", "Date of birth", { required: true }),
              text("employerName", "Employer name", { required: true }),
              text("federalTaxId", "Federal tax ID"),
              select(
                "hraType",
                "Type of HRA offered by the employer",
                opts([
                  ["qsehra", "Qualified Small Employer Health Reimbursement Arrangement (QSEHRA)"],
                  ["ichra", "Individual Coverage Health Reimbursement Arrangement (ICHRA)"],
                ]),
                { required: true },
              ),
              date("startDate", "Start date"),
              date("endDate", "End date"),
              money("maxSelfOnlyAmount", "Maximum yearly self-only coverage benefit amount ($)", { required: true }),
              yesNo("qsehraFamilyIntent", "Do you intend to use QSEHRA family coverage benefits from your employer?", {
                required: true,
                visibleWhen: (ctx) => hraEntry(ctx, "qsehra"),
              }),
              money("qsehraFamilyMax", "Maximum yearly family coverage benefit amount through the QSEHRA ($)", {
                required: true,
                visibleWhen: (ctx) => hraEntry(ctx, "qsehra") && ctx.item?.qsehraFamilyIntent === "yes",
              }),
              yesNo("ichraAcceptIntent", "Does anyone in the household intend to accept an ICHRA benefit from their employer?", {
                required: true,
                visibleWhen: (ctx) => hraEntry(ctx, "ichra"),
              }),
            ],
            emptyItem: () =>
              ({
                individualName: "",
                dateOfBirth: null,
                employerName: "",
                federalTaxId: "",
                hraType: null,
                startDate: null,
                endDate: null,
                maxSelfOnlyAmount: null,
                qsehraFamilyIntent: null,
                qsehraFamilyMax: null,
                ichraAcceptIntent: null,
              }) satisfies HraEntry,
            addLabel: "Add an HRA",
            itemTitle: "HRA",
            maxItems: 2,
          },
          { required: true, visibleWhen: (ctx) => ctx.answers.health.hra.anyoneOffered === "yes" },
        ),
      ],
    },
  ],
}
```

In `lib/masshealth/saca2/questions/index.ts` import `HEALTH_INSURANCE_STEP_CONTENT, HRA_STEP_CONTENT` from `./health` and add `healthInsurance: HEALTH_INSURANCE_STEP_CONTENT,` and `hra: HRA_STEP_CONTENT,` to the `CONTENT` map.

In `lib/masshealth/saca2/visibility.ts` replace the `suppD` case body:

```ts
    case "suppD":
      return (
        answers.health.employerOfferedCoverage === "yes" ||
        (answers.health.hasOtherCoverage === "yes" && answers.health.enrolledInEmployerCoverage)
      )
```

- [ ] **Step 4: Run the tests, type check, and lint**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS (the foundation synthetic-case visibility tests are unaffected: no synthetic case sets `enrolledInEmployerCoverage`).

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/health.ts lib/masshealth/saca2/questions/index.ts lib/masshealth/saca2/visibility.ts lib/masshealth/saca2/__tests__/questions-health.test.ts lib/masshealth/saca2/__tests__/visibility.test.ts lib/masshealth/saca2/__tests__/questions-content.test.ts
git commit -m "feat(saca2): add Step 6 health insurance and Step 7 HRA questions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Steps 8 and 9 — personal-care attendant and additional coverage

**Files:**
- Create: `lib/masshealth/saca2/questions/coverage.ts`
- Modify: `lib/masshealth/saca2/questions/index.ts` (register `pca`, `additionalCoverage`)
- Modify: `lib/masshealth/saca2/__tests__/questions-content.test.ts` (step list gains `"pca"`, `"additionalCoverage"`)
- Test: `lib/masshealth/saca2/__tests__/questions-coverage.test.ts` (create)

**Interfaces:**
- Consumes: builders; `isStepVisible` from `../visibility` (to decide whether Person 2 exists — the same rule the wizard uses for the Person 2 step); `Saca2QuestionContext`.
- Produces: `PCA_STEP_CONTENT`, `ADDITIONAL_COVERAGE_STEP_CONTENT` (root scope). PCA per-person questions live at `pca.byPerson.0.*` and `pca.byPerson.1.*`; the spouse's three questions are visible only when `isStepVisible("person2", answers, on)` is true.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-coverage.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, emptySaca2Person, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

const withSpouse = (a: Saca2Answers) => {
  a.persons[0].isLegallyMarried = "yes"
  a.persons.push({ ...emptySaca2Person(), firstName: "Walter" })
}

describe("pca step", () => {
  it("requires the opening question", () => {
    expect(validateStep("pca", answers(), ON)).toEqual({ "pca.needsPca": "This question is required." })
  })

  it("is complete when no personal-care attendant is needed", () => {
    expect(validateStep("pca", answers((a) => (a.pca.needsPca = "no")), ON)).toEqual({})
  })

  it("asks whether MassHealth paid for PCA services in the last six months", () => {
    expect(validateStep("pca", answers((a) => (a.pca.needsPca = "yes")), ON)).toEqual({
      "pca.paidByMassHealthLastSixMonths": "This question is required.",
    })
  })

  it("skips the disability questions when MassHealth already paid for PCA services", () => {
    const a = answers((x) => {
      x.pca.needsPca = "yes"
      x.pca.paidByMassHealthLastSixMonths = "yes"
    })
    expect(validateStep("pca", a, ON)).toEqual({})
  })

  it("walks Person 1 through the three chained questions", () => {
    const base = (x: Saca2Answers) => {
      x.pca.needsPca = "yes"
      x.pca.paidByMassHealthLastSixMonths = "no"
    }
    expect(validateStep("pca", answers(base), ON)).toEqual({ "pca.byPerson.0.permanentDisability": "This question is required." })

    const blocks = answers((x) => {
      base(x)
      x.pca.byPerson[0].permanentDisability = "yes"
    })
    expect(validateStep("pca", blocks, ON)).toEqual({ "pca.byPerson.0.disabilityBlocksAdls": "This question is required." })

    const contact = answers((x) => {
      base(x)
      x.pca.byPerson[0].permanentDisability = "yes"
      x.pca.byPerson[0].disabilityBlocksAdls = "yes"
    })
    expect(validateStep("pca", contact, ON)).toEqual({ "pca.byPerson.0.willContactPcmAgency": "This question is required." })

    const done = answers((x) => {
      base(x)
      x.pca.byPerson[0].permanentDisability = "yes"
      x.pca.byPerson[0].disabilityBlocksAdls = "yes"
      x.pca.byPerson[0].willContactPcmAgency = "yes"
    })
    expect(validateStep("pca", done, ON)).toEqual({})
  })

  it("stops the chain when an earlier answer is no, ignoring stale later answers", () => {
    const a = answers((x) => {
      x.pca.needsPca = "yes"
      x.pca.paidByMassHealthLastSixMonths = "no"
      x.pca.byPerson[0].permanentDisability = "no"
      x.pca.byPerson[0].disabilityBlocksAdls = null
    })
    expect(validateStep("pca", a, ON)).toEqual({})
  })

  it("asks the spouse's questions only when Person 2 exists", () => {
    const base = (x: Saca2Answers) => {
      x.pca.needsPca = "yes"
      x.pca.paidByMassHealthLastSixMonths = "no"
      x.pca.byPerson[0].permanentDisability = "no"
    }
    // Single applicant: no spouse questions.
    expect(validateStep("pca", answers(base), ON)).toEqual({})
    // A blank Person 2 that is hidden: still no spouse questions.
    const blankSecond = answers((x) => {
      base(x)
      x.persons.push(emptySaca2Person())
    })
    expect(validateStep("pca", blankSecond, ON)).toEqual({})
    // A real spouse: asked.
    const married = answers((x) => {
      base(x)
      withSpouse(x)
    })
    expect(validateStep("pca", married, ON)).toEqual({ "pca.byPerson.1.permanentDisability": "This question is required." })
  })
})

describe("additionalCoverage step", () => {
  it("is optional: nothing is required on an empty form", () => {
    expect(validateStep("additionalCoverage", answers(), ON)).toEqual({})
  })

  it("asks for a name when either condition is answered yes", () => {
    const a = answers((x) => {
      x.health.additionalCoverage.breastOrCervicalCancer = "yes"
      x.health.additionalCoverage.hivPositive = "yes"
    })
    expect(Object.keys(validateStep("additionalCoverage", a, ON)).sort()).toEqual([
      "health.additionalCoverage.breastOrCervicalName",
      "health.additionalCoverage.hivName",
    ])
    a.health.additionalCoverage.breastOrCervicalName = "Pat"
    a.health.additionalCoverage.hivName = "Pat"
    expect(validateStep("additionalCoverage", a, ON)).toEqual({})
  })

  it("does not ask for names when the answers are no", () => {
    const a = answers((x) => {
      x.health.additionalCoverage.breastOrCervicalCancer = "no"
      x.health.additionalCoverage.hivPositive = "no"
    })
    expect(validateStep("additionalCoverage", a, ON)).toEqual({})
  })
})
```

In `questions-content.test.ts` add `"pca"` and `"additionalCoverage"` to the `withContent` array.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-coverage.test.ts`
Expected: FAIL — no content for `pca` / `additionalCoverage`; `validateStep` returns `{}` for the cases that expect errors.

- [ ] **Step 3: Implement**

Create `lib/masshealth/saca2/questions/coverage.ts`:

```ts
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
```

Note the duplicated disability wording for the two people is generated by `personQuestions`, so there is one definition, not two copies.

In `lib/masshealth/saca2/questions/index.ts` import `PCA_STEP_CONTENT, ADDITIONAL_COVERAGE_STEP_CONTENT` from `./coverage` and add `pca: PCA_STEP_CONTENT,` and `additionalCoverage: ADDITIONAL_COVERAGE_STEP_CONTENT,` to `CONTENT`.

- [ ] **Step 4: Run the tests, type check, and lint**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS. If `tsc` or the module loader reports a circular import (`questions/coverage.ts` → `visibility.ts`), check that `visibility.ts` imports nothing from `questions/` (it imports only `age`, `schema`, `types`); it must not, and then no cycle exists.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/coverage.ts lib/masshealth/saca2/questions/index.ts lib/masshealth/saca2/__tests__/questions-coverage.test.ts lib/masshealth/saca2/__tests__/questions-content.test.ts
git commit -m "feat(saca2): add Step 8 PCA and Step 9 additional-coverage questions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Step 10 — signer details

**Files:**
- Modify: `lib/masshealth/saca2/questions/root-steps.ts` (extend `SIGNATURE_STEP_CONTENT`; imports)
- Test: `lib/masshealth/saca2/__tests__/questions-signing.test.ts` (create)

**Interfaces:**
- Consumes: builders `date`, `phone`, `email`, `select`, `ssn`, `text`, `yesNo`; `calculateAge` (plan 1); `ResponsibleParty` fields (Task 1).
- Produces: `SIGNATURE_STEP_CONTENT` gains a "Before you sign" section with questions at `signing.emancipatedMinor`, `signing.responsibleParty.*`, `signing.registerToVote`. Rules: `emancipatedMinor` shows only when Person 1's age is known and under 18; the responsible-party fields show when (`signedBy === "responsibleParty"`) OR (Person 1 under 18 AND `emancipatedMinor === "no"`); `registerToVote` is optional.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-signing.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

const RESPONSIBLE_REQUIRED = [
  "signing.responsibleParty.city",
  "signing.responsibleParty.dateOfBirth",
  "signing.responsibleParty.firstName",
  "signing.responsibleParty.lastName",
  "signing.responsibleParty.phone",
  "signing.responsibleParty.relationship",
  "signing.responsibleParty.street",
  "signing.responsibleParty.zip",
]

describe("signature step", () => {
  it("still requires who signs", () => {
    expect(validateStep("signature", answers(), ON)).toEqual({ "signature.signedBy": "This question is required." })
  })

  it("needs nothing else for an adult applicant who signs", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "1950-04-02"
      x.signature.signedBy = "applicant"
    })
    expect(validateStep("signature", a, ON)).toEqual({})
  })

  it("does not ask the minor questions when the date of birth is unknown", () => {
    const a = answers((x) => (x.signature.signedBy = "applicant"))
    expect(validateStep("signature", a, ON)).toEqual({})
  })

  it("asks about emancipation when Person 1 is under 18", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "2012-05-01"
      x.signature.signedBy = "applicant"
    })
    expect(validateStep("signature", a, ON)).toEqual({ "signing.emancipatedMinor": "This question is required." })
  })

  it("requires a responsible party for a non-emancipated minor", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "2012-05-01"
      x.signature.signedBy = "responsibleParty"
      x.signing.emancipatedMinor = "no"
    })
    expect(Object.keys(validateStep("signature", a, ON)).sort()).toEqual(RESPONSIBLE_REQUIRED)
  })

  it("does not require a responsible party for an emancipated minor who signs", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "2012-05-01"
      x.signature.signedBy = "applicant"
      x.signing.emancipatedMinor = "yes"
    })
    expect(validateStep("signature", a, ON)).toEqual({})
  })

  it("requires the responsible-party details whenever a responsible party signs, with valid formats", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "1950-04-02"
      x.signature.signedBy = "responsibleParty"
    })
    expect(Object.keys(validateStep("signature", a, ON)).sort()).toEqual(RESPONSIBLE_REQUIRED)

    const filled = answers((x) => {
      x.persons[0].dateOfBirth = "1950-04-02"
      x.signature.signedBy = "responsibleParty"
      x.signing.responsibleParty = {
        firstName: "Pat",
        middleName: "",
        lastName: "Guardian",
        suffix: "",
        ssn: "12",
        relationship: "parent",
        dateOfBirth: "1980-01-01",
        street: "2 Example St",
        apartment: "",
        city: "Testville",
        state: "MA",
        zip: "02101",
        county: "",
        phone: "6175550100",
        phoneType: "mobile",
        secondPhone: "",
        email: "not-an-email",
      }
    })
    expect(Object.keys(validateStep("signature", filled, ON)).sort()).toEqual([
      "signing.responsibleParty.email",
      "signing.responsibleParty.ssn",
    ])
  })

  it("ignores stale responsible-party and minor answers for an adult who signs", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "1950-04-02"
      x.signature.signedBy = "applicant"
      x.signing.emancipatedMinor = "no"
      x.signing.responsibleParty.firstName = ""
    })
    expect(validateStep("signature", a, ON)).toEqual({})
  })

  it("keeps voter registration optional", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "1950-04-02"
      x.signature.signedBy = "applicant"
      x.signing.registerToVote = "yes"
    })
    expect(validateStep("signature", a, ON)).toEqual({})
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-signing.test.ts`
Expected: FAIL — the minor and responsible-party cases return `{}` or only `signature.signedBy`.

- [ ] **Step 3: Implement**

In `lib/masshealth/saca2/questions/root-steps.ts` change the builders import to:

```ts
import { checkbox, date, email, opts, phone, repeater, select, ssn, text, yesNo } from "./builders"
```

Replace the whole `SIGNATURE_STEP_CONTENT` export with:

```ts
const applicantAge = (ctx: Saca2QuestionContext) => calculateAge(ctx.answers.persons[0]?.dateOfBirth, ctx.on)
const applicantIsMinor = (ctx: Saca2QuestionContext) => {
  const age = applicantAge(ctx)
  return age !== null && age < 18
}
/** A responsible party signs for a minor who is not emancipated, or whenever chosen as the signer. */
const needsResponsibleParty = (ctx: Saca2QuestionContext) =>
  ctx.answers.signature.signedBy === "responsibleParty" ||
  (applicantIsMinor(ctx) && ctx.answers.signing.emancipatedMinor === "no")

const stateCode = (v: unknown) => (/^[A-Za-z]{2}$/.test(String(v)) ? null : "Enter the 2-letter state code.")
const zipCode = (v: unknown) => (/^\d{5}(-\d{4})?$/.test(String(v)) ? null : "Enter a 5-digit ZIP code.")

export const SIGNATURE_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "signer",
      title: "Who will sign the application?",
      description: "You sign the printed form yourself. We never sign for you.",
      questions: [
        select(
          "signature.signedBy",
          "The application will be signed by",
          opts([
            ["applicant", "The applicant"],
            ["authorizedRepresentative", "An authorized representative (an Authorized Representative Designation form is required)"],
            ["responsibleParty", "A responsible party (applicant is younger than 18 and not an emancipated minor)"],
          ]),
          { required: true },
        ),
      ],
    },
    {
      id: "beforeSigning",
      title: "Before you sign",
      questions: [
        yesNo("signing.emancipatedMinor", "Are you an emancipated minor?", {
          required: true,
          visibleWhen: applicantIsMinor,
          help: "If No, we need a responsible party who is at least 18 to sign on your behalf.",
        }),
        text("signing.responsibleParty.firstName", "Responsible party: first name", { required: true, visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.middleName", "Middle name", { visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.lastName", "Last name", { required: true, visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.suffix", "Suffix", { visibleWhen: needsResponsibleParty }),
        ssn("signing.responsibleParty.ssn", "Social Security number", { visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.relationship", "Relationship to you", { required: true, visibleWhen: needsResponsibleParty }),
        date("signing.responsibleParty.dateOfBirth", "Date of birth", { required: true, visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.street", "Street address", { required: true, visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.apartment", "Apartment or unit number", { visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.city", "City", { required: true, visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.state", "State", { visibleWhen: needsResponsibleParty, validate: stateCode }),
        text("signing.responsibleParty.zip", "ZIP code", { required: true, visibleWhen: needsResponsibleParty, validate: zipCode }),
        text("signing.responsibleParty.county", "County", { visibleWhen: needsResponsibleParty }),
        phone("signing.responsibleParty.phone", "Phone", { required: true, visibleWhen: needsResponsibleParty }),
        select(
          "signing.responsibleParty.phoneType",
          "Phone type",
          opts([
            ["mobile", "Mobile"],
            ["home", "Home"],
            ["work", "Work"],
          ]),
          { visibleWhen: needsResponsibleParty },
        ),
        phone("signing.responsibleParty.secondPhone", "Second phone", { visibleWhen: needsResponsibleParty }),
        email("signing.responsibleParty.email", "Email address", { visibleWhen: needsResponsibleParty }),
      ],
    },
    {
      id: "voter",
      title: "Voter registration (optional)",
      description: "If you do not answer, we treat it as no choice to register at this time. Applying to register or declining does not affect your benefits.",
      questions: [
        yesNo("signing.registerToVote", "If you are not registered to vote where you live now, would you like to apply to register to vote today?"),
      ],
    },
  ],
}
```

and make sure the file imports `calculateAge` (it already imports it from `"../age"` for the screening questions) and the type `Saca2QuestionContext` (added in Task 2).

- [ ] **Step 4: Run the tests, type check, and lint**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS. The registry test "every path resolves on empty answers" now covers the `signing.*` paths (all default to `""`, `null`, or `"MA"`).

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/root-steps.ts lib/masshealth/saca2/__tests__/questions-signing.test.ts
git commit -m "feat(saca2): collect Step 10 signer details for minors and responsible parties" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end completeness fixtures and wiring checks

**Files:**
- Create: `lib/masshealth/saca2/__tests__/complete-answers.ts` (shared fixture builders; reused by later plans)
- Test: `lib/masshealth/saca2/__tests__/complete-flow.test.ts` (create)
- Modify: `lib/masshealth/saca2/__tests__/wizard-state.test.ts` (the `getWizardSteps` expectation)
- Modify: `lib/masshealth/saca2/__tests__/questions-content.test.ts` (final exact step list)
- Modify: `docs/superpowers/specs/2026-10-13-saca2-application-design.md` (Phase 1b status)

**Interfaces:**
- Produces (`complete-answers.ts`): `completeSingleSenior(): Saca2Answers` (a single 76-year-old at home who answers every visible question) and `completeFacilityCouple(): Saca2Answers` (a nursing-facility couple with one row in each asset category and a complete Person 2). Both must pass `validateStep` with no errors for every step returned by `getWizardSteps`.

- [ ] **Step 1: Write the fixtures**

Create `lib/masshealth/saca2/__tests__/complete-answers.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import {
  emptySaca2Answers,
  emptySaca2Person,
  type AssetCategory,
  type Saca2Answers,
  type Saca2Person,
} from "@/lib/masshealth/saca2/types"

const ALL_GATES: AssetCategory[] = [
  "bankAccounts",
  "retirementAccounts",
  "closedAccounts",
  "primaryResidence",
  "otherRealEstate",
  "lifeInsurance",
  "securities",
  "annuities",
  "assistedLivingDeposit",
  "vehicles",
  "burial",
  "trusts",
]

/** All data is fabricated. */
function completePerson(person: Saca2Person, overrides: Partial<Saca2Person>): Saca2Person {
  return {
    ...person,
    firstName: "Edna",
    lastName: "Testcase",
    dateOfBirth: "1950-04-02",
    sexAtBirth: "female",
    applyingForCoverage: "yes",
    streetAddress: "1 Example St",
    city: "Testville",
    state: "MA",
    zip: "02101",
    inInstitution: "no",
    mobilePhone: "6175550100",
    hasSsn: "no",
    noSsnReason: "justApplied",
    usCitizenOrNational: "yes",
    naturalizedCitizen: "no",
    residentOfMassachusetts: "yes",
    caregiverOfChildUnder19: "no",
    isLegallyMarried: "no",
    hasDisability: "no",
    everGotSsi: "no",
    hasMedicareOrSsiOrSsdi: "yes",
    hasIncome: "no",
    ...overrides,
  }
}

function setAllGates(a: Saca2Answers, value: "yes" | "no") {
  for (const gate of ALL_GATES) a.assets.gates[gate] = value
}

export function completeSingleSenior(): Saca2Answers {
  const a = emptySaca2Answers()
  a.intake.programs.masshealthHsn = true
  a.persons[0] = completePerson(a.persons[0], {})
  a.aian.anyMember = "no"
  a.previousMedicalBills.hasBills = "no"
  setAllGates(a, "no")
  a.health.employerOfferedCoverage = "no"
  a.health.hasOtherCoverage = "no"
  a.health.hra.anyoneOffered = "no"
  a.pca.needsPca = "no"
  a.signature.signedBy = "applicant"
  return a
}

export function completeFacilityCouple(): Saca2Answers {
  const a = emptySaca2Answers()
  a.intake.programs.longTermCare = true
  a.persons[0] = completePerson(a.persons[0], {
    firstName: "Walter",
    dateOfBirth: "1944-09-20",
    sexAtBirth: "male",
    inInstitution: "yes",
    facilityName: "Example Nursing Home",
    isLegallyMarried: "yes",
  })
  a.persons.push(
    completePerson(emptySaca2Person(), {
      firstName: "Dorothy",
      dateOfBirth: "1946-02-11",
      sexAtBirth: "female",
      relationshipToPerson1: "spouse",
      applyingForCoverage: "no",
      livesWithPerson1: "no",
      isLegallyMarried: "yes",
    }),
  )
  a.aian.anyMember = "no"
  a.previousMedicalBills.hasBills = "no"

  setAllGates(a, "yes")
  a.assets.bankAccounts = [
    { ownerName: "Walter Testcase", accountType: "savings", institution: "Example Bank", accountNumber: "0001", currentBalance: 54000, balanceOnAdmissionDate: 55000, open: true, closedOn: null, balanceWhenClosed: null },
  ]
  a.assets.primaryResidence = [{ address: "1 Example St, Testville MA", propertyType: "oneFamily", currentValue: 450000 }]
  a.assets.otherRealEstate = [{ address: "9 Cape Rd, Testville MA", propertyType: "other", currentValue: 120000 }]
  a.assets.lifeInsurance = [{ owners: "Walter Testcase", company: "Example Life", policyNumber: "L-1", faceValue: 10000, insuranceType: "whole life", cashSurrenderValue: 2000 }]
  a.assets.securities = [{ kind: "stocks", owners: "Walter Testcase", company: "Example Brokerage", accountNumber: "S-1", currentValue: 8000, valueOnAdmissionDate: 8200, joint: false }]
  a.assets.annuities = [{ owners: "Walter Testcase", institution: "Example Annuity Co", contractNumber: "A-1", purchasedOn: "2023-05-01" }]
  a.assets.assistedLivingDeposits = [{ facilityName: "Example Residence", facilityAddress: "5 Elm St", amount: 3000, depositedOn: "2025-01-15" }]
  a.assets.vehicles = [{ owner: "spouse", vehicleType: "Car", yearMakeModel: "2018 Honda Civic", fairMarketValue: 9000, amountOwed: 0 }]
  a.assets.burial = [{ owner: "you", kind: "contract", amount: 5000 }]
  a.assets.trusts = [{ name: "Testcase Family Trust", revocable: false, currentPrincipal: 90000, principalOnAdmissionDate: 95000, trustees: "Test Trustee", grantors: "Walter Testcase", beneficiaries: "Test Child" }]

  a.health.employerOfferedCoverage = "no"
  a.health.hasOtherCoverage = "yes"
  a.health.hasMedicare = true
  a.health.medicare = [
    { personName: "Walter Testcase", claimNumber: "1EG4-TE5-MK72", coverageStart: "2009-09-01", hasPartD: "yes", partDStart: "2010-01-01", hasMedigap: "no", medigapPlan: "", medigapStart: null },
  ]
  a.health.wantsPartBHelp = "no"
  a.health.hra.anyoneOffered = "no"
  a.signature.signedBy = "authorizedRepresentative"
  return a
}
```

(`completeFacilityCouple` ends with exactly two persons: Person 1 from `emptySaca2Answers()` completed in place, and Person 2 pushed from `emptySaca2Person()`. Person 2 is not applying for coverage, so the status questions stay hidden.)

- [ ] **Step 2: Write the failing flow test**

Create `lib/masshealth/saca2/__tests__/complete-flow.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { getWizardSteps } from "@/lib/masshealth/saca2/wizard-state"
import { completeFacilityCouple, completeSingleSenior } from "./complete-answers"

const ON = new Date("2026-10-13T12:00:00Z")

describe("complete fixtures", () => {
  it("a single senior at home sees the expected steps and every one validates clean", () => {
    const a = completeSingleSenior()
    const steps = getWizardSteps(a, ON)
    expect(steps).toEqual([
      "intake",
      "person1",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "pca",
      "signature",
    ])
    for (const step of steps) {
      expect(validateStep(step, a, ON), step).toEqual({})
    }
  })

  it("a nursing-facility couple sees the expected steps and every one validates clean", () => {
    const a = completeFacilityCouple()
    expect(a.persons).toHaveLength(2)
    const steps = getWizardSteps(a, ON)
    expect(steps).toEqual([
      "intake",
      "person1",
      "person2",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "signature",
    ])
    for (const step of steps) {
      expect(validateStep(step, a, ON), step).toEqual({})
    }
  })

  it("dropping one required answer is caught by exactly the right step", () => {
    const missingGate = completeSingleSenior()
    missingGate.assets.gates.vehicles = null
    expect(validateStep("assets", missingGate, ON)).toEqual({ "assets.gates.vehicles": "This question is required." })
    expect(validateStep("healthInsurance", missingGate, ON)).toEqual({})

    const missingPca = completeSingleSenior()
    missingPca.pca.needsPca = null
    expect(validateStep("pca", missingPca, ON)).toEqual({ "pca.needsPca": "This question is required." })

    const missingBankRow = completeFacilityCouple()
    missingBankRow.assets.bankAccounts = []
    expect(validateStep("assets", missingBankRow, ON)).toEqual({ "assets.bankAccounts": "Add at least one." })
  })
})
```

- [ ] **Step 3: Update the two existing expectations**

In `lib/masshealth/saca2/__tests__/wizard-state.test.ts` change the first assertion in `getWizardSteps` → `returns only visible steps that have content` to:

```ts
    expect(getWizardSteps(answers, ON)).toEqual([
      "intake",
      "person1",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "signature",
    ])
```

In `lib/masshealth/saca2/__tests__/questions-content.test.ts` set the final list in `implements exactly the steps listed here`:

```ts
    const withContent = [
      "additionalCoverage",
      "aian",
      "assets",
      "healthInsurance",
      "hra",
      "intake",
      "pca",
      "person1",
      "person2",
      "previousBills",
      "signature",
    ]
```

and keep `expect(getStepContent("suppA")).toBeNull()` (supplements and attachments come in plan 2b-2).

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 app/application/new`
Expected: PASS. If `completeFacilityCouple` fails a step, the failing step name in the assertion message tells you which fixture field is missing or invalid — fix the fixture (it must stay a complete, realistic submission), not the validation.

- [ ] **Step 5: Full verification**

Run:

```bash
npx vitest run && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2 components/application lib/phi-token lib/db app/application app/api/config
```

Expected: all test files pass, no type errors, no lint errors. (If the full suite shows a handful of timeouts in unrelated admin/identity/PHI-dialog tests while the machine is busy, re-run those files alone and the whole suite once more before reporting; they are load-sensitive.)

- [ ] **Step 6: Update the spec**

In `docs/superpowers/specs/2026-10-13-saca2-application-design.md` §6, in the Phase 1 row replace the sentence beginning `**1b**:` with:

```
**1b** is split into three plans: **1b-1** (plan `2026-10-14-saca2-remaining-steps.md`: previous-bills detail, Step 5 assets, Steps 6–7 health insurance and HRAs, Steps 8–9 PCA and additional coverage, Step 10 signer details), **1b-2** (Supplements A–D and the ARD-1122 / IRS 4506 attachment data), and **1b-3** (remaining Person-block questions: optional demographics, tax/Health Connector, accommodations, pregnancy/foster care, deductions, rental/one-time/seasonal/self-employment income). The flag stays off until 1b-3 ships and the pre-flag gate items from the Phase 1 final review are done.
```

Run: `grep -n "1b-1" docs/superpowers/specs/2026-10-13-saca2-application-design.md`
Expected: the new line appears.

- [ ] **Step 7: Commit**

```bash
git add lib/masshealth/saca2/__tests__/complete-answers.ts lib/masshealth/saca2/__tests__/complete-flow.test.ts lib/masshealth/saca2/__tests__/wizard-state.test.ts lib/masshealth/saca2/__tests__/questions-content.test.ts docs/superpowers/specs/2026-10-13-saca2-application-design.md
git commit -m "test(saca2): add complete-submission fixtures and wire the remaining steps into the flow checks" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## What comes next (not part of this plan)

- **2b-2:** Supplement A (facility, spouse living expenses, family at home, 60-month resource transfers, deposits, home equity and exempt relatives, LTC insurance, tax returns), Supplement B (AI/AN members and income), Supplement C (ADL grid), Supplement D (jobs), plus the attachment data for ARD-1122 and IRS 4506.
- **2b-3:** the remaining Person-block questions, then the pre-flag gate items from the plan 2 final review.
