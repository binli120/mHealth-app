# SACA-2 Supplements and Attachment Data (Phase 1b-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the six remaining SACA-2 steps their question content — Supplement A (long-term care), B (American Indian / Alaska Native), C (personal-care attendant), D (health coverage from jobs), the Authorized Representative Designation (ARD-1122), and the IRS 4506 request — so the wizard collects everything on the form except the optional Person-block questions deferred to plan 2b-3.

**Architecture:** Same platform as plans 2 and 2b-1: new answer fields in `types.ts`, step content modules under `lib/masshealth/saca2/questions/` registered in `questions/index.ts`, no new UI components. Supplement A is the largest step, so its content is built up over three tasks in one module. The `SACA2_ENABLED` flag stays **off**.

**Tech Stack:** TypeScript, Vitest, the existing question model, builders, and validators.

**Spec:** `docs/superpowers/specs/2026-10-13-saca2-application-design.md` (Phase 1b). Builds on plans `2026-10-13-saca2-wizard-core.md` and `2026-10-14-saca2-remaining-steps.md` (both merged).

## Scope and sequence

| Plan | Content | Status |
|---|---|---|
| 1, 2, 2b-1 | foundation; wizard platform; remaining non-supplement steps | merged |
| **2b-2 (this file)** | Supplements A–D, ARD-1122 data, IRS 4506 data, fixtures covering every step | ready |
| 2b-3 | remaining Person-block questions (optional demographics, tax/Health Connector, accommodations, pregnancy/foster care, deductions, rental/one-time/seasonal/self-employment income) | after 2b-2 |
| 3, 4, 5 | PDF fill; eligibility engine; i18n, chat, touchpoints, e2e, rollout | after 2b-3 |

The flag stays off until 2b-3 ships and the pre-flag gate list from the earlier plans' final reviews is done.

## Decisions made here (easy to change)

1. **Derived data is not asked again.** The supplements and attachments need the applicant's name, SSN, date of birth, address, and the spouse's name and SSN; those already live in `persons[]` and are filled onto the PDF at fill time (plan 3). This plan collects only what the form asks that nothing else holds.
2. **Supplement C becomes one entry per person.** `supplements.c` changes from a single object to an array of two entries (index = person index), because each spouse who answered Yes to all parts of PCA Question 3 completes their own Supplement C. `supplements.c[i].activities` becomes a fully typed record of the seven daily-living activities.
3. **One new PHI top-level key, `attachments`** (ARD representative identity, IRS 4506 details). Added to both `SACA2_PHI_KEYS` and the shared `PHI_DATA_KEYS`.
4. **Hydration pads the two fixed-length arrays** (`pca.byPerson`, `supplements.c`) to two entries and merges each entry over its defaults. This closes the deferred "old drafts keep `pca.byPerson: []`" item from the plan 2b-1 final review.
5. **Resource-transfer rows are required only for the seven true transfer questions.** The form's Question 6e ("did you live in the home for a year after buying a life estate") is answered Yes by people who did nothing wrong, so it is optional and does not trigger the transfer table.
6. **Supplement A sections follow the form's own routing.** Facility details and spouse-at-home expenses appear only when a nursing-home-type facility is needed; resource transfers, real estate, long-term-care insurance, and tax returns appear for every Supplement A applicant (nursing home, HCBS waiver, or PACE); the "intend to return home" question is hidden for HCBS applicants.
7. **Chain-aware visibility** everywhere (children under a hidden parent never show or block), as in plan 2b-1.
8. **When Person 1 has no SSN**, the IRS 4506 asks for a taxpayer ID (ITIN) instead of silently producing an unusable form.

## Global Constraints

- Run commands from `/Users/blee/dev/masshealth-repo/mHealth-app` with Node 22: `export PATH=/Users/blee/.nvm/versions/node/v22.23.0/bin:$PATH` (the shell default, Node 18.0.0, cannot run vitest).
- Form source of truth: SACA-2_2026-08 PDF — Supplements A–D (form pages 25–31), ARD-1122 (form pages 33–36), IRS Form 4506 (form pages 37–38). Question wording follows the form.
- PHI never in the server `draft_state`: every top-level answer key except `intake` and `signature` is PHI; the client split and server strip share `PHI_DATA_KEYS`.
- Question `path`s must resolve to a non-`undefined` default on `emptySaca2Answers()` (the registry test enforces this for every implemented step) — so every field a question reads needs an explicit default.
- Repeater `emptyItem()` must return a complete row; use `satisfies <Row>` on the literal. Checkbox-typed fields hold booleans.
- User-facing question text for two people (you / your spouse) must be grammatical for both; generate the wording from one factory with explicit subject/aux/possessive parts and pin the exact strings in a test (lesson from plan 2b-1).
- Shared validators (`validateStateCode`, `validateZip`) come from `questions/validators.ts`; do not redefine them.
- Tests of one Supplement A section must assert only their own key prefixes (use the `errs(answers, ...prefixes)` helper shown in Task 2), because later tasks add more required questions to the same step.
- No `APPROVED`/determination wording; English only.
- Repo style: 2-space indent, no semicolons, double quotes, `@author: Bin Lee` / `@email: blee@comura.ai` header on every new file, tests in `__tests__/` next to the module, imports via `@/` (relative inside a module folder is fine).
- ACA-3 behaviour must not change; its tests must stay green.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the implementer's own model name is acceptable).

## Review Focus

1. **PHI in `attachments`** (representative identity, taxpayer ID) never reaches the server draft: strip test includes it; in both PHI lists. → Task 1.
2. **Supplement C wording for the spouse** is grammatical and the spouse's block appears only when Person 2 exists and that person's PCA answers qualify; a stale all-yes spouse entry behind a hidden Person 2 must not require anything. → Task 6.
3. **Supplement A routing**: nursing-only sections never block an HCBS/PACE applicant; the "intend to return" question is hidden for HCBS; the 60-month transfer table is required only when one of the seven transfer questions is Yes. → Tasks 2–4.
4. **Stale answers** under a flipped gate (nursing yes→no, owns home yes→no, transfers yes→no, deposit yes→no, ARD section changed) never produce errors. → Tasks 2–7.
5. **Hydration of older drafts**: a plan-2b-1-era blob with `pca.byPerson: []`, `supplements.c` as a single object, or the old `supplements.b/d` row shapes loads without crashing and with defaults filled. → Task 1.
6. **Row completeness**: every repeater row has all interface fields (`satisfies`); `supplements.d.jobs` rows carry every field the form asks. → Tasks 3–5.
7. **Every step now has content**: nothing falls through to an empty page; the final fixtures exercise all 17 steps. → Task 8.

---

### Task 1: Types, defaults, hydration padding, and the `attachments` PHI key

**Files:**
- Modify: `lib/masshealth/saca2/types.ts`
- Modify: `lib/masshealth/saca2/wizard-state.ts` (`normalizeAnswers` padding)
- Modify: `lib/phi-token/phi-fields.ts` (add `"attachments"`)
- Modify: `lib/masshealth/saca2/__tests__/types.test.ts`
- Modify: `lib/masshealth/saca2/__tests__/wizard-state.test.ts`
- Modify: `lib/db/__tests__/application-drafts-phi-strip.test.ts`

**Interfaces:**
- Consumes: existing types (plans 1–2b-1), `IncomeFrequency`, `DailyLivingActivity`.
- Produces (all exported from `types.ts`):
  - `RelativeInHome { has: YesNo | null; name: string; livesInHome: YesNo | null }`
  - `HomeProperty { ownerNames: string; propertyAddress: string; ownershipType: "individual" | "tenancyInCommon" | "jointTenancy" | "lifeEstate" | null; fairMarketValue: number | null }`
  - `FamilyMemberAtHome { name; ssn; relationship: string; dateOfBirth: string | null; monthlyIncome: number | null }`
  - `LongTermCarePolicy { companyAndPolicyNumber: string; policyholder: string; effectiveDate: string | null; premium: number | null }`
  - `SupplementA` extended with `facility`, `familyAtHome`, `transferAnswers`, `facilityDeposit`, `home`, `longTermCareInsurance` (field lists in Step 3).
  - `AianMember` (9 fields), `SupplementB { members: AianMember[] }`
  - `ActivityNeed { needsHandsOnHelp: YesNo | null; timesPerDay: number | null; daysPerWeek: number | null }`; `SupplementC { healthProblems: string[]; activities: Record<DailyLivingActivity, ActivityNeed>; caregivers: Array<{ name: string; relationship: string }> }`
  - `EmployerJob` (full row, Step 3), `SupplementD { jobs: EmployerJob[] }`
  - `Saca2Supplements { a: SupplementA; b: SupplementB; c: SupplementC[]; d: SupplementD }` — `c` defaults to two blank entries.
  - `ArdData`, `Irs4506Data`, and `Saca2Answers.attachments: { ard: ArdData; irs4506: Irs4506Data }`.
  - `SACA2_PHI_KEYS` and `PHI_DATA_KEYS` include `"attachments"`.
  - `normalizeSaca2State` pads `pca.byPerson` and `supplements.c` to two entries, each merged over its defaults.

- [ ] **Step 1: Write the failing tests**

In `lib/masshealth/saca2/__tests__/types.test.ts` append:

```ts
describe("supplement and attachment defaults", () => {
  it("starts Supplement A with the new blocks empty", () => {
    const a = emptySaca2Answers().supplements.a
    expect(a.facility).toEqual({ name: "", address: "", admissionDate: null, placedByOtherState: null, placedFromState: "", paysGuardianshipExpenses: null })
    expect(a.familyAtHome).toEqual({ hasFamily: null, members: [] })
    expect(Object.values(a.transferAnswers).every((v) => v === null)).toBe(true)
    expect(Object.keys(a.transferAnswers).sort()).toEqual([
      "addedToDeed",
      "annuity",
      "assets",
      "deed",
      "income",
      "lifeEstateLivedOneYear",
      "loanOrNote",
      "trust",
    ])
    expect(a.facilityDeposit.gaveDeposit).toBeNull()
    expect(a.home.ownsHome).toBeNull()
    expect(a.home.properties).toEqual([])
    for (const key of ["spouse", "disabledChild", "childUnder21", "sibling", "caregiverChild", "dependentRelative"] as const) {
      expect(a.home[key]).toMatchObject({ has: null, name: "", livesInHome: null })
    }
    expect(a.home.childUnder21.dateOfBirth).toBeNull()
    expect(a.home.dependentRelative.relationshipDescription).toBe("")
    expect(a.home.ownsOtherRealEstate).toBeNull()
    expect(a.longTermCareInsurance).toEqual({ hasPolicy: null, policies: [] })
  })

  it("starts two blank Supplement C entries with all seven activities answerable", () => {
    const c = emptySaca2Answers().supplements.c
    expect(c).toHaveLength(2)
    for (const entry of c) {
      expect(entry.healthProblems).toEqual(["", "", ""])
      expect(Object.keys(entry.activities).sort()).toEqual([
        "bathing",
        "dressing",
        "eating",
        "medications",
        "mobility",
        "rangeOfMotion",
        "toileting",
      ])
      for (const need of Object.values(entry.activities)) {
        expect(need).toEqual({ needsHandsOnHelp: null, timesPerDay: null, daysPerWeek: null })
      }
      expect(entry.caregivers).toEqual([])
    }
    expect(c[0]).not.toBe(c[1])
    expect(c[0].activities.eating).not.toBe(c[1].activities.eating)
  })

  it("starts Supplements B and D empty", () => {
    const s = emptySaca2Answers().supplements
    expect(s.b.members).toEqual([])
    expect(s.d.jobs).toEqual([])
  })

  it("starts the attachments block empty with IRS form 1040 and a Massachusetts representative", () => {
    const { attachments } = emptySaca2Answers()
    expect(attachments.ard).toMatchObject({ section: null, repKind: null, repName: "", repState: "MA", legalDocument: "" })
    expect(attachments.irs4506).toEqual({ jointReturn: null, taxpayerId: "", previousAddress: "", formNumber: "1040", yearsRequested: [] })
  })
})
```

In `lib/masshealth/saca2/__tests__/wizard-state.test.ts` replace the whole test `keeps typed asset gates and free-form daily-living activities` with:

```ts
  it("keeps typed asset gates and typed daily-living activities", () => {
    const s = normalizeSaca2State({
      schemaVersion: SACA2_SCHEMA_VERSION,
      data: {
        assets: { gates: { bankAccounts: "yes", trusts: "no", notAGate: "yes" } },
        supplements: {
          c: [{ activities: { eating: { needsHandsOnHelp: "yes", timesPerDay: 3, daysPerWeek: 7 }, notAnActivity: { needsHandsOnHelp: "yes" } } }],
        },
      },
    })!
    expect(s.data.assets.gates.bankAccounts).toBe("yes")
    expect(s.data.assets.gates.trusts).toBe("no")
    expect(s.data.assets.gates.vehicles).toBeNull()
    expect(s.data.assets.gates).not.toHaveProperty("notAGate")
    expect(s.data.supplements.c[0].activities.eating).toEqual({ needsHandsOnHelp: "yes", timesPerDay: 3, daysPerWeek: 7 })
    expect(s.data.supplements.c[0].activities.bathing).toEqual({ needsHandsOnHelp: null, timesPerDay: null, daysPerWeek: null })
    expect(s.data.supplements.c[0].activities).not.toHaveProperty("notAnActivity")
  })

  it("pads the fixed two-entry arrays and merges each entry over its defaults", () => {
    const old = normalizeSaca2State({
      schemaVersion: SACA2_SCHEMA_VERSION,
      data: {
        pca: { needsPca: "yes", byPerson: [] },
        supplements: { c: { healthProblems: ["old single-object shape"] } },
      },
    })!
    expect(old.data.pca.byPerson).toHaveLength(2)
    expect(old.data.pca.byPerson[1]).toEqual({ permanentDisability: null, disabilityBlocksAdls: null, willContactPcmAgency: null })
    expect(old.data.supplements.c).toHaveLength(2)
    expect(old.data.supplements.c[0].healthProblems).toEqual(["", "", ""])

    const partial = normalizeSaca2State({
      schemaVersion: SACA2_SCHEMA_VERSION,
      data: {
        pca: { byPerson: [{ permanentDisability: "yes" }] },
        supplements: { c: [{ caregivers: [{ name: "A", relationship: "son" }] }] },
      },
    })!
    expect(partial.data.pca.byPerson[0]).toEqual({ permanentDisability: "yes", disabilityBlocksAdls: null, willContactPcmAgency: null })
    expect(partial.data.pca.byPerson).toHaveLength(2)
    expect(partial.data.supplements.c[0].caregivers).toEqual([{ name: "A", relationship: "son" }])
    expect(partial.data.supplements.c[0].activities.eating.needsHandsOnHelp).toBeNull()
    expect(partial.data.supplements.c).toHaveLength(2)
  })

  it("ignores an older single-object Supplement B/D shape without crashing", () => {
    const s = normalizeSaca2State({
      schemaVersion: SACA2_SCHEMA_VERSION,
      data: { supplements: { b: [], d: "x" }, attachments: 5 },
    })!
    expect(s.data.supplements.b.members).toEqual([])
    expect(s.data.supplements.d.jobs).toEqual([])
    expect(s.data.attachments.irs4506.formNumber).toBe("1040")
  })
```

In `lib/db/__tests__/application-drafts-phi-strip.test.ts`, inside the `wizardState.data` literal add after the `signing:` line:

```ts
          attachments: { ard: { repName: "Quinn Rep" }, irs4506: { taxpayerId: "900701234" } },
```

and extend the final regex assertion to `.not.toMatch(/Ada|123456789|9999|987654321|Pat|Quinn|900701234/)`.

Also update the existing helper-free assertions elsewhere only if the next step's run shows them failing (see Step 4).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/masshealth/saca2/__tests__/types.test.ts lib/masshealth/saca2/__tests__/wizard-state.test.ts lib/db/__tests__/application-drafts-phi-strip.test.ts lib/phi-token`
Expected: FAIL — `a.facility` is `undefined`, `supplements.c` is an object, `attachments` is missing, and the strip test fails because `attachments` is not yet in the shared PHI list.

- [ ] **Step 3: Implement the type, default, padding, and PHI-list changes**

In `lib/masshealth/saca2/types.ts`:

1. Add `"attachments",` as the last element of `SACA2_PHI_KEYS` (after `"signing",`).

2. Delete the declarations `SupplementA`, `SupplementB`, `SupplementC`, `SupplementD`, and `Saca2Supplements` (keep `DailyLivingActivity`) and insert, in the same place:

```ts
export interface RelativeInHome {
  has: YesNo | null
  name: string
  livesInHome: YesNo | null
}

export interface HomeProperty {
  ownerNames: string
  propertyAddress: string
  ownershipType: "individual" | "tenancyInCommon" | "jointTenancy" | "lifeEstate" | null
  fairMarketValue: number | null
}

export interface FamilyMemberAtHome {
  name: string
  ssn: string
  relationship: string
  /** ISO YYYY-MM-DD. */
  dateOfBirth: string | null
  monthlyIncome: number | null
}

export interface LongTermCarePolicy {
  companyAndPolicyNumber: string
  policyholder: string
  /** ISO YYYY-MM-DD. */
  effectiveDate: string | null
  premium: number | null
}

export interface SupplementA {
  needsNursingFacility: YesNo | null
  applyingHcbsWaiver: YesNo | null
  applyingPace: YesNo | null
  /** Question 15; not asked of HCBS Waiver applicants. */
  intendsToReturnHome: YesNo | null
  facility: {
    name: string
    address: string
    /** ISO YYYY-MM-DD. */
    admissionDate: string | null
    placedByOtherState: YesNo | null
    placedFromState: string
    paysGuardianshipExpenses: YesNo | null
  }
  spouseMonthlyExpenses: {
    rent: number | null
    mortgage: number | null
    homeownersInsurance: number | null
    realEstateTaxes: number | null
    condoOrCoopFee: number | null
    assistedLivingRoomAndBoard: number | null
    paysHeat: YesNo | null
    paysUtilities: YesNo | null
  }
  familyAtHome: { hasFamily: YesNo | null; members: FamilyMemberAtHome[] }
  /** Question 6 a–h (past 60 months). `lifeEstateLivedOneYear` is 6e and is NOT a transfer. */
  transferAnswers: {
    trust: YesNo | null
    income: YesNo | null
    assets: YesNo | null
    deed: YesNo | null
    lifeEstateLivedOneYear: YesNo | null
    addedToDeed: YesNo | null
    loanOrNote: YesNo | null
    annuity: YesNo | null
  }
  /** Question 7: deposit to a health-care or residential facility. */
  facilityDeposit: {
    gaveDeposit: YesNo | null
    facilityName: string
    facilityAddress: string
    amount: number | null
    stillHeld: YesNo | null
    returned: YesNo | null
    returnedToName: string
    returnedToAddress: string
  }
  /** Questions 8–16. */
  home: {
    ownsHome: YesNo | null
    properties: HomeProperty[]
    spouse: RelativeInHome
    disabledChild: RelativeInHome
    childUnder21: RelativeInHome & { dateOfBirth: string | null }
    sibling: RelativeInHome
    caregiverChild: RelativeInHome
    dependentRelative: RelativeInHome & { relationshipDescription: string }
    ownsOtherRealEstate: YesNo | null
    otherRealEstateDescription: string
  }
  longTermCareInsurance: { hasPolicy: YesNo | null; policies: LongTermCarePolicy[] }
  /** Tax returns filed in the last two years. */
  taxReturnsFiled: "bothYears" | "oneYear" | "neither" | null
  hasCopiesOfTaxReturns: YesNo | null
}

export interface AianMember {
  name: string
  federallyRecognizedTribe: YesNo | null
  tribeName: string
  massRecognizedTribe: YesNo | null
  massTribeName: string
  receivedIhsService: YesNo | null
  eligibleForIhs: YesNo | null
  excludedIncomeAmount: number | null
  excludedIncomeFrequency: IncomeFrequency | null
}

export interface SupplementB {
  members: AianMember[]
}

export interface ActivityNeed {
  needsHandsOnHelp: YesNo | null
  timesPerDay: number | null
  daysPerWeek: number | null
}

export interface SupplementC {
  /** Three free-text lines. */
  healthProblems: string[]
  activities: Record<DailyLivingActivity, ActivityNeed>
  caregivers: Array<{ name: string; relationship: string }>
}

export interface EmployerJob {
  employeeName: string
  employeeSsn: string
  eligibleWithinThreeMonths: YesNo | null
  /** ISO YYYY-MM-DD: when a person in a waiting period can enroll. */
  waitingPeriodEnds: string | null
  employerName: string
  employerFederalTaxId: string
  employerAddress: string
  employerCity: string
  employerState: string
  employerZip: string
  employerPhone: string
  contactName: string
  contactPhone: string
  contactEmail: string
  individualPlanName: string
  individualMeetsMinimumValue: YesNo | null
  individualPremium: number | null
  individualPremiumFrequency: IncomeFrequency | null
  familyPlanName: string
  familyMeetsMinimumValue: YesNo | null
  familyPremium: number | null
  familyPremiumFrequency: IncomeFrequency | null
  upcomingChange: "none" | "employerWillNotOffer" | "personWillDrop" | "employerWillChange" | null
  changeEndDate: string | null
  changePremium: number | null
  changePremiumFrequency: IncomeFrequency | null
  changeDate: string | null
}

export interface SupplementD {
  jobs: EmployerJob[]
}

export interface Saca2Supplements {
  a: SupplementA
  b: SupplementB
  /** One entry per person (index 0 = Person 1, 1 = Person 2). */
  c: SupplementC[]
  d: SupplementD
}

export interface ArdData {
  /** Which ARD section applies: 1 applicant designates in writing, 2 cannot designate, 3 appointed by law. */
  section: "applicantDesignates" | "cannotDesignate" | "appointedByLaw" | null
  repKind: "person" | "organization" | null
  repName: string
  repPhone: string
  repStreet: string
  repCity: string
  repState: string
  repZip: string
  repEmail: string
  orgName: string
  staffName: string
  staffEmail: string
  officerName: string
  officerTitle: string
  /** Section 3: description of the legal document (guardianship, power of attorney, ...). */
  legalDocument: string
}

export interface Irs4506Data {
  jointReturn: YesNo | null
  /** Taxpayer ID (ITIN) when Person 1 has no SSN. */
  taxpayerId: string
  previousAddress: string
  formNumber: string
  yearsRequested: Array<{ periodEnd: string | null }>
}
```

3. In `Saca2Answers`, after the `signing: { ... }` property add:

```ts
  /** ARD-1122 and IRS 4506 attachment data — PHI. */
  attachments: { ard: ArdData; irs4506: Irs4506Data }
```

4. In `emptySaca2Answers()` replace the whole `supplements: { ... },` property with:

```ts
    supplements: {
      a: {
        needsNursingFacility: null,
        applyingHcbsWaiver: null,
        applyingPace: null,
        intendsToReturnHome: null,
        facility: { name: "", address: "", admissionDate: null, placedByOtherState: null, placedFromState: "", paysGuardianshipExpenses: null },
        spouseMonthlyExpenses: {
          rent: null,
          mortgage: null,
          homeownersInsurance: null,
          realEstateTaxes: null,
          condoOrCoopFee: null,
          assistedLivingRoomAndBoard: null,
          paysHeat: null,
          paysUtilities: null,
        },
        familyAtHome: { hasFamily: null, members: [] },
        transferAnswers: {
          trust: null,
          income: null,
          assets: null,
          deed: null,
          lifeEstateLivedOneYear: null,
          addedToDeed: null,
          loanOrNote: null,
          annuity: null,
        },
        facilityDeposit: {
          gaveDeposit: null,
          facilityName: "",
          facilityAddress: "",
          amount: null,
          stillHeld: null,
          returned: null,
          returnedToName: "",
          returnedToAddress: "",
        },
        home: {
          ownsHome: null,
          properties: [],
          spouse: { has: null, name: "", livesInHome: null },
          disabledChild: { has: null, name: "", livesInHome: null },
          childUnder21: { has: null, name: "", livesInHome: null, dateOfBirth: null },
          sibling: { has: null, name: "", livesInHome: null },
          caregiverChild: { has: null, name: "", livesInHome: null },
          dependentRelative: { has: null, name: "", livesInHome: null, relationshipDescription: "" },
          ownsOtherRealEstate: null,
          otherRealEstateDescription: "",
        },
        longTermCareInsurance: { hasPolicy: null, policies: [] },
        taxReturnsFiled: null,
        hasCopiesOfTaxReturns: null,
      },
      b: { members: [] },
      c: [emptySupplementC(), emptySupplementC()],
      d: { jobs: [] },
    },
```

5. After the `signing: { ... },` default inside `emptySaca2Answers()` add:

```ts
    attachments: {
      ard: {
        section: null,
        repKind: null,
        repName: "",
        repPhone: "",
        repStreet: "",
        repCity: "",
        repState: "MA",
        repZip: "",
        repEmail: "",
        orgName: "",
        staffName: "",
        staffEmail: "",
        officerName: "",
        officerTitle: "",
        legalDocument: "",
      },
      irs4506: { jointReturn: null, taxpayerId: "", previousAddress: "", formNumber: "1040", yearsRequested: [] },
    },
```

6. Immediately above `export function emptySaca2Answers()` add:

```ts
function emptyActivityNeed(): ActivityNeed {
  return { needsHandsOnHelp: null, timesPerDay: null, daysPerWeek: null }
}

export function emptySupplementC(): SupplementC {
  return {
    healthProblems: ["", "", ""],
    activities: {
      mobility: emptyActivityNeed(),
      medications: emptyActivityNeed(),
      bathing: emptyActivityNeed(),
      dressing: emptyActivityNeed(),
      rangeOfMotion: emptyActivityNeed(),
      eating: emptyActivityNeed(),
      toileting: emptyActivityNeed(),
    },
    caregivers: [],
  }
}
```

In `lib/phi-token/phi-fields.ts` add `"attachments",` as the last element of `PHI_DATA_KEYS` and a line to the doc comment: `attachments — ARD-1122 representative and IRS 4506 data (SACA-2).`

In `lib/masshealth/saca2/wizard-state.ts` replace `normalizeAnswers` with:

```ts
/** Merge each entry of a fixed-length list over its default so a short or older array still has every field. */
function padFixedList<T>(items: T[], defaults: T[]): T[] {
  return defaults.map((fallback, index) => overlay(fallback, items[index]))
}

function normalizeAnswers(raw: unknown): Saca2Answers {
  const base = emptySaca2Answers()
  if (!isPlainObject(raw)) return base
  const merged = overlay(base, { ...raw, persons: undefined }) as Saca2Answers

  const rawPersons = Array.isArray(raw.persons) ? raw.persons : []
  const persons = rawPersons
    .filter(isPlainObject)
    .slice(0, 2)
    .map((rawPerson) => overlay(emptySaca2Person(), rawPerson))
  return {
    ...merged,
    persons: persons.length > 0 ? persons : base.persons,
    pca: { ...merged.pca, byPerson: padFixedList(merged.pca.byPerson, base.pca.byPerson) },
    supplements: { ...merged.supplements, c: padFixedList(merged.supplements.c, base.supplements.c) },
  }
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run lib/masshealth/saca2 lib/db lib/phi-token components/application/saca2 && npx tsc --noEmit -p tsconfig.json`
Expected: PASS and no type errors. Mechanical test updates you should expect and report: a test or fixture that constructed the old single-object `supplements.c`, `supplements.b/d` rows, or `activities` partial — update it to the new shape without loosening any assertion. If the registry test "every path resolves on empty answers" or other existing tests fail for an unrelated reason, stop and report.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/types.ts lib/masshealth/saca2/wizard-state.ts lib/phi-token/phi-fields.ts lib/masshealth/saca2/__tests__ lib/db/__tests__/application-drafts-phi-strip.test.ts
git commit -m "feat(saca2): add supplement and attachment types, hydration padding, and the attachments PHI key" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Supplement A part 1 — intro, facility, spouse living expenses

**Files:**
- Create: `lib/masshealth/saca2/questions/supplement-a.ts`
- Modify: `lib/masshealth/saca2/questions/index.ts` (register `suppA`)
- Modify: `lib/masshealth/saca2/__tests__/questions-content.test.ts` (step list gains `"suppA"`; replace the null-content assertions)
- Modify: `components/application/saca2/__tests__/saca2-step-form.test.tsx` (the unimplemented-step test)
- Test: `lib/masshealth/saca2/__tests__/questions-supplement-a-care.test.ts` (create)

**Interfaces:**
- Consumes: builders; `isStepVisible` from `../visibility` (spouse presence); `FamilyMemberAtHome` (Task 1).
- Produces: `SUPPLEMENT_A_STEP_CONTENT: Saca2StepContent` (root scope) registered as `suppA`, with sections `intro`, `facility`, `expenses` now; Tasks 3 and 4 append more sections to its `sections` array.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-supplement-a-care.test.ts`:

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

/** Errors for suppA whose key equals or sits under one of the prefixes (later tasks add other sections). */
function errs(a: Saca2Answers, ...prefixes: string[]): Record<string, string> {
  const all = validateStep("suppA", a, ON)
  return Object.fromEntries(Object.entries(all).filter(([key]) => prefixes.some((p) => key === p || key.startsWith(`${p}.`))))
}

const INTRO = ["supplements.a.needsNursingFacility", "supplements.a.applyingHcbsWaiver", "supplements.a.applyingPace"]
const FACILITY = "supplements.a.facility"
const SPOUSE_COSTS = ["supplements.a.spouseMonthlyExpenses", "supplements.a.familyAtHome"]

const withSpouse = (a: Saca2Answers) => {
  a.persons[0].isLegallyMarried = "yes"
  a.persons.push({ ...emptySaca2Person(), firstName: "Dorothy" })
}

describe("Supplement A: intro", () => {
  it("requires the three program questions", () => {
    expect(Object.keys(errs(answers(), ...INTRO)).sort()).toEqual([...INTRO].sort())
  })

  it("is satisfied by three answers", () => {
    const a = answers((x) => {
      x.supplements.a.needsNursingFacility = "no"
      x.supplements.a.applyingHcbsWaiver = "yes"
      x.supplements.a.applyingPace = "no"
    })
    expect(errs(a, ...INTRO)).toEqual({})
  })
})

describe("Supplement A: facility", () => {
  const nursing = (x: Saca2Answers) => (x.supplements.a.needsNursingFacility = "yes")

  it("is not asked unless a nursing-home-type facility is needed, even with stale answers", () => {
    const a = answers((x) => {
      x.supplements.a.needsNursingFacility = "no"
      x.supplements.a.facility.placedByOtherState = "yes"
    })
    expect(errs(a, FACILITY)).toEqual({})
  })

  it("requires the facility details for a nursing-facility applicant", () => {
    expect(Object.keys(errs(answers(nursing), FACILITY)).sort()).toEqual([
      "supplements.a.facility.address",
      "supplements.a.facility.admissionDate",
      "supplements.a.facility.name",
      "supplements.a.facility.paysGuardianshipExpenses",
      "supplements.a.facility.placedByOtherState",
    ])
  })

  it("asks which state only when placed by another state", () => {
    const a = answers((x) => {
      nursing(x)
      x.supplements.a.facility = {
        name: "Example Nursing Home",
        address: "5 Elm St",
        admissionDate: "2026-09-01",
        placedByOtherState: "yes",
        placedFromState: "",
        paysGuardianshipExpenses: "no",
      }
    })
    expect(errs(a, FACILITY)).toEqual({ "supplements.a.facility.placedFromState": "This question is required." })
    a.supplements.a.facility.placedFromState = "NH"
    expect(errs(a, FACILITY)).toEqual({})
  })
})

describe("Supplement A: spouse living expenses and family at home", () => {
  const nursing = (x: Saca2Answers) => (x.supplements.a.needsNursingFacility = "yes")

  it("is not asked of an HCBS/PACE applicant or someone with no spouse", () => {
    const hcbs = answers((x) => {
      x.supplements.a.needsNursingFacility = "no"
      x.supplements.a.applyingHcbsWaiver = "yes"
      withSpouse(x)
    })
    expect(errs(hcbs, ...SPOUSE_COSTS)).toEqual({})
    const single = answers(nursing)
    expect(errs(single, ...SPOUSE_COSTS)).toEqual({})
  })

  it("does not treat a blank hidden second person as a spouse", () => {
    const a = answers((x) => {
      nursing(x)
      x.persons.push(emptySaca2Person())
    })
    expect(errs(a, ...SPOUSE_COSTS)).toEqual({})
  })

  it("asks heat, utilities, and the family question when a spouse is at home", () => {
    const a = answers((x) => {
      nursing(x)
      withSpouse(x)
    })
    expect(Object.keys(errs(a, ...SPOUSE_COSTS)).sort()).toEqual([
      "supplements.a.familyAtHome.hasFamily",
      "supplements.a.spouseMonthlyExpenses.paysHeat",
      "supplements.a.spouseMonthlyExpenses.paysUtilities",
    ])
  })

  it("requires family rows when family lives with the spouse, and validates each row", () => {
    const a = answers((x) => {
      nursing(x)
      withSpouse(x)
      x.supplements.a.spouseMonthlyExpenses.paysHeat = "yes"
      x.supplements.a.spouseMonthlyExpenses.paysUtilities = "yes"
      x.supplements.a.familyAtHome.hasFamily = "yes"
    })
    expect(errs(a, ...SPOUSE_COSTS)).toEqual({ "supplements.a.familyAtHome.members": "Add at least one." })
    a.supplements.a.familyAtHome.members = [{ name: "", ssn: "", relationship: "", dateOfBirth: null, monthlyIncome: null }]
    expect(Object.keys(errs(a, ...SPOUSE_COSTS)).sort()).toEqual([
      "supplements.a.familyAtHome.members.0.dateOfBirth",
      "supplements.a.familyAtHome.members.0.monthlyIncome",
      "supplements.a.familyAtHome.members.0.name",
      "supplements.a.familyAtHome.members.0.relationship",
    ])
    a.supplements.a.familyAtHome.members = [
      { name: "Test Child", ssn: "", relationship: "child", dateOfBirth: "1980-02-01", monthlyIncome: 1200 },
    ]
    expect(errs(a, ...SPOUSE_COSTS)).toEqual({})
  })

  it("accepts blank monthly amounts but rejects a negative one", () => {
    const a = answers((x) => {
      nursing(x)
      withSpouse(x)
      x.supplements.a.spouseMonthlyExpenses.paysHeat = "no"
      x.supplements.a.spouseMonthlyExpenses.paysUtilities = "no"
      x.supplements.a.familyAtHome.hasFamily = "no"
      x.supplements.a.spouseMonthlyExpenses.rent = 1200
    })
    expect(errs(a, ...SPOUSE_COSTS)).toEqual({})
    a.supplements.a.spouseMonthlyExpenses.mortgage = -1
    expect(errs(a, ...SPOUSE_COSTS)).toEqual({
      "supplements.a.spouseMonthlyExpenses.mortgage": "Enter a number that is 0 or more.",
    })
  })
})
```

In `lib/masshealth/saca2/__tests__/questions-content.test.ts`: add `"suppA"` to the `withContent` array in `implements exactly the steps listed here`, and replace its `expect(getStepContent("suppA")).toBeNull()` line with `expect(getStepContent("nope" as never)).toBeNull()`.

In `components/application/saca2/__tests__/saca2-step-form.test.tsx` find the test that renders a step without content (`renders nothing for a step without content`) and change its `stepId` from `"suppA"` to `"nope" as never` (any id that is not a real step), keeping the assertion `toBeEmptyDOMElement()`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-supplement-a-care.test.ts`
Expected: FAIL — `suppA` has no content, so `validateStep("suppA", …)` returns `{}` and the "requires" cases fail.

- [ ] **Step 3: Write the content module**

Create `lib/masshealth/saca2/questions/supplement-a.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { FamilyMemberAtHome } from "../types"
import { isStepVisible } from "../visibility"
import { date, money, repeater, ssn, text, yesNo } from "./builders"
import type { Saca2QuestionContext, Saca2Section, Saca2StepContent } from "./types"

const supplementA = (ctx: Saca2QuestionContext) => ctx.answers.supplements.a
const needsNursingFacility = (ctx: Saca2QuestionContext) => supplementA(ctx).needsNursingFacility === "yes"
const spouseIsPresent = (ctx: Saca2QuestionContext) => isStepVisible("person2", ctx.answers, ctx.on)
const spouseAtHomeApplies = (ctx: Saca2QuestionContext) => needsNursingFacility(ctx) && spouseIsPresent(ctx)

const INTRO_SECTION: Saca2Section = {
  id: "intro",
  title: "Long-term care services and supports",
  description:
    "If you need long-term-care services in a nursing-home-type facility, answer every question and complete every section. If you are applying for a Home- and Community-Based Services (HCBS) Waiver or PACE, you need to complete the resource-transfer and long-term-care-insurance sections.",
  questions: [
    yesNo("supplements.a.needsNursingFacility", "Do you need long-term-care services and supports in a nursing-home-type facility?", { required: true }),
    yesNo("supplements.a.applyingHcbsWaiver", "Are you applying for or getting long-term-care services and supports at home under a Home- and Community-Based Services (HCBS) Waiver?", { required: true }),
    yesNo("supplements.a.applyingPace", "Are you applying for or getting long-term-care services and supports through the Program of All-Inclusive Care for the Elderly (PACE)?", { required: true }),
  ],
}

const FACILITY_SECTION: Saca2Section = {
  id: "facility",
  title: "Applicant and facility information",
  questions: [
    text("supplements.a.facility.name", "Name of the hospital, nursing facility, or other institution", { required: true, visibleWhen: needsNursingFacility }),
    text("supplements.a.facility.address", "Address of the hospital, nursing facility, or other institution", { required: true, visibleWhen: needsNursingFacility }),
    date("supplements.a.facility.admissionDate", "Date of admission", { required: true, visibleWhen: needsNursingFacility }),
    yesNo("supplements.a.facility.placedByOtherState", "Were you placed here by another state?", { required: true, visibleWhen: needsNursingFacility }),
    text("supplements.a.facility.placedFromState", "If Yes, what state?", {
      required: true,
      visibleWhen: (ctx) => needsNursingFacility(ctx) && supplementA(ctx).facility.placedByOtherState === "yes",
    }),
    yesNo("supplements.a.facility.paysGuardianshipExpenses", "Do you have to pay guardianship expenses for a court-appointed guardian?", {
      required: true,
      visibleWhen: needsNursingFacility,
    }),
  ],
}

const EXPENSES_SECTION: Saca2Section = {
  id: "expenses",
  title: "Living expenses of the spouse and family members living at home",
  description:
    "Your spouse living at home may be able to keep some of your income. Tell us about your spouse's current living expenses and send proof. If you do not have a spouse, skip this section.",
  questions: [
    money("supplements.a.spouseMonthlyExpenses.rent", "Rent (per month, $)", { visibleWhen: spouseAtHomeApplies }),
    money("supplements.a.spouseMonthlyExpenses.mortgage", "Mortgage, principal and interest (per month, $)", { visibleWhen: spouseAtHomeApplies }),
    money("supplements.a.spouseMonthlyExpenses.homeownersInsurance", "Homeowner's or tenant's insurance (per month, $)", { visibleWhen: spouseAtHomeApplies }),
    money("supplements.a.spouseMonthlyExpenses.realEstateTaxes", "Real estate taxes (per month, $)", { visibleWhen: spouseAtHomeApplies }),
    money("supplements.a.spouseMonthlyExpenses.condoOrCoopFee", "Required maintenance charge for a condo or co-op (per month, $)", { visibleWhen: spouseAtHomeApplies }),
    money("supplements.a.spouseMonthlyExpenses.assistedLivingRoomAndBoard", "Room and board for assisted living (per month, $)", { visibleWhen: spouseAtHomeApplies }),
    yesNo("supplements.a.spouseMonthlyExpenses.paysHeat", "Does your spouse pay for heat?", { required: true, visibleWhen: spouseAtHomeApplies }),
    yesNo("supplements.a.spouseMonthlyExpenses.paysUtilities", "Does your spouse pay for utilities?", { required: true, visibleWhen: spouseAtHomeApplies }),
    yesNo("supplements.a.familyAtHome.hasFamily", "Is a child, parent, and/or sibling living with your spouse?", {
      required: true,
      visibleWhen: spouseAtHomeApplies,
      help: "If Yes, send proof of each person's monthly income before deductions. These persons must be related to you or your spouse, and one of you must claim them as dependents on your federal income tax return.",
    }),
    repeater(
      "supplements.a.familyAtHome.members",
      "People living with your spouse",
      {
        questions: [
          text("name", "Name", { required: true }),
          ssn("ssn", "Social Security number"),
          text("relationship", "Relationship to you or your spouse", { required: true }),
          date("dateOfBirth", "Date of birth", { required: true }),
          money("monthlyIncome", "Monthly income before deductions ($)", { required: true }),
        ],
        emptyItem: () =>
          ({ name: "", ssn: "", relationship: "", dateOfBirth: null, monthlyIncome: null }) satisfies FamilyMemberAtHome,
        addLabel: "Add a person",
        itemTitle: "Person",
        maxItems: 4,
      },
      {
        required: true,
        visibleWhen: (ctx) => spouseAtHomeApplies(ctx) && supplementA(ctx).familyAtHome.hasFamily === "yes",
      },
    ),
  ],
}

export const SUPPLEMENT_A_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [INTRO_SECTION, FACILITY_SECTION, EXPENSES_SECTION],
}
```

In `lib/masshealth/saca2/questions/index.ts` import `SUPPLEMENT_A_STEP_CONTENT` from `./supplement-a` and add `suppA: SUPPLEMENT_A_STEP_CONTENT,` to the `CONTENT` map.

- [ ] **Step 4: Run the tests, type check, and lint**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS. The registry test "every path resolves on empty answers" now covers the Supplement A paths (all have Task 1 defaults). If it reports an import cycle from `supplement-a.ts` → `visibility.ts`, check that `visibility.ts` imports nothing from `questions/`.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/supplement-a.ts lib/masshealth/saca2/questions/index.ts lib/masshealth/saca2/__tests__/questions-supplement-a-care.test.ts lib/masshealth/saca2/__tests__/questions-content.test.ts components/application/saca2/__tests__/saca2-step-form.test.tsx
git commit -m "feat(saca2): add Supplement A intro, facility, and spouse living-expense questions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Supplement A part 2 — resource transfers and facility deposit

**Files:**
- Modify: `lib/masshealth/saca2/questions/supplement-a.ts` (append two sections)
- Test: `lib/masshealth/saca2/__tests__/questions-supplement-a-transfers.test.ts` (create)

**Interfaces:**
- Consumes: Task 2 module; `Saca2Transfer` fields (`description`, `dateOfTransfer`, `transferredTo`, `relationship`, `amount`); `supplements.a.transferAnswers`, `supplements.a.facilityDeposit` (Task 1).
- Produces: sections `transfers` (seven required Yes/No questions + optional 6e + a required top-level `transfers` repeater when any of the seven is Yes) and `deposit` (Question 7 chain), appended to `SUPPLEMENT_A_STEP_CONTENT.sections`.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-supplement-a-transfers.test.ts`:

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

function errs(a: Saca2Answers, ...prefixes: string[]): Record<string, string> {
  const all = validateStep("suppA", a, ON)
  return Object.fromEntries(Object.entries(all).filter(([key]) => prefixes.some((p) => key === p || key.startsWith(`${p}.`))))
}

const TRANSFER_KEYS = ["trust", "income", "assets", "deed", "addedToDeed", "loanOrNote", "annuity"] as const
const TRANSFERS = ["supplements.a.transferAnswers", "transfers"]
const DEPOSIT = "supplements.a.facilityDeposit"

const allNo = (a: Saca2Answers) => {
  for (const key of TRANSFER_KEYS) a.supplements.a.transferAnswers[key] = "no"
}

describe("Supplement A: resource transfers", () => {
  it("requires the seven transfer questions but not the life-estate question (6e)", () => {
    expect(Object.keys(errs(answers(), ...TRANSFERS)).sort()).toEqual(
      TRANSFER_KEYS.map((key) => `supplements.a.transferAnswers.${key}`).sort(),
    )
  })

  it("needs no transfer table when every transfer question is no", () => {
    expect(errs(answers(allNo), ...TRANSFERS)).toEqual({})
  })

  it("does not treat a Yes to 6e (lived in the home a year after buying a life estate) as a transfer", () => {
    const a = answers((x) => {
      allNo(x)
      x.supplements.a.transferAnswers.lifeEstateLivedOneYear = "yes"
    })
    expect(errs(a, ...TRANSFERS)).toEqual({})
  })

  it.each(TRANSFER_KEYS)("requires at least one transfer row when %s is yes", (key) => {
    const a = answers((x) => {
      allNo(x)
      x.supplements.a.transferAnswers[key] = "yes"
    })
    expect(errs(a, ...TRANSFERS)).toEqual({ transfers: "Add at least one." })
  })

  it("validates each transfer row and accepts a complete one", () => {
    const a = answers((x) => {
      allNo(x)
      x.supplements.a.transferAnswers.assets = "yes"
      x.transfers = [{ description: "", dateOfTransfer: null, transferredTo: "", relationship: "", amount: null }]
    })
    expect(Object.keys(errs(a, ...TRANSFERS)).sort()).toEqual([
      "transfers.0.amount",
      "transfers.0.dateOfTransfer",
      "transfers.0.description",
      "transfers.0.relationship",
      "transfers.0.transferredTo",
    ])
    a.transfers = [{ description: "Cash gift", dateOfTransfer: "2024-03-15", transferredTo: "Test Child", relationship: "child", amount: 30000 }]
    expect(errs(a, ...TRANSFERS)).toEqual({})
  })

  it("ignores leftover transfer rows after every answer flips back to no", () => {
    const a = answers((x) => {
      allNo(x)
      x.transfers = [{ description: "", dateOfTransfer: null, transferredTo: "", relationship: "", amount: null }]
    })
    expect(errs(a, ...TRANSFERS)).toEqual({})
  })
})

describe("Supplement A: deposit to a facility", () => {
  it("requires the opening question only", () => {
    expect(errs(answers(), DEPOSIT)).toEqual({ "supplements.a.facilityDeposit.gaveDeposit": "This question is required." })
    expect(errs(answers((x) => (x.supplements.a.facilityDeposit.gaveDeposit = "no")), DEPOSIT)).toEqual({})
  })

  it("asks for the facility, the amount, and whether the deposit is held or returned", () => {
    const a = answers((x) => (x.supplements.a.facilityDeposit.gaveDeposit = "yes"))
    expect(Object.keys(errs(a, DEPOSIT)).sort()).toEqual([
      "supplements.a.facilityDeposit.amount",
      "supplements.a.facilityDeposit.facilityAddress",
      "supplements.a.facilityDeposit.facilityName",
      "supplements.a.facilityDeposit.returned",
      "supplements.a.facilityDeposit.stillHeld",
    ])
  })

  it("asks who received a returned deposit only when it was returned", () => {
    const base = (x: Saca2Answers) => {
      x.supplements.a.facilityDeposit = {
        gaveDeposit: "yes",
        facilityName: "Example Residence",
        facilityAddress: "5 Elm St",
        amount: 3000,
        stillHeld: "no",
        returned: "no",
        returnedToName: "",
        returnedToAddress: "",
      }
    }
    expect(errs(answers(base), DEPOSIT)).toEqual({})
    const returned = answers((x) => {
      base(x)
      x.supplements.a.facilityDeposit.returned = "yes"
    })
    expect(errs(returned, DEPOSIT)).toEqual({
      "supplements.a.facilityDeposit.returnedToAddress": "This question is required.",
      "supplements.a.facilityDeposit.returnedToName": "This question is required.",
    })
  })

  it("ignores stale deposit details after the opening answer flips to no", () => {
    const a = answers((x) => {
      x.supplements.a.facilityDeposit.gaveDeposit = "no"
      x.supplements.a.facilityDeposit.returned = "yes"
    })
    expect(errs(a, DEPOSIT)).toEqual({})
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-supplement-a-transfers.test.ts`
Expected: FAIL — the sections do not exist yet, so required transfer/deposit questions produce no errors.

- [ ] **Step 3: Append the two sections**

In `lib/masshealth/saca2/questions/supplement-a.ts`:

1. Extend the imports: `import type { FamilyMemberAtHome, Saca2Transfer } from "../types"` and add `select` is not needed; `repeater`, `money`, `text`, `date`, `yesNo` are already imported.

2. Immediately above `export const SUPPLEMENT_A_STEP_CONTENT`, insert:

```ts
const TRANSFER_KEYS = ["trust", "income", "assets", "deed", "addedToDeed", "loanOrNote", "annuity"] as const
/** 6e (life estate lived in) is deliberately not a transfer: a Yes there is the good answer. */
const anyTransfer = (ctx: Saca2QuestionContext) =>
  TRANSFER_KEYS.some((key) => supplementA(ctx).transferAnswers[key] === "yes")

const TRANSFERS_SECTION: Saca2Section = {
  id: "transfers",
  title: "Resource transfers",
  description: "Resources include both income and assets. These questions cover the past 60 months.",
  questions: [
    yesNo("supplements.a.transferAnswers.trust", "In the past 60 months, has any property that was available or belonged to you or your spouse been transferred into or out of a trust?", { required: true }),
    yesNo("supplements.a.transferAnswers.income", "Did you, your spouse, or someone on your behalf transfer income or the right to income?", { required: true }),
    yesNo("supplements.a.transferAnswers.assets", "Did you, your spouse, or someone on your behalf transfer, change ownership in, give away, or sell any assets, including your home or other real estate?", { required: true }),
    yesNo("supplements.a.transferAnswers.deed", "Did you, your spouse, or someone on your behalf change the deed or the ownership of any real estate, including creating a life estate, even if the life estate was purchased in another person's residence?", { required: true }),
    yesNo("supplements.a.transferAnswers.lifeEstateLivedOneYear", "If you purchased a life estate in another person's home, did you live in the home for at least one year after you purchased the life estate?", {
      help: "Leave blank if this does not apply. A Yes here does not count as a transfer.",
    }),
    yesNo("supplements.a.transferAnswers.addedToDeed", "Did you, your spouse, or someone on your behalf add another name to the deed of any property you own?", { required: true }),
    yesNo("supplements.a.transferAnswers.loanOrNote", "Did you, your spouse, or someone on your behalf receive or give anyone a mortgage, loan, or promissory note on any property or other asset?", { required: true }),
    yesNo("supplements.a.transferAnswers.annuity", "Did you, your spouse, or someone on your behalf purchase or in any way change an annuity?", { required: true }),
    repeater(
      "transfers",
      "Transfers",
      {
        questions: [
          text("description", "Description of asset or income", { required: true }),
          date("dateOfTransfer", "Date of transfer", { required: true }),
          text("transferredTo", "Transferred to whom", { required: true }),
          text("relationship", "Relationship to you or your spouse", { required: true }),
          money("amount", "Amount of transfer ($)", { required: true }),
        ],
        emptyItem: () =>
          ({ description: "", dateOfTransfer: null, transferredTo: "", relationship: "", amount: null }) satisfies Saca2Transfer,
        addLabel: "Add a transfer",
        itemTitle: "Transfer",
        maxItems: 10,
      },
      { required: true, visibleWhen: anyTransfer, help: "Send proof of each transfer." },
    ),
  ],
}

const deposit = (ctx: Saca2QuestionContext) => supplementA(ctx).facilityDeposit
const gaveDeposit = (ctx: Saca2QuestionContext) => deposit(ctx).gaveDeposit === "yes"

const DEPOSIT_SECTION: Saca2Section = {
  id: "deposit",
  title: "Deposit to a care or residential facility",
  questions: [
    yesNo("supplements.a.facilityDeposit.gaveDeposit", "Have you, your spouse, or someone acting on your behalf given a deposit to any health-care or residential facility, like an assisted-living facility, a continuing-care retirement community, or a life-care community?", {
      required: true,
      help: "If Yes, send a copy of the contract you signed with the facility and any documents about this deposit.",
    }),
    text("supplements.a.facilityDeposit.facilityName", "Name of facility", { required: true, visibleWhen: gaveDeposit }),
    text("supplements.a.facilityDeposit.facilityAddress", "Address of facility", { required: true, visibleWhen: gaveDeposit }),
    money("supplements.a.facilityDeposit.amount", "Amount of deposit ($)", { required: true, visibleWhen: gaveDeposit }),
    yesNo("supplements.a.facilityDeposit.stillHeld", "Does the facility still have the deposit?", { required: true, visibleWhen: gaveDeposit }),
    yesNo("supplements.a.facilityDeposit.returned", "Did the facility return the deposit?", { required: true, visibleWhen: gaveDeposit }),
    text("supplements.a.facilityDeposit.returnedToName", "Name of the person who got the deposit from the facility", {
      required: true,
      visibleWhen: (ctx) => gaveDeposit(ctx) && deposit(ctx).returned === "yes",
    }),
    text("supplements.a.facilityDeposit.returnedToAddress", "Address of the person who got the deposit from the facility", {
      required: true,
      visibleWhen: (ctx) => gaveDeposit(ctx) && deposit(ctx).returned === "yes",
    }),
  ],
}
```

3. Change the `sections` array to `sections: [INTRO_SECTION, FACILITY_SECTION, EXPENSES_SECTION, TRANSFERS_SECTION, DEPOSIT_SECTION],`.

- [ ] **Step 4: Run the tests, type check, and lint**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS. The earlier Task 2 test still passes because it asserts only its own key prefixes.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/supplement-a.ts lib/masshealth/saca2/__tests__/questions-supplement-a-transfers.test.ts
git commit -m "feat(saca2): add Supplement A resource-transfer and facility-deposit questions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Supplement A part 3 — home, relatives, long-term-care insurance, tax returns

**Files:**
- Modify: `lib/masshealth/saca2/questions/supplement-a.ts` (append three sections)
- Test: `lib/masshealth/saca2/__tests__/questions-supplement-a-home.test.ts` (create)

**Interfaces:**
- Consumes: Task 2/3 module; `HomeProperty`, `LongTermCarePolicy`, `RelativeInHome` (Task 1).
- Produces: sections `home` (Questions 8–16), `ltci` (Question 17), `tax` (Question 18) appended to `SUPPLEMENT_A_STEP_CONTENT.sections`. The "intend to return home" question is hidden when `applyingHcbsWaiver === "yes"`.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-supplement-a-home.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type HomeProperty, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

function errs(a: Saca2Answers, ...prefixes: string[]): Record<string, string> {
  const all = validateStep("suppA", a, ON)
  return Object.fromEntries(Object.entries(all).filter(([key]) => prefixes.some((p) => key === p || key.startsWith(`${p}.`))))
}

const HOME = ["supplements.a.home", "supplements.a.intendsToReturnHome"]
const LTCI = "supplements.a.longTermCareInsurance"
const TAX = ["supplements.a.taxReturnsFiled", "supplements.a.hasCopiesOfTaxReturns"]

const property: HomeProperty = {
  ownerNames: "Walter Testcase",
  propertyAddress: "1 Example St, Testville MA",
  ownershipType: "individual",
  fairMarketValue: 450000,
}

describe("Supplement A: home and relatives", () => {
  it("requires whether you own a home, and the return-home question", () => {
    expect(Object.keys(errs(answers(), ...HOME)).sort()).toEqual([
      "supplements.a.home.ownsHome",
      "supplements.a.home.ownsOtherRealEstate",
      "supplements.a.intendsToReturnHome",
    ])
  })

  it("hides the return-home question for an HCBS Waiver applicant", () => {
    const a = answers((x) => (x.supplements.a.applyingHcbsWaiver = "yes"))
    expect(errs(a, "supplements.a.intendsToReturnHome")).toEqual({})
  })

  it("asks about the property and the six relatives only when you own a home", () => {
    const no = answers((x) => (x.supplements.a.home.ownsHome = "no"))
    expect(Object.keys(errs(no, ...HOME)).sort()).toEqual([
      "supplements.a.home.ownsOtherRealEstate",
      "supplements.a.intendsToReturnHome",
    ])
    const yes = answers((x) => (x.supplements.a.home.ownsHome = "yes"))
    expect(Object.keys(errs(yes, ...HOME)).sort()).toEqual([
      "supplements.a.home.caregiverChild.has",
      "supplements.a.home.childUnder21.has",
      "supplements.a.home.dependentRelative.has",
      "supplements.a.home.disabledChild.has",
      "supplements.a.home.ownsOtherRealEstate",
      "supplements.a.home.properties",
      "supplements.a.home.sibling.has",
      "supplements.a.home.spouse.has",
      "supplements.a.intendsToReturnHome",
    ])
  })

  it("validates property rows", () => {
    const a = answers((x) => {
      x.supplements.a.home.ownsHome = "yes"
      x.supplements.a.home.properties = [{ ownerNames: "", propertyAddress: "", ownershipType: null, fairMarketValue: null }]
    })
    expect(Object.keys(errs(a, "supplements.a.home.properties")).sort()).toEqual([
      "supplements.a.home.properties.0.fairMarketValue",
      "supplements.a.home.properties.0.ownerNames",
      "supplements.a.home.properties.0.ownershipType",
      "supplements.a.home.properties.0.propertyAddress",
    ])
    a.supplements.a.home.properties = [property]
    expect(errs(a, "supplements.a.home.properties")).toEqual({})
  })

  it.each([
    ["spouse", {}],
    ["disabledChild", {}],
    ["sibling", {}],
    ["caregiverChild", {}],
  ] as const)("asks for the name and whether %s lives in the home when yes", (key) => {
    const a = answers((x) => {
      x.supplements.a.home.ownsHome = "yes"
      x.supplements.a.home[key].has = "yes"
    })
    expect(errs(a, `supplements.a.home.${key}`)).toEqual({
      [`supplements.a.home.${key}.livesInHome`]: "This question is required.",
      [`supplements.a.home.${key}.name`]: "This question is required.",
    })
  })

  it("asks a child under 21 for a date of birth and a dependent relative for the relationship", () => {
    const a = answers((x) => {
      x.supplements.a.home.ownsHome = "yes"
      x.supplements.a.home.childUnder21.has = "yes"
      x.supplements.a.home.dependentRelative.has = "yes"
    })
    expect(Object.keys(errs(a, "supplements.a.home.childUnder21", "supplements.a.home.dependentRelative")).sort()).toEqual([
      "supplements.a.home.childUnder21.dateOfBirth",
      "supplements.a.home.childUnder21.livesInHome",
      "supplements.a.home.childUnder21.name",
      "supplements.a.home.dependentRelative.livesInHome",
      "supplements.a.home.dependentRelative.name",
      "supplements.a.home.dependentRelative.relationshipDescription",
    ])
  })

  it("ignores relatives and properties left behind after ownsHome flips to no", () => {
    const a = answers((x) => {
      x.supplements.a.home.ownsHome = "no"
      x.supplements.a.home.spouse.has = "yes"
      x.supplements.a.home.properties = [{ ownerNames: "", propertyAddress: "", ownershipType: null, fairMarketValue: null }]
    })
    expect(errs(a, "supplements.a.home.spouse", "supplements.a.home.properties")).toEqual({})
  })

  it("asks for a description of other real estate when yes", () => {
    const a = answers((x) => (x.supplements.a.home.ownsOtherRealEstate = "yes"))
    expect(errs(a, "supplements.a.home.ownsOtherRealEstate", "supplements.a.home.otherRealEstateDescription")).toEqual({
      "supplements.a.home.otherRealEstateDescription": "This question is required.",
    })
  })
})

describe("Supplement A: long-term-care insurance", () => {
  it("requires the opening question, then rows when yes", () => {
    expect(errs(answers(), LTCI)).toEqual({ "supplements.a.longTermCareInsurance.hasPolicy": "This question is required." })
    const yes = answers((x) => (x.supplements.a.longTermCareInsurance.hasPolicy = "yes"))
    expect(errs(yes, LTCI)).toEqual({ "supplements.a.longTermCareInsurance.policies": "Add at least one." })
    yes.supplements.a.longTermCareInsurance.policies = [{ companyAndPolicyNumber: "", policyholder: "", effectiveDate: null, premium: null }]
    expect(Object.keys(errs(yes, LTCI)).sort()).toEqual([
      "supplements.a.longTermCareInsurance.policies.0.companyAndPolicyNumber",
      "supplements.a.longTermCareInsurance.policies.0.effectiveDate",
      "supplements.a.longTermCareInsurance.policies.0.policyholder",
      "supplements.a.longTermCareInsurance.policies.0.premium",
    ])
    yes.supplements.a.longTermCareInsurance.policies = [{ companyAndPolicyNumber: "Example LTC / P-1", policyholder: "Walter", effectiveDate: "2015-01-01", premium: 250 }]
    expect(errs(yes, LTCI)).toEqual({})
  })

  it("ignores stale policies after the answer flips to no", () => {
    const a = answers((x) => {
      x.supplements.a.longTermCareInsurance.hasPolicy = "no"
      x.supplements.a.longTermCareInsurance.policies = [{ companyAndPolicyNumber: "", policyholder: "", effectiveDate: null, premium: null }]
    })
    expect(errs(a, LTCI)).toEqual({})
  })
})

describe("Supplement A: tax returns", () => {
  it("requires which returns were filed, and whether copies were kept when any were filed", () => {
    expect(errs(answers(), ...TAX)).toEqual({ "supplements.a.taxReturnsFiled": "This question is required." })
    expect(errs(answers((x) => (x.supplements.a.taxReturnsFiled = "neither")), ...TAX)).toEqual({})
    for (const filed of ["bothYears", "oneYear"] as const) {
      const a = answers((x) => (x.supplements.a.taxReturnsFiled = filed))
      expect(errs(a, ...TAX)).toEqual({ "supplements.a.hasCopiesOfTaxReturns": "This question is required." })
      a.supplements.a.hasCopiesOfTaxReturns = "no"
      expect(errs(a, ...TAX)).toEqual({})
    }
  })

  it("ignores a stale copies answer when no returns were filed", () => {
    const a = answers((x) => {
      x.supplements.a.taxReturnsFiled = "neither"
      x.supplements.a.hasCopiesOfTaxReturns = null
    })
    expect(errs(a, ...TAX)).toEqual({})
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-supplement-a-home.test.ts`
Expected: FAIL — the sections do not exist yet.

- [ ] **Step 3: Append the three sections**

In `lib/masshealth/saca2/questions/supplement-a.ts`:

1. Extend the type import: `import type { FamilyMemberAtHome, HomeProperty, LongTermCarePolicy, Saca2Transfer } from "../types"`, and the builders import to include `opts` and `select`.

2. Above `export const SUPPLEMENT_A_STEP_CONTENT`, insert:

```ts
const home = (ctx: Saca2QuestionContext) => supplementA(ctx).home
const ownsHome = (ctx: Saca2QuestionContext) => home(ctx).ownsHome === "yes"
const isHcbsApplicant = (ctx: Saca2QuestionContext) => supplementA(ctx).applyingHcbsWaiver === "yes"

type RelativeKey = "spouse" | "disabledChild" | "childUnder21" | "sibling" | "caregiverChild" | "dependentRelative"

/** One gate, a name, and "lives in your home?" per relative; some relatives add one more answer. */
function relativeQuestions(
  key: RelativeKey,
  gateLabel: string,
  extras: (has: (ctx: Saca2QuestionContext) => boolean) => Saca2Question[] = () => [],
): Saca2Question[] {
  const base = `supplements.a.home.${key}`
  const has = (ctx: Saca2QuestionContext) => ownsHome(ctx) && home(ctx)[key].has === "yes"
  return [
    yesNo(`${base}.has`, gateLabel, { required: true, visibleWhen: ownsHome }),
    text(`${base}.name`, "Name", { required: true, visibleWhen: has }),
    ...extras(has),
    yesNo(`${base}.livesInHome`, "Is this person living in your home?", { required: true, visibleWhen: has }),
  ]
}

const HOME_SECTION: Saca2Section = {
  id: "home",
  title: "Your home and real estate",
  description:
    "These answers decide whether your real estate counts as an asset or a lien may be placed on it. If the equity in your principal home is over a certain limit, you may not be eligible for payment of long-term-care services unless certain conditions are met.",
  questions: [
    yesNo("supplements.a.home.ownsHome", "Do you or your spouse own or have a legal interest in your home, including a life estate?", { required: true, help: "If No, answer the questions about intending to return home and other real estate only." }),
    repeater(
      "supplements.a.home.properties",
      "Your home",
      {
        questions: [
          text("ownerNames", "Name(s) and address(es) of the person(s) on the ownership papers", { required: true }),
          text("propertyAddress", "Description and address of the property", { required: true }),
          select(
            "ownershipType",
            "Type of ownership",
            opts([
              ["individual", "Individual"],
              ["tenancyInCommon", "Tenancy in common"],
              ["jointTenancy", "Joint tenancy"],
              ["lifeEstate", "Life estate"],
            ]),
            { required: true },
          ),
          money("fairMarketValue", "Fair-market value ($)", { required: true }),
        ],
        emptyItem: () =>
          ({ ownerNames: "", propertyAddress: "", ownershipType: null, fairMarketValue: null }) satisfies HomeProperty,
        addLabel: "Add a property",
        itemTitle: "Property",
        maxItems: 2,
      },
      { required: true, visibleWhen: ownsHome },
    ),
    ...relativeQuestions("spouse", "Do you have a spouse?"),
    ...relativeQuestions("disabledChild", "Do you have a permanently and totally disabled or blind child?"),
    ...relativeQuestions("childUnder21", "Do you have a child under 21 years old?", (has) => [
      date("supplements.a.home.childUnder21.dateOfBirth", "Date of birth", { required: true, visibleWhen: has }),
    ]),
    ...relativeQuestions("sibling", "Do you have a sibling with a legal interest in the home who was living in the home for at least one year immediately before your admission to the medical institution?"),
    ...relativeQuestions("caregiverChild", "Do you have a child who has lived in the home for at least the last two years before your admission to the medical institution and has provided care to you that allowed you to live in the home?"),
    ...relativeQuestions("dependentRelative", "Do you have a dependent relative?", (has) => [
      text("supplements.a.home.dependentRelative.relationshipDescription", "Describe the relationship and the nature of the dependency", { required: true, visibleWhen: has }),
    ]),
    yesNo("supplements.a.intendsToReturnHome", "Do you intend to return to your home?", {
      required: true,
      visibleWhen: (ctx) => !isHcbsApplicant(ctx),
      help: "Do not answer this question if you are applying for a Home- and Community-Based Services Waiver.",
    }),
    yesNo("supplements.a.home.ownsOtherRealEstate", "Do you or your spouse own or have a legal interest in other real estate not listed above?", { required: true }),
    text("supplements.a.home.otherRealEstateDescription", "Describe the property and list its address", {
      required: true,
      visibleWhen: (ctx) => home(ctx).ownsOtherRealEstate === "yes",
    }),
  ],
}

const LTCI_SECTION: Saca2Section = {
  id: "ltci",
  title: "Long-term-care insurance",
  questions: [
    yesNo("supplements.a.longTermCareInsurance.hasPolicy", "Do you or your spouse have long-term-care insurance?", { required: true, help: "If Yes, send a copy of the policy." }),
    repeater(
      "supplements.a.longTermCareInsurance.policies",
      "Policies",
      {
        questions: [
          text("companyAndPolicyNumber", "Company name and policy number", { required: true }),
          text("policyholder", "Policyholder name", { required: true }),
          date("effectiveDate", "Effective date", { required: true }),
          money("premium", "Premium amount ($)", { required: true }),
        ],
        emptyItem: () =>
          ({ companyAndPolicyNumber: "", policyholder: "", effectiveDate: null, premium: null }) satisfies LongTermCarePolicy,
        addLabel: "Add a policy",
        itemTitle: "Policy",
        maxItems: 2,
      },
      { required: true, visibleWhen: (ctx) => supplementA(ctx).longTermCareInsurance.hasPolicy === "yes" },
    ),
  ],
}

const filedAny = (ctx: Saca2QuestionContext) => {
  const filed = supplementA(ctx).taxReturnsFiled
  return filed === "bothYears" || filed === "oneYear"
}

const TAX_SECTION: Saca2Section = {
  id: "tax",
  title: "Tax returns",
  questions: [
    select(
      "supplements.a.taxReturnsFiled",
      "Did you or your spouse file US income tax returns in the last two years?",
      opts([
        ["bothYears", "Yes, both years"],
        ["oneYear", "Yes, one of these years"],
        ["neither", "No, neither year"],
      ]),
      { required: true },
    ),
    yesNo("supplements.a.hasCopiesOfTaxReturns", "Do you have copies of these returns to send?", {
      required: true,
      visibleWhen: filedAny,
      help: "If Yes, you must send copies. If you did not keep copies of one or more of the returns, you must send a filled-out and signed IRS Form 4506 (the form is included with this application).",
    }),
  ],
}
```

and add `Saca2Question` to the type import from `./types`; change the builders import to `import { date, money, opts, repeater, select, ssn, text, yesNo } from "./builders"`.

3. Change `sections` to `[INTRO_SECTION, FACILITY_SECTION, EXPENSES_SECTION, TRANSFERS_SECTION, DEPOSIT_SECTION, HOME_SECTION, LTCI_SECTION, TAX_SECTION]`.

- [ ] **Step 4: Run the tests, type check, and lint**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS. Note the form's `taxReturnsFiled` semantics: the existing `irs4506` visibility rule (`taxReturnsFiled` is `bothYears`/`oneYear` and `hasCopiesOfTaxReturns === "no"`) is unchanged and now reachable through these questions.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/supplement-a.ts lib/masshealth/saca2/__tests__/questions-supplement-a-home.test.ts
git commit -m "feat(saca2): add Supplement A home, relatives, long-term-care insurance, and tax-return questions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Supplements B and D

**Files:**
- Create: `lib/masshealth/saca2/questions/supplement-b.ts`
- Create: `lib/masshealth/saca2/questions/supplement-d.ts`
- Modify: `lib/masshealth/saca2/questions/index.ts` (register `suppB`, `suppD`)
- Modify: `lib/masshealth/saca2/__tests__/questions-content.test.ts` (step list gains `"suppB"`, `"suppD"`)
- Test: `lib/masshealth/saca2/__tests__/questions-supplement-bd.test.ts` (create)

**Interfaces:**
- Consumes: builders; `AianMember`, `EmployerJob` (Task 1); `validateStateCode`, `validateZip` from `./validators`.
- Produces: `SUPPLEMENT_B_STEP_CONTENT` (repeater `supplements.b.members`, required, maxItems 6) and `SUPPLEMENT_D_STEP_CONTENT` (repeater `supplements.d.jobs`, required, maxItems 4), both root scope. In D, everything after "eligible within three months" appears only when that answer is "yes"; a pending employer change adds conditional fields.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-supplement-bd.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type AianMember, type EmployerJob, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

const member = (over: Partial<AianMember> = {}): AianMember => ({
  name: "Test Member",
  federallyRecognizedTribe: "no",
  tribeName: "",
  massRecognizedTribe: "no",
  massTribeName: "",
  receivedIhsService: "yes",
  eligibleForIhs: null,
  excludedIncomeAmount: null,
  excludedIncomeFrequency: null,
  ...over,
})

describe("suppB step", () => {
  it("asks for at least one member", () => {
    expect(validateStep("suppB", answers(), ON)).toEqual({ "supplements.b.members": "Add at least one." })
  })

  it("validates the required answers per member", () => {
    const blank = member({ name: "", federallyRecognizedTribe: null, massRecognizedTribe: null, receivedIhsService: null })
    const a = answers((x) => (x.supplements.b.members = [blank]))
    expect(Object.keys(validateStep("suppB", a, ON)).sort()).toEqual([
      "supplements.b.members.0.federallyRecognizedTribe",
      "supplements.b.members.0.massRecognizedTribe",
      "supplements.b.members.0.name",
      "supplements.b.members.0.receivedIhsService",
    ])
  })

  it("asks tribe names only for a yes, and IHS eligibility only when no IHS service was received", () => {
    const a = answers((x) => {
      x.supplements.b.members = [
        member({ federallyRecognizedTribe: "yes", massRecognizedTribe: "yes", receivedIhsService: "no" }),
      ]
    })
    expect(Object.keys(validateStep("suppB", a, ON)).sort()).toEqual([
      "supplements.b.members.0.eligibleForIhs",
      "supplements.b.members.0.massTribeName",
      "supplements.b.members.0.tribeName",
    ])
    a.supplements.b.members = [
      member({
        federallyRecognizedTribe: "yes",
        tribeName: "Example Tribe",
        massRecognizedTribe: "yes",
        massTribeName: "Example MA Tribe",
        receivedIhsService: "no",
        eligibleForIhs: "yes",
      }),
    ]
    expect(validateStep("suppB", a, ON)).toEqual({})
  })

  it("requires how often when an excluded income amount is given", () => {
    const a = answers((x) => (x.supplements.b.members = [member({ excludedIncomeAmount: 200 })]))
    expect(validateStep("suppB", a, ON)).toEqual({ "supplements.b.members.0.excludedIncomeFrequency": "This question is required." })
    a.supplements.b.members = [member({ excludedIncomeAmount: 200, excludedIncomeFrequency: "monthly" })]
    expect(validateStep("suppB", a, ON)).toEqual({})
  })
})

const job = (over: Partial<EmployerJob> = {}): EmployerJob => ({
  employeeName: "Edna Testcase",
  employeeSsn: "",
  eligibleWithinThreeMonths: "yes",
  waitingPeriodEnds: null,
  employerName: "Acme",
  employerFederalTaxId: "",
  employerAddress: "9 Work Rd",
  employerCity: "Testville",
  employerState: "MA",
  employerZip: "02101",
  employerPhone: "6175550100",
  contactName: "HR",
  contactPhone: "",
  contactEmail: "",
  individualPlanName: "Gold Individual",
  individualMeetsMinimumValue: "yes",
  individualPremium: 120,
  individualPremiumFrequency: "monthly",
  familyPlanName: "",
  familyMeetsMinimumValue: null,
  familyPremium: null,
  familyPremiumFrequency: null,
  upcomingChange: "none",
  changeEndDate: null,
  changePremium: null,
  changePremiumFrequency: null,
  changeDate: null,
  ...over,
})

describe("suppD step", () => {
  it("asks for at least one job", () => {
    expect(validateStep("suppD", answers(), ON)).toEqual({ "supplements.d.jobs": "Add at least one." })
  })

  it("passes a complete job", () => {
    expect(validateStep("suppD", answers((x) => (x.supplements.d.jobs = [job()])), ON)).toEqual({})
  })

  it("stops after the eligibility question when no one can enroll within three months", () => {
    const a = answers((x) => {
      x.supplements.d.jobs = [
        job({ eligibleWithinThreeMonths: "no", employerName: "", individualPlanName: "", individualMeetsMinimumValue: null, individualPremium: null, individualPremiumFrequency: null }),
      ]
    })
    expect(validateStep("suppD", a, ON)).toEqual({})
  })

  it("requires the employee, employer, and lowest-cost individual plan when eligible", () => {
    const a = answers((x) => {
      x.supplements.d.jobs = [
        job({ employeeName: "", employerName: "", individualPlanName: "", individualMeetsMinimumValue: null, individualPremium: null, individualPremiumFrequency: null }),
      ]
    })
    expect(Object.keys(validateStep("suppD", a, ON)).sort()).toEqual([
      "supplements.d.jobs.0.employeeName",
      "supplements.d.jobs.0.employerName",
      "supplements.d.jobs.0.individualMeetsMinimumValue",
      "supplements.d.jobs.0.individualPlanName",
      "supplements.d.jobs.0.individualPremium",
      "supplements.d.jobs.0.individualPremiumFrequency",
    ])
  })

  it("keeps the household-member plan optional but validates formats", () => {
    const ok = answers((x) => (x.supplements.d.jobs = [job({ familyPlanName: "Family Plus" })]))
    expect(validateStep("suppD", ok, ON)).toEqual({})
    const bad = answers((x) => (x.supplements.d.jobs = [job({ employerZip: "12", employerState: "Massachusetts", contactEmail: "nope", employeeSsn: "1" })]))
    expect(Object.keys(validateStep("suppD", bad, ON)).sort()).toEqual([
      "supplements.d.jobs.0.contactEmail",
      "supplements.d.jobs.0.employeeSsn",
      "supplements.d.jobs.0.employerState",
      "supplements.d.jobs.0.employerZip",
    ])
  })

  it("asks the follow-up questions for a pending employer change", () => {
    const stops = answers((x) => (x.supplements.d.jobs = [job({ upcomingChange: "employerWillNotOffer" })]))
    expect(validateStep("suppD", stops, ON)).toEqual({ "supplements.d.jobs.0.changeEndDate": "This question is required." })
    const drops = answers((x) => (x.supplements.d.jobs = [job({ upcomingChange: "personWillDrop", changeEndDate: "2026-12-31" })]))
    expect(validateStep("suppD", drops, ON)).toEqual({})
    const changes = answers((x) => (x.supplements.d.jobs = [job({ upcomingChange: "employerWillChange" })]))
    expect(Object.keys(validateStep("suppD", changes, ON)).sort()).toEqual([
      "supplements.d.jobs.0.changeDate",
      "supplements.d.jobs.0.changePremium",
      "supplements.d.jobs.0.changePremiumFrequency",
    ])
  })

  it("does not ask about changes once the job is not eligible, even with a stale selection", () => {
    const a = answers((x) => (x.supplements.d.jobs = [job({ eligibleWithinThreeMonths: "no", upcomingChange: "employerWillChange" })]))
    expect(validateStep("suppD", a, ON)).toEqual({})
  })
})
```

In `questions-content.test.ts` add `"suppB"` and `"suppD"` to `withContent`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-supplement-bd.test.ts`
Expected: FAIL — `suppB`/`suppD` have no content, so every case that expects an error gets `{}`.

- [ ] **Step 3: Write the two modules**

Create `lib/masshealth/saca2/questions/supplement-b.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { AianMember } from "../types"
import { money, opts, repeater, select, text, yesNo } from "./builders"
import type { Saca2StepContent } from "./types"

const FREQUENCIES = opts([
  ["weekly", "Weekly"],
  ["every2weeks", "Every 2 weeks"],
  ["twiceMonthly", "Twice a month"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["yearly", "Yearly"],
])

export const SUPPLEMENT_B_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "aianMembers",
      title: "American Indian or Alaska Native household members",
      description:
        "American Indians and Alaska Natives can get services from the Indian Health Service, tribal health programs, or Urban Indian Health Programs. They may also not have to pay cost sharing and may get special monthly enrollment periods.",
      questions: [
        repeater(
          "supplements.b.members",
          "Household members",
          {
            questions: [
              text("name", "Name (first, middle, last)", { required: true }),
              yesNo("federallyRecognizedTribe", "Member of a federally recognized tribe?", { required: true }),
              text("tribeName", "Tribe name", { required: true, visibleWhen: (ctx) => ctx.item?.federallyRecognizedTribe === "yes" }),
              yesNo("massRecognizedTribe", "Member of a Massachusetts-recognized tribe?", { required: true }),
              text("massTribeName", "Tribe name", { required: true, visibleWhen: (ctx) => ctx.item?.massRecognizedTribe === "yes" }),
              yesNo("receivedIhsService", "Has this person ever gotten a service from the Indian Health Service, a tribal health program, or Urban Indian Health Program, or through a referral from one of these programs?", { required: true }),
              yesNo("eligibleForIhs", "If No, is this person eligible to get services from the Indian Health Service, tribal health programs, or Urban Indian Health Program, or through a referral from one of these programs?", {
                required: true,
                visibleWhen: (ctx) => ctx.item?.receivedIhsService === "no",
              }),
              money("excludedIncomeAmount", "Money that may not be counted for MassHealth ($): per capita payments from a tribe from natural resources, usage rights, leases, or royalties; payments from Indian trust land; money from selling things of cultural significance", {}),
              select("excludedIncomeFrequency", "How often", FREQUENCIES, {
                required: true,
                visibleWhen: (ctx) => typeof ctx.item?.excludedIncomeAmount === "number",
              }),
            ],
            emptyItem: () =>
              ({
                name: "",
                federallyRecognizedTribe: null,
                tribeName: "",
                massRecognizedTribe: null,
                massTribeName: "",
                receivedIhsService: null,
                eligibleForIhs: null,
                excludedIncomeAmount: null,
                excludedIncomeFrequency: null,
              }) satisfies AianMember,
            addLabel: "Add a household member",
            itemTitle: "Household member",
            maxItems: 6,
          },
          { required: true },
        ),
      ],
    },
  ],
}
```

Create `lib/masshealth/saca2/questions/supplement-d.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EmployerJob } from "../types"
import { date, email, money, opts, phone, repeater, select, ssn, text, yesNo } from "./builders"
import type { Saca2QuestionContext, Saca2StepContent } from "./types"
import { validateStateCode, validateZip } from "./validators"

const FREQUENCIES = opts([
  ["weekly", "Weekly"],
  ["every2weeks", "Every 2 weeks"],
  ["twiceMonthly", "Twice a month"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["yearly", "Yearly"],
])

const eligible = (ctx: Saca2QuestionContext) => ctx.item?.eligibleWithinThreeMonths === "yes"
const change = (ctx: Saca2QuestionContext, kind: string) => eligible(ctx) && ctx.item?.upcomingChange === kind

export const SUPPLEMENT_D_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "jobs",
      title: "Health coverage from jobs",
      description:
        "Answer these questions if someone in the household is eligible for health coverage from a job, whether or not they are enrolled. Add one entry for each job that offers coverage.",
      questions: [
        repeater(
          "supplements.d.jobs",
          "Jobs that offer coverage",
          {
            questions: [
              text("employeeName", "Employee name (first, middle, last)", { required: true }),
              ssn("employeeSsn", "Employee Social Security number"),
              yesNo("eligibleWithinThreeMonths", "Is at least one person on this application currently eligible for or enrolled in coverage offered by this employer, or will at least one person become eligible within the next 3 months?", {
                required: true,
                help: "If No, stop here and skip the rest of this entry.",
              }),
              date("waitingPeriodEnds", "If any person is in a waiting or probationary period, when can this person enroll in coverage?", { visibleWhen: eligible }),
              text("employerName", "Employer name", { required: true, visibleWhen: eligible }),
              text("employerFederalTaxId", "Federal Tax ID (if known)", { visibleWhen: eligible }),
              text("employerAddress", "Employer address", { visibleWhen: eligible }),
              text("employerCity", "City", { visibleWhen: eligible }),
              text("employerState", "State", { visibleWhen: eligible, validate: validateStateCode }),
              text("employerZip", "ZIP code", { visibleWhen: eligible, validate: validateZip }),
              phone("employerPhone", "Employer phone number", { visibleWhen: eligible }),
              text("contactName", "Who can we contact about employee health coverage at this job?", { visibleWhen: eligible }),
              phone("contactPhone", "Contact phone number (if different from above)", { visibleWhen: eligible }),
              email("contactEmail", "Contact email address", { visibleWhen: eligible }),
              text("individualPlanName", "Name of the lowest-cost individual health plan offered to the employee", { required: true, visibleWhen: eligible }),
              yesNo("individualMeetsMinimumValue", "Does this plan meet the minimum value standard for coverage?", {
                required: true,
                visibleWhen: eligible,
                help: "A plan meets the minimum value standard if the plan's share of the total allowed benefit costs covered by the plan is at least 60 percent of such costs.",
              }),
              money("individualPremium", "How much would this employee pay in premiums for this plan? ($)", { required: true, visibleWhen: eligible }),
              select("individualPremiumFrequency", "How often would the employee pay this amount?", FREQUENCIES, { required: true, visibleWhen: eligible }),
              text("familyPlanName", "Name of the lowest-cost health plan to cover the other household members who qualify through the employer", { visibleWhen: eligible }),
              yesNo("familyMeetsMinimumValue", "Does this plan meet the minimum value standard for coverage?", {
                visibleWhen: (ctx) => eligible(ctx) && typeof ctx.item?.familyPlanName === "string" && ctx.item.familyPlanName.trim() !== "",
              }),
              money("familyPremium", "How much would this employee pay in premiums for this plan? ($)", {
                visibleWhen: (ctx) => eligible(ctx) && typeof ctx.item?.familyPlanName === "string" && ctx.item.familyPlanName.trim() !== "",
              }),
              select("familyPremiumFrequency", "How often would the employee pay this amount?", FREQUENCIES, {
                visibleWhen: (ctx) => eligible(ctx) && typeof ctx.item?.familyPlanName === "string" && ctx.item.familyPlanName.trim() !== "",
              }),
              select(
                "upcomingChange",
                "What change will the employer make for the new plan year (if known)?",
                opts([
                  ["none", "No change"],
                  ["employerWillNotOffer", "Employer will not offer health coverage"],
                  ["personWillDrop", "The person plans to drop the employer's health coverage"],
                  ["employerWillChange", "Employer will start offering coverage or change the premium for the lowest-cost plans"],
                ]),
                { required: true, visibleWhen: eligible },
              ),
              date("changeEndDate", "Coverage end date", {
                required: true,
                visibleWhen: (ctx) => change(ctx, "employerWillNotOffer") || change(ctx, "personWillDrop"),
              }),
              money("changePremium", "How much would this employee pay in premiums for this plan? ($)", {
                required: true,
                visibleWhen: (ctx) => change(ctx, "employerWillChange"),
              }),
              select("changePremiumFrequency", "How often?", FREQUENCIES, {
                required: true,
                visibleWhen: (ctx) => change(ctx, "employerWillChange"),
              }),
              date("changeDate", "Date of change", { required: true, visibleWhen: (ctx) => change(ctx, "employerWillChange") }),
            ],
            emptyItem: () =>
              ({
                employeeName: "",
                employeeSsn: "",
                eligibleWithinThreeMonths: null,
                waitingPeriodEnds: null,
                employerName: "",
                employerFederalTaxId: "",
                employerAddress: "",
                employerCity: "",
                employerState: "MA",
                employerZip: "",
                employerPhone: "",
                contactName: "",
                contactPhone: "",
                contactEmail: "",
                individualPlanName: "",
                individualMeetsMinimumValue: null,
                individualPremium: null,
                individualPremiumFrequency: null,
                familyPlanName: "",
                familyMeetsMinimumValue: null,
                familyPremium: null,
                familyPremiumFrequency: null,
                upcomingChange: "none",
                changeEndDate: null,
                changePremium: null,
                changePremiumFrequency: null,
                changeDate: null,
              }) satisfies EmployerJob,
            addLabel: "Add a job",
            itemTitle: "Job",
            maxItems: 4,
          },
          { required: true },
        ),
      ],
    },
  ],
}
```

In `lib/masshealth/saca2/questions/index.ts` import both and add `suppB: SUPPLEMENT_B_STEP_CONTENT,` and `suppD: SUPPLEMENT_D_STEP_CONTENT,` to `CONTENT`.

- [ ] **Step 4: Run the tests, type check, and lint**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS. `FREQUENCIES` is repeated in the two modules; if eslint or review flags the verbatim duplicate, export one shared `PREMIUM_FREQUENCIES` from `questions/validators.ts`-sibling module `options.ts` and import it in both — acceptable and preferred; report it either way.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/supplement-b.ts lib/masshealth/saca2/questions/supplement-d.ts lib/masshealth/saca2/questions/index.ts lib/masshealth/saca2/__tests__/questions-supplement-bd.test.ts lib/masshealth/saca2/__tests__/questions-content.test.ts
git commit -m "feat(saca2): add Supplement B (AI/AN) and Supplement D (jobs) questions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Supplement C — personal-care attendant, per person

**Files:**
- Create: `lib/masshealth/saca2/questions/supplement-c.ts`
- Modify: `lib/masshealth/saca2/questions/index.ts` (register `suppC`)
- Modify: `lib/masshealth/saca2/__tests__/questions-content.test.ts` (step list gains `"suppC"`)
- Test: `lib/masshealth/saca2/__tests__/questions-supplement-c.test.ts` (create)

**Interfaces:**
- Consumes: builders; `isStepVisible` from `../visibility`; `SupplementC` (`healthProblems`, `activities`, `caregivers`) and `DailyLivingActivity` (Task 1).
- Produces: `SUPPLEMENT_C_STEP_CONTENT` (root scope) with one section per person (`supplements.c.0.*` for Person 1, `supplements.c.1.*` for Person 2). A person's section is visible only when that person qualifies: `pca.needsPca === "yes"`, `paidByMassHealthLastSixMonths !== "yes"`, all three `pca.byPerson[i]` answers `"yes"`, and (for Person 2) the spouse is present. Wording for both persons comes from one factory and is pinned exactly in a test.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-supplement-c.test.ts`:

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
  mutate(a)
  return a
}

const qualifies = (index: 0 | 1) => (a: Saca2Answers) => {
  a.pca.needsPca = "yes"
  a.pca.paidByMassHealthLastSixMonths = "no"
  a.pca.byPerson[index] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }
}

const withSpouse = (a: Saca2Answers) => {
  a.persons[0].isLegallyMarried = "yes"
  a.persons.push({ ...emptySaca2Person(), firstName: "Walter" })
}

const ACTIVITIES = ["mobility", "medications", "bathing", "dressing", "rangeOfMotion", "eating", "toileting"] as const

describe("suppC step", () => {
  it("asks nothing of a person who does not qualify", () => {
    expect(validateStep("suppC", answers(), ON)).toEqual({})
    const stale = answers((a) => {
      a.pca.needsPca = "yes"
      a.pca.paidByMassHealthLastSixMonths = "yes"
      a.pca.byPerson[0] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }
    })
    expect(validateStep("suppC", stale, ON)).toEqual({})
  })

  it("requires the first health problem and the seven activity answers for Person 1", () => {
    const errors = validateStep("suppC", answers(qualifies(0)), ON)
    expect(Object.keys(errors).sort()).toEqual(
      [
        "supplements.c.0.healthProblems.0",
        ...ACTIVITIES.map((activity) => `supplements.c.0.activities.${activity}.needsHandsOnHelp`),
      ].sort(),
    )
  })

  it("asks how often only for activities that need hands-on help, and checks the ranges", () => {
    const a = answers((x) => {
      qualifies(0)(x)
      x.supplements.c[0].healthProblems = ["Arthritis", "", ""]
      for (const activity of ACTIVITIES) x.supplements.c[0].activities[activity].needsHandsOnHelp = "no"
      x.supplements.c[0].activities.bathing.needsHandsOnHelp = "yes"
    })
    expect(Object.keys(validateStep("suppC", a, ON)).sort()).toEqual([
      "supplements.c.0.activities.bathing.daysPerWeek",
      "supplements.c.0.activities.bathing.timesPerDay",
    ])
    a.supplements.c[0].activities.bathing.timesPerDay = 0
    a.supplements.c[0].activities.bathing.daysPerWeek = 8
    expect(validateStep("suppC", a, ON)).toEqual({
      "supplements.c.0.activities.bathing.daysPerWeek": "Enter a whole number from 1 to 7.",
      "supplements.c.0.activities.bathing.timesPerDay": "Enter a whole number from 1 to 20.",
    })
    a.supplements.c[0].activities.bathing.timesPerDay = 2
    a.supplements.c[0].activities.bathing.daysPerWeek = 7
    expect(validateStep("suppC", a, ON)).toEqual({})
  })

  it("validates caregiver rows when present", () => {
    const a = answers((x) => {
      qualifies(0)(x)
      x.supplements.c[0].healthProblems = ["Arthritis", "", ""]
      for (const activity of ACTIVITIES) x.supplements.c[0].activities[activity].needsHandsOnHelp = "no"
      x.supplements.c[0].caregivers = [{ name: "", relationship: "" }]
    })
    expect(Object.keys(validateStep("suppC", a, ON)).sort()).toEqual([
      "supplements.c.0.caregivers.0.name",
      "supplements.c.0.caregivers.0.relationship",
    ])
  })

  it("asks the spouse's block only when the spouse qualifies and Person 2 exists", () => {
    const spouseOnly = answers(qualifies(1))
    expect(validateStep("suppC", spouseOnly, ON)).toEqual({})
    const real = answers((x) => {
      withSpouse(x)
      qualifies(1)(x)
    })
    expect(validateStep("suppC", real, ON)["supplements.c.1.healthProblems.0"]).toBe("This question is required.")
    const blankHidden = answers((x) => {
      x.persons.push(emptySaca2Person())
      qualifies(1)(x)
    })
    expect(validateStep("suppC", blankHidden, ON)).toEqual({})
  })

  it("shows both blocks for a couple who both qualify", () => {
    const a = answers((x) => {
      withSpouse(x)
      x.pca.needsPca = "yes"
      x.pca.paidByMassHealthLastSixMonths = "no"
      x.pca.byPerson[0] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }
      x.pca.byPerson[1] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }
    })
    const keys = Object.keys(validateStep("suppC", a, ON))
    expect(keys.some((k) => k.startsWith("supplements.c.0."))).toBe(true)
    expect(keys.some((k) => k.startsWith("supplements.c.1."))).toBe(true)
  })
})

describe("suppC question wording", () => {
  const labels = () => {
    const content = getStepContent("suppC")!
    const out: Record<string, string> = {}
    for (const section of content.sections) {
      for (const q of section.questions) out[q.path] = q.label as string
    }
    return out
  }

  it("is grammatical for both people and pins the key labels", () => {
    const l = labels()
    expect(l["supplements.c.0.activities.bathing.needsHandsOnHelp"]).toBe(
      "Do you need hands-on help from another person with bathing (tub, bed bath, shower, or washing chair) or general grooming (like brushing teeth or combing hair)?",
    )
    expect(l["supplements.c.1.activities.bathing.needsHandsOnHelp"]).toBe(
      "Does your spouse need hands-on help from another person with bathing (tub, bed bath, shower, or washing chair) or general grooming (like brushing teeth or combing hair)?",
    )
    expect(l["supplements.c.0.activities.bathing.timesPerDay"]).toBe("How many times a day do you need hands-on help with bathing or grooming?")
    expect(l["supplements.c.1.activities.bathing.timesPerDay"]).toBe("How many times a day does your spouse need hands-on help with bathing or grooming?")
    expect(l["supplements.c.1.activities.eating.daysPerWeek"]).toBe("How many days a week does your spouse need hands-on help with eating?")
    expect(l["supplements.c.0.healthProblems.0"]).toBe("List and describe your medical and mental health problems (including anything that makes it hard to do daily living activities, even if you are not getting treatment)")
    for (const label of Object.values(l)) {
      expect(label).not.toMatch(/\bDo your spouse\b/)
      expect(label).not.toMatch(/\bdoes you\b/i)
    }
  })

  it("has the same question set for both people", () => {
    const paths = Object.keys(labels())
    const zero = paths.filter((p) => p.startsWith("supplements.c.0.")).map((p) => p.replace("supplements.c.0.", ""))
    const one = paths.filter((p) => p.startsWith("supplements.c.1.")).map((p) => p.replace("supplements.c.1.", ""))
    expect(zero.sort()).toEqual(one.sort())
  })
})
```

In `questions-content.test.ts` add `"suppC"` to `withContent`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-supplement-c.test.ts`
Expected: FAIL — `suppC` has no content (`getStepContent("suppC")` is `null`, so the wording tests throw and the validation tests get `{}`).

- [ ] **Step 3: Write the module**

Create `lib/masshealth/saca2/questions/supplement-c.ts`:

```ts
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
```

In `lib/masshealth/saca2/questions/index.ts` import `SUPPLEMENT_C_STEP_CONTENT` and add `suppC: SUPPLEMENT_C_STEP_CONTENT,` to `CONTENT`.

- [ ] **Step 4: Run the tests, type check, and lint**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS. If a path such as `supplements.c.1.healthProblems.2` reports as unresolved in the registry test, check that `emptySupplementC().healthProblems` has three entries.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/supplement-c.ts lib/masshealth/saca2/questions/index.ts lib/masshealth/saca2/__tests__/questions-supplement-c.test.ts lib/masshealth/saca2/__tests__/questions-content.test.ts
git commit -m "feat(saca2): add Supplement C personal-care attendant questions for each qualifying person" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: ARD-1122 and IRS 4506 attachment data

**Files:**
- Create: `lib/masshealth/saca2/questions/attachments.ts`
- Modify: `lib/masshealth/saca2/questions/index.ts` (register `ard`, `irs4506`)
- Modify: `lib/masshealth/saca2/__tests__/questions-content.test.ts` (step list gains `"ard"`, `"irs4506"`; now every step has content)
- Test: `lib/masshealth/saca2/__tests__/questions-attachments.test.ts` (create)

**Interfaces:**
- Consumes: builders; `validateStateCode`, `validateZip`; `ArdData`, `Irs4506Data` (Task 1).
- Produces: `ARD_STEP_CONTENT` and `IRS4506_STEP_CONTENT` (root scope).
  - ARD: `attachments.ard.section` (required select of three). Representative contact (`repName`, `repPhone`, `repStreet`, `repCity`, `repState`, `repZip`) is required for every section; `repEmail` optional. Section 1 also asks `repKind`; for `organization`, `orgName`, `staffName`, `staffEmail` are required. Section 2 asks optional `orgName`; when it is non-empty, `officerName` and `officerTitle` are required. Section 3 requires `legalDocument`.
  - IRS 4506: `jointReturn` required; `taxpayerId` required only when Person 1 has no SSN (`persons[0].hasSsn !== "yes"`); `previousAddress` optional; `formNumber` required; `yearsRequested` repeater (`periodEnd` date required) required, maxItems 4.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-attachments.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type ArdData, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

const rep: Partial<ArdData> = {
  repName: "Quinn Rep",
  repPhone: "6175550101",
  repStreet: "3 Example St",
  repCity: "Testville",
  repState: "MA",
  repZip: "02101",
}

const ard = (over: Partial<ArdData>) => (a: Saca2Answers) => {
  a.attachments.ard = { ...a.attachments.ard, ...rep, ...over }
}

describe("ard step", () => {
  it("requires choosing which section applies", () => {
    expect(validateStep("ard", answers(), ON)).toEqual({ "attachments.ard.section": "This question is required." })
  })

  it("requires the representative's contact details for every section", () => {
    const a = answers((x) => (x.attachments.ard.section = "applicantDesignates"))
    expect(Object.keys(validateStep("ard", a, ON)).sort()).toEqual([
      "attachments.ard.repCity",
      "attachments.ard.repKind",
      "attachments.ard.repName",
      "attachments.ard.repPhone",
      "attachments.ard.repStreet",
      "attachments.ard.repZip",
    ])
  })

  it("section 1 with a person needs only the contact details", () => {
    const a = answers(ard({ section: "applicantDesignates", repKind: "person" }))
    expect(validateStep("ard", a, ON)).toEqual({})
  })

  it("section 1 with an organization also needs the organization and staff details", () => {
    const a = answers(ard({ section: "applicantDesignates", repKind: "organization" }))
    expect(Object.keys(validateStep("ard", a, ON)).sort()).toEqual([
      "attachments.ard.orgName",
      "attachments.ard.staffEmail",
      "attachments.ard.staffName",
    ])
    a.attachments.ard.orgName = "Example Advocates"
    a.attachments.ard.staffName = "Sam Staff"
    a.attachments.ard.staffEmail = "sam@example.test"
    expect(validateStep("ard", a, ON)).toEqual({})
  })

  it("section 2 needs officer details only when an organization is named", () => {
    const person = answers(ard({ section: "cannotDesignate" }))
    expect(validateStep("ard", person, ON)).toEqual({})
    const org = answers(ard({ section: "cannotDesignate", orgName: "Example Advocates" }))
    expect(Object.keys(validateStep("ard", org, ON)).sort()).toEqual([
      "attachments.ard.officerName",
      "attachments.ard.officerTitle",
    ])
  })

  it("section 3 needs a description of the legal document", () => {
    const a = answers(ard({ section: "appointedByLaw" }))
    expect(validateStep("ard", a, ON)).toEqual({ "attachments.ard.legalDocument": "This question is required." })
    a.attachments.ard.legalDocument = "Guardianship order, Suffolk Probate Court"
    expect(validateStep("ard", a, ON)).toEqual({})
  })

  it("ignores answers belonging to a section that is no longer selected", () => {
    const a = answers(ard({ section: "appointedByLaw", legalDocument: "Order", repKind: "organization", orgName: "", staffName: "", staffEmail: "" }))
    expect(validateStep("ard", a, ON)).toEqual({})
  })

  it("validates formats", () => {
    const a = answers(ard({ section: "applicantDesignates", repKind: "person", repZip: "12", repState: "Massachusetts", repEmail: "nope", repPhone: "555" }))
    expect(Object.keys(validateStep("ard", a, ON)).sort()).toEqual([
      "attachments.ard.repEmail",
      "attachments.ard.repPhone",
      "attachments.ard.repState",
      "attachments.ard.repZip",
    ])
  })
})

describe("irs4506 step", () => {
  const withSsn = (a: Saca2Answers) => {
    a.persons[0].hasSsn = "yes"
    a.persons[0].ssn = "123-45-6789"
  }

  it("requires the joint-return answer, and at least one period", () => {
    expect(validateStep("irs4506", answers(withSsn), ON)).toEqual({
      "attachments.irs4506.jointReturn": "This question is required.",
      "attachments.irs4506.yearsRequested": "Add at least one.",
    })
  })

  it("is complete with a joint answer and a requested period", () => {
    const a = answers((x) => {
      withSsn(x)
      x.attachments.irs4506.jointReturn = "no"
      x.attachments.irs4506.yearsRequested = [{ periodEnd: "2025-12-31" }]
    })
    expect(validateStep("irs4506", a, ON)).toEqual({})
  })

  it("requires each period end date", () => {
    const a = answers((x) => {
      withSsn(x)
      x.attachments.irs4506.jointReturn = "yes"
      x.attachments.irs4506.yearsRequested = [{ periodEnd: null }]
    })
    expect(validateStep("irs4506", a, ON)).toEqual({ "attachments.irs4506.yearsRequested.0.periodEnd": "This question is required." })
  })

  it("asks for a taxpayer ID only when Person 1 has no SSN", () => {
    const base = (x: Saca2Answers) => {
      x.attachments.irs4506.jointReturn = "no"
      x.attachments.irs4506.yearsRequested = [{ periodEnd: "2025-12-31" }]
    }
    const none = answers((x) => {
      x.persons[0].hasSsn = "no"
      base(x)
    })
    expect(validateStep("irs4506", none, ON)).toEqual({ "attachments.irs4506.taxpayerId": "This question is required." })
    none.attachments.irs4506.taxpayerId = "900-70-1234"
    expect(validateStep("irs4506", none, ON)).toEqual({})
    const has = answers((x) => {
      withSsn(x)
      base(x)
    })
    expect(validateStep("irs4506", has, ON)).toEqual({})
  })

  it("requires the form number", () => {
    const a = answers((x) => {
      withSsn(x)
      x.attachments.irs4506.jointReturn = "no"
      x.attachments.irs4506.formNumber = ""
      x.attachments.irs4506.yearsRequested = [{ periodEnd: "2025-12-31" }]
    })
    expect(validateStep("irs4506", a, ON)).toEqual({ "attachments.irs4506.formNumber": "This question is required." })
  })
})
```

In `questions-content.test.ts` make the `withContent` array the final list of all 17 steps: `["additionalCoverage", "aian", "ard", "assets", "healthInsurance", "hra", "intake", "irs4506", "pca", "person1", "person2", "previousBills", "signature", "suppA", "suppB", "suppC", "suppD"]`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-attachments.test.ts`
Expected: FAIL — neither step has content.

- [ ] **Step 3: Write the module**

Create `lib/masshealth/saca2/questions/attachments.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { date, email, opts, phone, repeater, select, text, yesNo } from "./builders"
import type { Saca2QuestionContext, Saca2Section, Saca2StepContent } from "./types"
import { validateStateCode, validateZip } from "./validators"

const ard = (ctx: Saca2QuestionContext) => ctx.answers.attachments.ard
const sectionChosen = (ctx: Saca2QuestionContext) => ard(ctx).section !== null
const isOrganizationDesignation = (ctx: Saca2QuestionContext) =>
  ard(ctx).section === "applicantDesignates" && ard(ctx).repKind === "organization"
const section2NamesOrganization = (ctx: Saca2QuestionContext) =>
  ard(ctx).section === "cannotDesignate" && ard(ctx).orgName.trim() !== ""

const REPRESENTATIVE_SECTION: Saca2Section = {
  id: "representative",
  title: "Authorized representative",
  description:
    "An authorized representative can act on the applicant's behalf in all matters with MassHealth and the Health Connector until the designation ends. The applicant's own name, date of birth, and contact details are taken from your answers earlier in this application.",
  questions: [
    select(
      "attachments.ard.section",
      "How is the authorized representative being designated?",
      opts([
        ["applicantDesignates", "Section 1: the applicant designates the representative in writing"],
        ["cannotDesignate", "Section 2: the applicant cannot designate in writing (a person who will act responsibly on their behalf)"],
        ["appointedByLaw", "Section 3: the representative was appointed by law (guardian, conservator, power of attorney, health care proxy, or estate representative)"],
      ]),
      { required: true },
    ),
    select(
      "attachments.ard.repKind",
      "Is the representative a person or an organization?",
      opts([
        ["person", "A person"],
        ["organization", "An organization"],
      ]),
      { required: true, visibleWhen: (ctx) => ard(ctx).section === "applicantDesignates" },
    ),
    text("attachments.ard.repName", "Authorized representative's name", { required: true, visibleWhen: sectionChosen }),
    phone("attachments.ard.repPhone", "Authorized representative's phone number", { required: true, visibleWhen: sectionChosen }),
    text("attachments.ard.repStreet", "Street address", { required: true, visibleWhen: sectionChosen }),
    text("attachments.ard.repCity", "City", { required: true, visibleWhen: sectionChosen }),
    text("attachments.ard.repState", "State", { visibleWhen: sectionChosen, validate: validateStateCode }),
    text("attachments.ard.repZip", "ZIP code", { required: true, visibleWhen: sectionChosen, validate: validateZip }),
    email("attachments.ard.repEmail", "Authorized representative's email address", { visibleWhen: sectionChosen }),
    text("attachments.ard.orgName", "Organization name (if the representative is acting for an organization)", {
      required: isOrganizationDesignation,
      visibleWhen: (ctx) => isOrganizationDesignation(ctx) || ard(ctx).section === "cannotDesignate",
    }),
    text("attachments.ard.staffName", "Printed name of the provider, staff member, or volunteer completing the form", {
      required: true,
      visibleWhen: isOrganizationDesignation,
    }),
    email("attachments.ard.staffEmail", "Email of the provider, staff member, or volunteer completing the form", {
      required: true,
      visibleWhen: isOrganizationDesignation,
    }),
    text("attachments.ard.officerName", "Name of the officer who signs for the organization", { required: true, visibleWhen: section2NamesOrganization }),
    text("attachments.ard.officerTitle", "Officer's title", { required: true, visibleWhen: section2NamesOrganization }),
    text("attachments.ard.legalDocument", "Legal document that gives this person authority (for example guardianship order, power of attorney, health care proxy, or estate appointment)", {
      required: true,
      visibleWhen: (ctx) => ard(ctx).section === "appointedByLaw",
      help: "Send a copy of the applicable legal document with this form.",
    }),
  ],
}

export const ARD_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [REPRESENTATIVE_SECTION],
}

const noSsnOnFile = (ctx: Saca2QuestionContext) => ctx.answers.persons[0]?.hasSsn !== "yes"

export const IRS4506_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "irs4506",
      title: "Request for copy of tax return (IRS Form 4506)",
      description:
        "Use this if you did not keep copies of the tax returns you filed. We fill in your name, address, and Social Security number from your earlier answers. The IRS may take up to 75 calendar days to respond, and there is a fee for each return.",
      questions: [
        yesNo("attachments.irs4506.jointReturn", "Was the return filed jointly with your spouse?", { required: true }),
        text("attachments.irs4506.taxpayerId", "Taxpayer identification number (ITIN)", {
          required: true,
          visibleWhen: noSsnOnFile,
          help: "Needed because no Social Security number was entered for Person 1.",
        }),
        text("attachments.irs4506.previousAddress", "Previous address shown on the last return filed, if different from your current address"),
        text("attachments.irs4506.formNumber", "Tax form number", { required: true, help: "Individual returns are Form 1040." }),
        repeater(
          "attachments.irs4506.yearsRequested",
          "Years or periods requested",
          {
            questions: [date("periodEnd", "Ending date of the tax year or period (mm/dd/yyyy)", { required: true })],
            emptyItem: () => ({ periodEnd: null }),
            addLabel: "Add a year",
            itemTitle: "Year",
            maxItems: 4,
          },
          { required: true },
        ),
      ],
    },
  ],
}
```

In `lib/masshealth/saca2/questions/index.ts` import `ARD_STEP_CONTENT, IRS4506_STEP_CONTENT` from `./attachments` and add `ard: ARD_STEP_CONTENT,` and `irs4506: IRS4506_STEP_CONTENT,` to `CONTENT`.

- [ ] **Step 4: Run the tests, type check, and lint**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`
Expected: PASS. The registry test "ids are unique" guards against a duplicated path.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/attachments.ts lib/masshealth/saca2/questions/index.ts lib/masshealth/saca2/__tests__/questions-attachments.test.ts lib/masshealth/saca2/__tests__/questions-content.test.ts
git commit -m "feat(saca2): add ARD-1122 and IRS 4506 attachment questions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Fixtures covering every step, flow checks, and docs

**Files:**
- Modify: `lib/masshealth/saca2/__tests__/complete-answers.ts`
- Modify: `lib/masshealth/saca2/__tests__/complete-flow.test.ts`
- Modify: `docs/superpowers/specs/2026-10-13-saca2-application-design.md`

**Interfaces:**
- Consumes: all content modules; the Task 7 `plan 2b-1` fixtures `completeSingleSenior`, `completeFacilityCouple`.
- Produces: `completeFacilityCouple()` extended with Supplement A (nursing facility, spouse at home, a transfer, home and relatives, no LTC insurance, tax returns with copies) and ARD data; a new `completeHomeWithAllSupplements()` for a 76-year-old at home with an HCBS Waiver, an AI/AN household member (B), a qualifying PCA chain (C), an employer-offered job (D), tax returns without copies (IRS 4506), and an authorized-representative signer (ARD). Together the three fixtures exercise every step except `additionalCoverage` (a mixed-age couple; already covered by its own tests).

- [ ] **Step 1: Extend the fixtures**

In `lib/masshealth/saca2/__tests__/complete-answers.ts`:

1. In `completeFacilityCouple()`, before `return a`, add:

```ts
  // Supplement A: nursing-facility applicant with a spouse at home.
  const sa = a.supplements.a
  sa.needsNursingFacility = "yes"
  sa.applyingHcbsWaiver = "no"
  sa.applyingPace = "no"
  sa.facility = {
    name: "Example Nursing Home",
    address: "5 Elm St, Testville MA",
    admissionDate: "2026-09-01",
    placedByOtherState: "no",
    placedFromState: "",
    paysGuardianshipExpenses: "no",
  }
  sa.spouseMonthlyExpenses = {
    rent: null,
    mortgage: 1500,
    homeownersInsurance: 120,
    realEstateTaxes: 400,
    condoOrCoopFee: null,
    assistedLivingRoomAndBoard: null,
    paysHeat: "yes",
    paysUtilities: "yes",
  }
  sa.familyAtHome = { hasFamily: "no", members: [] }
  sa.transferAnswers = {
    trust: "no",
    income: "no",
    assets: "yes",
    deed: "no",
    lifeEstateLivedOneYear: null,
    addedToDeed: "no",
    loanOrNote: "no",
    annuity: "no",
  }
  a.transfers = [{ description: "Cash gift", dateOfTransfer: "2024-03-15", transferredTo: "Test Child", relationship: "child", amount: 30000 }]
  sa.facilityDeposit.gaveDeposit = "no"
  sa.home.ownsHome = "yes"
  sa.home.properties = [{ ownerNames: "Walter Testcase", propertyAddress: "1 Example St, Testville MA", ownershipType: "individual", fairMarketValue: 450000 }]
  for (const key of ["spouse", "disabledChild", "childUnder21", "sibling", "caregiverChild", "dependentRelative"] as const) {
    sa.home[key].has = "no"
  }
  sa.intendsToReturnHome = "no"
  sa.home.ownsOtherRealEstate = "yes"
  sa.home.otherRealEstateDescription = "9 Cape Rd, Testville MA"
  sa.longTermCareInsurance.hasPolicy = "no"
  sa.taxReturnsFiled = "bothYears"
  sa.hasCopiesOfTaxReturns = "yes"

  // ARD: the signer is an authorized representative.
  a.attachments.ard = {
    ...a.attachments.ard,
    section: "applicantDesignates",
    repKind: "person",
    repName: "Quinn Rep",
    repPhone: "6175550101",
    repStreet: "3 Example St",
    repCity: "Testville",
    repState: "MA",
    repZip: "02101",
  }
```

2. Add this new exported fixture at the end of the file:

```ts
/** A 76-year-old at home with an HCBS Waiver who triggers Supplements A–D, the ARD, and the IRS 4506. */
export function completeHomeWithAllSupplements(): Saca2Answers {
  const a = completeSingleSenior()
  a.intake.programs.hcbsWaiver = true
  a.aian.anyMember = "yes"

  // Step 6: a job offers coverage (Supplement D).
  a.health.employerOfferedCoverage = "yes"

  // Step 8: the PCA chain qualifies Person 1 (Supplement C).
  a.pca.needsPca = "yes"
  a.pca.paidByMassHealthLastSixMonths = "no"
  a.pca.byPerson[0] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }

  a.signature.signedBy = "authorizedRepresentative"

  // Supplement A: HCBS Waiver (no nursing facility, so no facility or spouse sections).
  const sa = a.supplements.a
  sa.needsNursingFacility = "no"
  sa.applyingHcbsWaiver = "yes"
  sa.applyingPace = "no"
  sa.transferAnswers = {
    trust: "no",
    income: "no",
    assets: "no",
    deed: "no",
    lifeEstateLivedOneYear: null,
    addedToDeed: "no",
    loanOrNote: "no",
    annuity: "no",
  }
  sa.facilityDeposit.gaveDeposit = "no"
  sa.home.ownsHome = "no"
  sa.home.ownsOtherRealEstate = "no"
  sa.longTermCareInsurance.hasPolicy = "no"
  sa.taxReturnsFiled = "oneYear"
  sa.hasCopiesOfTaxReturns = "no"

  // Supplement B.
  a.supplements.b.members = [
    {
      name: "Edna Testcase",
      federallyRecognizedTribe: "yes",
      tribeName: "Example Tribe",
      massRecognizedTribe: "no",
      massTribeName: "",
      receivedIhsService: "yes",
      eligibleForIhs: null,
      excludedIncomeAmount: null,
      excludedIncomeFrequency: null,
    },
  ]

  // Supplement C for Person 1.
  const c = a.supplements.c[0]
  c.healthProblems = ["Arthritis", "", ""]
  for (const key of ["mobility", "medications", "bathing", "dressing", "rangeOfMotion", "eating", "toileting"] as const) {
    c.activities[key] = { needsHandsOnHelp: "no", timesPerDay: null, daysPerWeek: null }
  }
  c.activities.bathing = { needsHandsOnHelp: "yes", timesPerDay: 1, daysPerWeek: 7 }
  c.caregivers = [{ name: "Test Child", relationship: "daughter" }]

  // Supplement D.
  a.supplements.d.jobs = [
    {
      employeeName: "Edna Testcase",
      employeeSsn: "",
      eligibleWithinThreeMonths: "yes",
      waitingPeriodEnds: null,
      employerName: "Acme",
      employerFederalTaxId: "",
      employerAddress: "9 Work Rd",
      employerCity: "Testville",
      employerState: "MA",
      employerZip: "02101",
      employerPhone: "6175550100",
      contactName: "HR",
      contactPhone: "",
      contactEmail: "",
      individualPlanName: "Gold Individual",
      individualMeetsMinimumValue: "yes",
      individualPremium: 120,
      individualPremiumFrequency: "monthly",
      familyPlanName: "",
      familyMeetsMinimumValue: null,
      familyPremium: null,
      familyPremiumFrequency: null,
      upcomingChange: "none",
      changeEndDate: null,
      changePremium: null,
      changePremiumFrequency: null,
      changeDate: null,
    },
  ]

  // ARD and IRS 4506.
  a.attachments.ard = {
    ...a.attachments.ard,
    section: "applicantDesignates",
    repKind: "person",
    repName: "Quinn Rep",
    repPhone: "6175550101",
    repStreet: "3 Example St",
    repCity: "Testville",
    repState: "MA",
    repZip: "02101",
  }
  a.persons[0].hasSsn = "yes"
  a.persons[0].ssn = "123-45-6789"
  a.attachments.irs4506.jointReturn = "no"
  a.attachments.irs4506.yearsRequested = [{ periodEnd: "2025-12-31" }]
  return a
}
```

- [ ] **Step 2: Update the flow test**

In `lib/masshealth/saca2/__tests__/complete-flow.test.ts`:

1. Import `completeHomeWithAllSupplements` alongside the other fixtures.
2. In the nursing-facility-couple test change the expected steps to end `…, "hra", "signature", "suppA", "ard"]` (the couple signs through an authorized representative, so the ARD appears; tax returns were filed with copies, so no IRS 4506).
3. Add:

```ts
  it("a home applicant who triggers every supplement sees all of them and every step validates clean", () => {
    const a = completeHomeWithAllSupplements()
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
      "suppA",
      "suppB",
      "suppC",
      "suppD",
      "ard",
      "irs4506",
    ])
    for (const step of steps) {
      expect(validateStep(step, a, ON), step).toEqual({})
    }
  })

  it("every step except additionalCoverage is exercised by at least one fixture", () => {
    const seen = new Set<string>()
    for (const fixture of [completeSingleSenior(), completeFacilityCouple(), completeHomeWithAllSupplements()]) {
      for (const step of getWizardSteps(fixture, ON)) seen.add(step)
    }
    expect([...seen].sort()).toEqual(
      ["aian", "ard", "assets", "healthInsurance", "hra", "intake", "irs4506", "pca", "person1", "person2", "previousBills", "signature", "suppA", "suppB", "suppC", "suppD"].sort(),
    )
  })

  it("dropping a required supplement answer is caught by the right step", () => {
    const missingTransfer = completeHomeWithAllSupplements()
    missingTransfer.supplements.a.transferAnswers.trust = null
    expect(validateStep("suppA", missingTransfer, ON)).toEqual({
      "supplements.a.transferAnswers.trust": "This question is required.",
    })

    const missingJob = completeHomeWithAllSupplements()
    missingJob.supplements.d.jobs = []
    expect(validateStep("suppD", missingJob, ON)).toEqual({ "supplements.d.jobs": "Add at least one." })

    const missingYears = completeHomeWithAllSupplements()
    missingYears.attachments.irs4506.yearsRequested = []
    expect(validateStep("irs4506", missingYears, ON)).toEqual({ "attachments.irs4506.yearsRequested": "Add at least one." })
  })
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run lib/masshealth/saca2 components/application/saca2 app/application/new`
Expected: PASS. If a fixture fails a step, the step name appears in the assertion message: fix the fixture (it must stay a complete, realistic submission) — never loosen validation. If a fixture reveals a real content bug (a required question that cannot be answered, or an unexpectedly hidden step), do not paper over it: stop and report it.

- [ ] **Step 4: Full verification**

Run:

```bash
npx vitest run && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2 components/application lib/phi-token lib/db app/application app/api/config
```

Expected: every test file passes, no type errors, no lint errors. (If a handful of unrelated admin/identity/PHI-dialog tests time out while the machine is loaded, re-run those files alone and the whole suite once more before reporting; they are load-sensitive.)

- [ ] **Step 5: Update the spec**

In `docs/superpowers/specs/2026-10-13-saca2-application-design.md` §6, in the Phase 1 row, change `**1b-2** (Supplements A–D and the ARD-1122 / IRS 4506 attachment data)` to `**1b-2** (plan `2026-10-14-saca2-supplements.md`: Supplements A–D and the ARD-1122 / IRS 4506 attachment data — done once merged)`.

Run: `grep -n "2026-10-14-saca2-supplements" docs/superpowers/specs/2026-10-13-saca2-application-design.md`
Expected: the new line appears.

- [ ] **Step 6: Commit**

```bash
git add lib/masshealth/saca2/__tests__/complete-answers.ts lib/masshealth/saca2/__tests__/complete-flow.test.ts docs/superpowers/specs/2026-10-13-saca2-application-design.md
git commit -m "test(saca2): cover every supplement and attachment step with complete fixtures" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## What comes next (not part of this plan)

- **2b-3:** the remaining Person-block questions (optional demographics, tax/Health Connector, accommodations, pregnancy and foster care, deductions, rental/one-time/seasonal/self-employment income), then the pre-flag gate items from the earlier final reviews.
- **Plan 3:** the PDF field map and fill route, using these answers and the complete fixtures.
