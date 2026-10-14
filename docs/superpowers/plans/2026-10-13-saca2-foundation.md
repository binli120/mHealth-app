# SACA-2 Foundation (Phase 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the pure, tested foundation for SACA-2 (answer types, 2026 figures with a staleness guard, step visibility rules, synthetic cases) and stop SACA-2 drafts from silently opening the ACA-3 wizard.

**Architecture:** New pure modules under `lib/masshealth/saca2/` (no React, no I/O) plus one small guard in `app/application/new/page.tsx` that renders an "online SACA-2 not available yet" notice for SACA-2 drafts. ACA-3 code paths are untouched when the application type is not `saca2`.

**Tech Stack:** TypeScript, Vitest (jsdom env, `@/` alias), React Testing Library, Next.js App Router, Redux Toolkit.

**Spec:** `docs/superpowers/specs/2026-10-13-saca2-application-design.md`

## Why this is plan 1 of several

The spec (7 phases) is too large for one plan, and later phases depend on interfaces this plan creates. Plans are written in order, each after the previous one ships:

| Plan | Spec phase | Content | Status |
|---|---|---|---|
| **1 (this file)** | 0 | types, figures, step visibility, synthetic cases, dead-end guard | ready |
| 2 | 1 | question-level schema, `Saca2Wizard`, step renderer, `/application/new` dispatch, PHI-safe draft save/resume, feature flag | after plan 1 |
| 3 | 2 | field inventory, field map, `pdf-fill`, `/api/forms/saca2/fill` | after plan 2 |
| 4 | 3 | eligibility engine, document checklist, redirects, results panel | after plan 2 |
| 5 | 4–6 | i18n, chat intake driver, touchpoints, e2e, rollout | after 3 and 4 |

**Deviations from the spec's Phase 0 (decided while grounding the plan in code):**
1. **Question-level `schema.ts` moves to plan 2.** Question types are driven by what the step renderer needs, so they are authored together. Plan 1 ships only the *step* registry (`schema.ts`) that `visibility.ts` needs.
2. **Feature flag moves to plan 2.** `public.feature_flags` exists in the DB but nothing in app code reads it, and there is no wizard to gate yet. Plan 1 instead makes the existing-draft case safe unconditionally (Task 6).
3. **Spec open item 1 is resolved:** owner / social-worker authorization is `getApplicationDraft(userId, applicationId, actingFor)` in `lib/db/application-drafts.ts` (the `X-Acting-For-Patient` header path), already used by `GET /api/applications/[applicationId]/draft`. Plan 3 reuses it.

## Global Constraints

- Source of truth for figures: spec §3.2, copied verbatim into Task 1 (2026 values; PNA `$72.80`; home equity `$1,130,000`; asset limits `$2,000` individual / `$3,000` couple; FBR×300% `$2,982`; community-spouse resource `$32,532`–`$162,660`; MMMNA max `$4,066.50` and min `$2,705.00` (eff. 7/1/2026); standard shelter `$811.50` (eff. 7/1/2026); SNAP utility `$945.00` heat / `$575.00` no heat (eff. 10/1/2026); nursing-facility daily cost `$450`; Part B `$202.90`; look-back `60` months).
- SACA-2 form version string stored everywhere is the PDF footer value: `"SACA-2_2026-08"`; draft schema version is `"saca2-2026-08"`.
- Eligibility output must never use `APPROVED`; screening estimates only (applies to plan 4, but figures/types here must not introduce an approval status).
- PHI never goes in server `draft_state` (plan 2 enforces; types here tag PHI-bearing top-level keys in `SACA2_PHI_KEYS`).
- Code style of the repo: 2-space indent, no semicolons, double quotes, `@author: Bin Lee / @email: blee@comura.ai` header comment, tests in `__tests__/` next to the module, imports via `@/`.
- ACA-3 behaviour must not change for non-`saca2` applications.
- Run commands from `/Users/blee/dev/masshealth-repo/mHealth-app`.

## Review Focus

Inputs/conditions the spec implies that a user is most likely to hit, each pinned by a test in the owning task:
1. **Birthday boundary at 65.** Someone turning 65 on the reference date must count as 65 (`calculateAge`); Feb 29 birthdays must not crash. → Task 2.
2. **Missing / malformed DOB** (`null`, `""`, `"not-a-date"`) must yield `null` age and *hide* age-gated steps rather than throw. → Task 2, Task 4.
3. **Unanswered yes/no (`null`)** must never be treated as "yes" by visibility rules (e.g. Supplement A must not appear because a field is `null`). → Task 4.
4. **Person 2 absent** (single applicant) must not crash visibility or show Person 2 / Step 9. → Task 4.
5. **Existing saca2 draft after a page reload** (Redux is not persisted, so the type is unknown client-side) must still show the notice, not the ACA-3 wizard. → Task 6.

---

### Task 1: 2026 eligibility figures with staleness guard

**Files:**
- Create: `lib/masshealth/saca2/figures-2026.ts`
- Test: `lib/masshealth/saca2/__tests__/figures-2026.test.ts`

**Interfaces:**
- Produces:
  - `SACA2_FIGURES_YEAR: 2026`
  - `SACA2_FIGURES: Saca2Figures` (readonly constant object)
  - `getFplRow(familySize: number): FplRow` — `FplRow = { size: number; massHealthStandard: Money; fpl100: Money; fpl133: Money; fpl150: Money; fpl200: Money; fpl250: Money; fpl300: Money; fpl400: Money }` (the 190% and 225% columns in the source PDF are intentionally omitted: the source leaves them blank for sizes 3+ and no SACA-2 rule uses them), `Money = { monthly: number; yearly: number }`; sizes 1–8 are table rows, sizes >8 are row 8 plus per-additional-person increments.
  - `getEffectiveFigure<T>(entries: readonly EffectiveValue<T>[], on: Date): T` — picks the latest entry whose `effective` date is `<= on`.
  - `type EffectiveValue<T> = { effective: string; value: T }` (`effective` is ISO `YYYY-MM-DD`)

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/figures-2026.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import {
  SACA2_FIGURES,
  SACA2_FIGURES_YEAR,
  getEffectiveFigure,
  getFplRow,
} from "@/lib/masshealth/saca2/figures-2026"

describe("SACA2_FIGURES (2026)", () => {
  it("matches the published mass.gov values", () => {
    expect(SACA2_FIGURES.assetLimit.individual).toBe(2000)
    expect(SACA2_FIGURES.assetLimit.marriedCoupleMember).toBe(3000)
    expect(SACA2_FIGURES.federalBenefitRate300Monthly).toBe(2982)
    expect(SACA2_FIGURES.personalNeedsAllowance).toBe(72.8)
    expect(SACA2_FIGURES.maxHomeEquity).toBe(1_130_000)
    expect(SACA2_FIGURES.communitySpouseResource).toEqual({ min: 32_532, max: 162_660 })
    expect(SACA2_FIGURES.mmmnaMax).toBe(4066.5)
    expect(SACA2_FIGURES.nursingFacilityDailyCost).toBe(450)
    expect(SACA2_FIGURES.medicarePartBPremiumMonthly).toBe(202.9)
    expect(SACA2_FIGURES.lookBackMonths).toBe(60)
  })

  it("resolves mid-year effective-dated figures", () => {
    const { mmmnaMin, standardShelterExpense, snapUtility } = SACA2_FIGURES
    expect(getEffectiveFigure(mmmnaMin, new Date("2026-06-30"))).toBe(2643.75)
    expect(getEffectiveFigure(mmmnaMin, new Date("2026-07-01"))).toBe(2705)
    expect(getEffectiveFigure(standardShelterExpense, new Date("2026-07-01"))).toBe(811.5)
    expect(getEffectiveFigure(standardShelterExpense, new Date("2026-06-30"))).toBe(793.13)
    expect(getEffectiveFigure(snapUtility.heat, new Date("2026-10-01"))).toBe(945)
    expect(getEffectiveFigure(snapUtility.noHeat, new Date("2026-10-01"))).toBe(575)
    expect(getEffectiveFigure(snapUtility.heat, new Date("2026-09-30"))).toBe(914)
  })

  it("throws when asked for a date before the earliest entry", () => {
    expect(() => getEffectiveFigure(SACA2_FIGURES.mmmnaMin, new Date("2020-01-01"))).toThrow(
      /no figure effective/i,
    )
  })
})

describe("getFplRow", () => {
  it("returns table rows for sizes 1-8", () => {
    const one = getFplRow(1)
    expect(one.massHealthStandard).toEqual({ monthly: 522, yearly: 6264 })
    expect(one.fpl100).toEqual({ monthly: 1330, yearly: 15960 })
    expect(one.fpl133).toEqual({ monthly: 1769, yearly: 21228 })
    expect(one.fpl300).toEqual({ monthly: 3990, yearly: 47880 })
    const two = getFplRow(2)
    expect(two.fpl100).toEqual({ monthly: 1804, yearly: 21648 })
    expect(getFplRow(8).fpl100).toEqual({ monthly: 4644, yearly: 55728 })
  })

  it("extrapolates beyond 8 using the per-additional-person increment", () => {
    // 100% FPL: size 8 = 55,728 yearly; +5,688 per additional person.
    expect(getFplRow(9).fpl100.yearly).toBe(55_728 + 5_688)
    expect(getFplRow(10).fpl100.yearly).toBe(55_728 + 2 * 5_688)
  })

  it("rejects non-positive or non-integer sizes", () => {
    expect(() => getFplRow(0)).toThrow(/family size/i)
    expect(() => getFplRow(-1)).toThrow(/family size/i)
    expect(() => getFplRow(2.5)).toThrow(/family size/i)
  })
})

describe("staleness guard", () => {
  it("fails once the calendar year passes the figures year", () => {
    // MassHealth republishes these every January. When this test fails, update
    // figures-2026.ts from
    // https://www.mass.gov/info-details/program-financial-guidelines-for-certain-masshealth-applicants-and-members
    // and rename/re-year the module.
    expect(new Date().getFullYear()).toBeLessThanOrEqual(SACA2_FIGURES_YEAR)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/figures-2026.test.ts`
Expected: FAIL — cannot resolve `@/lib/masshealth/saca2/figures-2026`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/masshealth/saca2/figures-2026.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * 2026 MassHealth figures used to screen SACA-2 (seniors / long-term care).
 *
 * Sources (retrieved 2026-10-13):
 * - https://www.mass.gov/info-details/program-financial-guidelines-for-certain-masshealth-applicants-and-members
 *   (last updated Oct 1, 2026)
 * - "2026 MassHealth Income Standards and Federal Poverty Guidelines" (DG-FPL_2026-03,
 *   effective March 1, 2026)
 *
 * Changing these changes screening outcomes — update only from the sources above.
 */

export const SACA2_FIGURES_YEAR = 2026

export interface EffectiveValue<T> {
  /** ISO date (YYYY-MM-DD) the value takes effect. */
  effective: string
  value: T
}

export interface Money {
  monthly: number
  yearly: number
}

export interface FplRow {
  size: number
  massHealthStandard: Money
  fpl100: Money
  fpl133: Money
  fpl150: Money
  fpl200: Money
  fpl250: Money
  fpl300: Money
  fpl400: Money
}

export const SACA2_FIGURES = {
  assetLimit: { individual: 2000, marriedCoupleMember: 3000 },
  /** Federal benefit rate x 300% (special income limit), per month. */
  federalBenefitRate300Monthly: 2982,
  /** Personal needs allowance / institutional income standard, per month. */
  personalNeedsAllowance: 72.8,
  maxHomeEquity: 1_130_000,
  communitySpouseResource: { min: 32_532, max: 162_660 },
  mmmnaMax: 4066.5,
  mmmnaMin: [
    { effective: "2025-07-01", value: 2643.75 },
    { effective: "2026-07-01", value: 2705 },
  ] as const satisfies readonly EffectiveValue<number>[],
  standardShelterExpense: [
    { effective: "2025-07-01", value: 793.13 },
    { effective: "2026-07-01", value: 811.5 },
  ] as const satisfies readonly EffectiveValue<number>[],
  snapUtility: {
    heat: [
      { effective: "2025-10-01", value: 914 },
      { effective: "2026-10-01", value: 945 },
    ] as const satisfies readonly EffectiveValue<number>[],
    noHeat: [
      { effective: "2025-10-01", value: 557 },
      { effective: "2026-10-01", value: 575 },
    ] as const satisfies readonly EffectiveValue<number>[],
  },
  /** Average daily cost of nursing-facility services (transfer-penalty divisor). */
  nursingFacilityDailyCost: 450,
  medicarePartBPremiumMonthly: 202.9,
  lookBackMonths: 60,
} as const

const m = (monthly: number, yearly: number): Money => ({ monthly, yearly })

// Effective March 1, 2026. Columns: standard, 100, 133, 150, 200, 250, 300, 400.
const FPL_ROWS: readonly FplRow[] = [
  { size: 1, massHealthStandard: m(522, 6264), fpl100: m(1330, 15960), fpl133: m(1769, 21228), fpl150: m(1995, 23940), fpl200: m(2660, 31920), fpl250: m(3325, 39900), fpl300: m(3990, 47880), fpl400: m(5320, 63840) },
  { size: 2, massHealthStandard: m(650, 7800), fpl100: m(1804, 21648), fpl133: m(2399, 28788), fpl150: m(2705, 32460), fpl200: m(3607, 43284), fpl250: m(4509, 54108), fpl300: m(5410, 64920), fpl400: m(7214, 86568) },
  { size: 3, massHealthStandard: m(775, 9300), fpl100: m(2277, 27324), fpl133: m(3028, 36336), fpl150: m(3415, 40980), fpl200: m(4554, 54648), fpl250: m(5692, 68304), fpl300: m(6830, 81960), fpl400: m(9107, 109284) },
  { size: 4, massHealthStandard: m(891, 10692), fpl100: m(2750, 33000), fpl133: m(3658, 43896), fpl150: m(4125, 49500), fpl200: m(5500, 66000), fpl250: m(6875, 82500), fpl300: m(8250, 99000), fpl400: m(11000, 132000) },
  { size: 5, massHealthStandard: m(1016, 12192), fpl100: m(3224, 38688), fpl133: m(4288, 51456), fpl150: m(4835, 58020), fpl200: m(6447, 77364), fpl250: m(8059, 96708), fpl300: m(9670, 116040), fpl400: m(12894, 154728) },
  { size: 6, massHealthStandard: m(1141, 13692), fpl100: m(3697, 44364), fpl133: m(4917, 59004), fpl150: m(5545, 66540), fpl200: m(7394, 88728), fpl250: m(9242, 110904), fpl300: m(11090, 133080), fpl400: m(14787, 177444) },
  { size: 7, massHealthStandard: m(1266, 15192), fpl100: m(4170, 50040), fpl133: m(5547, 66564), fpl150: m(6255, 75060), fpl200: m(8340, 100080), fpl250: m(10425, 125100), fpl300: m(12510, 150120), fpl400: m(16680, 200160) },
  { size: 8, massHealthStandard: m(1383, 16596), fpl100: m(4644, 55728), fpl133: m(6176, 74112), fpl150: m(6965, 83580), fpl200: m(9287, 111444), fpl250: m(11609, 139308), fpl300: m(13930, 167160), fpl400: m(18574, 222888) },
]

/** "For each additional person, add" row from the source table. */
const FPL_PER_ADDITIONAL_PERSON: Omit<FplRow, "size"> = {
  massHealthStandard: m(133, 1596),
  fpl100: m(474, 5688),
  fpl133: m(630, 7560),
  fpl150: m(710, 8520),
  fpl200: m(947, 11364),
  fpl250: m(1184, 14208),
  fpl300: m(1420, 17040),
  fpl400: m(1894, 22728),
}

const MONEY_KEYS = [
  "massHealthStandard",
  "fpl100",
  "fpl133",
  "fpl150",
  "fpl200",
  "fpl250",
  "fpl300",
  "fpl400",
] as const

export function getFplRow(familySize: number): FplRow {
  if (!Number.isInteger(familySize) || familySize < 1) {
    throw new Error(`Invalid family size: ${familySize}`)
  }
  if (familySize <= FPL_ROWS.length) {
    return FPL_ROWS[familySize - 1]
  }
  const extra = familySize - FPL_ROWS.length
  const base = FPL_ROWS[FPL_ROWS.length - 1]
  const row: FplRow = { ...base, size: familySize }
  for (const key of MONEY_KEYS) {
    row[key] = {
      monthly: base[key].monthly + extra * FPL_PER_ADDITIONAL_PERSON[key].monthly,
      yearly: base[key].yearly + extra * FPL_PER_ADDITIONAL_PERSON[key].yearly,
    }
  }
  return row
}

export function getEffectiveFigure<T>(entries: readonly EffectiveValue<T>[], on: Date): T {
  const day = on.toISOString().slice(0, 10)
  let chosen: EffectiveValue<T> | undefined
  for (const entry of entries) {
    if (entry.effective <= day && (!chosen || entry.effective > chosen.effective)) {
      chosen = entry
    }
  }
  if (!chosen) {
    throw new Error(`No figure effective on ${day}`)
  }
  return chosen.value
}
```

Note on the "2025-07-01" entries: they are the "before 7/1/2026" values from the source page (`$2,643.75`, `$793.13`, `$914.00`, `$557.00`) so that lookups just before the 2026 changeover resolve correctly; they intentionally carry the prior year's effective date.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/masshealth/saca2/__tests__/figures-2026.test.ts`
Expected: PASS (all tests, including the staleness guard while the calendar year is 2026).

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/figures-2026.ts lib/masshealth/saca2/__tests__/figures-2026.test.ts
git commit -m "feat(saca2): add 2026 eligibility figures with staleness guard" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Age helper and SACA-2 answer types

**Files:**
- Create: `lib/masshealth/saca2/age.ts`
- Create: `lib/masshealth/saca2/types.ts`
- Test: `lib/masshealth/saca2/__tests__/age.test.ts`
- Test: `lib/masshealth/saca2/__tests__/types.test.ts`

**Interfaces:**
- Produces (`age.ts`): `calculateAge(dobIso: string | null | undefined, on: Date): number | null` — returns `null` for missing/invalid/future DOB.
- Produces (`types.ts`):
  - `type YesNo = "yes" | "no"`
  - `type IncomeFrequency = "weekly" | "every2weeks" | "twiceMonthly" | "monthly" | "quarterly" | "yearly" | "oneTime"`
  - `interface Saca2IncomeItem { kind: "wages" | "selfEmployment" | "socialSecurity" | "pension" | "annuity" | "trust" | "unemployment" | "investment" | "royalty" | "alimony" | "veterans" | "militaryRetirement" | "otherTaxable" | "rental" | "lottery"; amount: number | null; frequency: IncomeFrequency | null }`
  - `interface Saca2Person` (fields below)
  - `interface Saca2Answers` (fields below)
  - `SACA2_SCHEMA_VERSION = "saca2-2026-08"`, `SACA2_FORM_CODE = "SACA-2_2026-08"`
  - `SACA2_PHI_KEYS: readonly ["persons", "assets", "transfers", "supplements"]`
  - `emptySaca2Person(): Saca2Person`, `emptySaca2Answers(): Saca2Answers`

- [ ] **Step 1: Write the failing tests**

Create `lib/masshealth/saca2/__tests__/age.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { calculateAge } from "@/lib/masshealth/saca2/age"

const ON = new Date("2026-10-13T12:00:00Z")

describe("calculateAge", () => {
  it("counts a person turning 65 on the reference date as 65", () => {
    expect(calculateAge("1961-10-13", ON)).toBe(65)
  })

  it("counts a person turning 65 tomorrow as 64", () => {
    expect(calculateAge("1961-10-14", ON)).toBe(64)
  })

  it("handles Feb 29 birthdays without throwing", () => {
    expect(calculateAge("1960-02-29", new Date("2026-02-28T12:00:00Z"))).toBe(65)
    expect(calculateAge("1960-02-29", new Date("2026-03-01T12:00:00Z"))).toBe(66)
  })

  it("returns null for missing, empty, malformed, impossible, or future dates", () => {
    expect(calculateAge(null, ON)).toBeNull()
    expect(calculateAge(undefined, ON)).toBeNull()
    expect(calculateAge("", ON)).toBeNull()
    expect(calculateAge("not-a-date", ON)).toBeNull()
    expect(calculateAge("2026-02-30", ON)).toBeNull()
    expect(calculateAge("2027-01-01", ON)).toBeNull()
  })
})
```

Create `lib/masshealth/saca2/__tests__/types.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import {
  SACA2_FORM_CODE,
  SACA2_PHI_KEYS,
  SACA2_SCHEMA_VERSION,
  emptySaca2Answers,
  emptySaca2Person,
} from "@/lib/masshealth/saca2/types"

describe("emptySaca2Answers", () => {
  it("starts with exactly one blank person and every yes/no unanswered", () => {
    const a = emptySaca2Answers()
    expect(a.persons).toHaveLength(1)
    expect(a.persons[0]).toEqual(emptySaca2Person())
    expect(a.persons[0].dateOfBirth).toBeNull()
    expect(a.persons[0].isLegallyMarried).toBeNull()
    expect(a.supplementA.needsNursingFacility).toBeNull()
    expect(a.aian.anyMember).toBeNull()
    expect(a.signature.signedBy).toBeNull()
  })

  it("returns independent objects on every call", () => {
    const a = emptySaca2Answers()
    const b = emptySaca2Answers()
    a.persons[0].firstName = "Ada"
    a.transfers.push({
      description: "gift",
      dateOfTransfer: "2025-01-01",
      transferredTo: "child",
      relationship: "child",
      amount: 100,
    })
    expect(b.persons[0].firstName).toBe("")
    expect(b.transfers).toHaveLength(0)
  })
})

describe("constants", () => {
  it("pins version strings to the PDF footer / schema version", () => {
    expect(SACA2_FORM_CODE).toBe("SACA-2_2026-08")
    expect(SACA2_SCHEMA_VERSION).toBe("saca2-2026-08")
  })

  it("lists the PHI-bearing top-level keys", () => {
    expect([...SACA2_PHI_KEYS]).toEqual(["persons", "assets", "transfers", "supplements"])
    const keys = Object.keys(emptySaca2Answers())
    for (const phiKey of SACA2_PHI_KEYS) {
      expect(keys).toContain(phiKey)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/masshealth/saca2/__tests__/age.test.ts lib/masshealth/saca2/__tests__/types.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementations**

Create `lib/masshealth/saca2/age.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Whole-years age on `on`, from an ISO `YYYY-MM-DD` date of birth.
 * Returns null for missing, malformed, impossible, or future dates so callers
 * can treat age-gated rules as "unknown" instead of throwing.
 */
export function calculateAge(dobIso: string | null | undefined, on: Date): number | null {
  if (!dobIso) return null
  const match = ISO_DATE.exec(dobIso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const probe = new Date(Date.UTC(year, month - 1, day))
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null
  }

  const onYear = on.getUTCFullYear()
  const onMonth = on.getUTCMonth() + 1
  const onDay = on.getUTCDate()

  let age = onYear - year
  if (onMonth < month || (onMonth === month && onDay < day)) age -= 1
  return age < 0 ? null : age
}
```

Create `lib/masshealth/saca2/types.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/** Draft schema version stored with every SACA-2 draft. */
export const SACA2_SCHEMA_VERSION = "saca2-2026-08"
/** Form code exactly as printed in the PDF footer. */
export const SACA2_FORM_CODE = "SACA-2_2026-08"

/**
 * Top-level answer keys that contain PHI. These must travel only through the
 * client-encrypted resume token (lib/phi-token), never the server draft_state.
 */
export const SACA2_PHI_KEYS = ["persons", "assets", "transfers", "supplements"] as const

export type YesNo = "yes" | "no"

export type IncomeFrequency =
  | "weekly"
  | "every2weeks"
  | "twiceMonthly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "oneTime"

export interface Saca2IncomeItem {
  kind:
    | "wages"
    | "selfEmployment"
    | "socialSecurity"
    | "pension"
    | "annuity"
    | "trust"
    | "unemployment"
    | "investment"
    | "royalty"
    | "alimony"
    | "veterans"
    | "militaryRetirement"
    | "otherTaxable"
    | "rental"
    | "lottery"
  amount: number | null
  frequency: IncomeFrequency | null
}

/** One person block (Step 1 = Person 1, Step 2 = Person 2). Plan 2 extends this. */
export interface Saca2Person {
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  /** ISO YYYY-MM-DD. */
  dateOfBirth: string | null
  relationshipToPerson1: string
  applyingForCoverage: YesNo | null
  /** Q9 / Person 2 Q6: hospital, nursing facility, or other institution. */
  inInstitution: YesNo | null
  isLegallyMarried: YesNo | null
  livesWithPerson1: YesNo | null
  /** Residency question (Person 1 Q14 / Person 2 Q24). */
  residentOfMassachusetts: YesNo | null
  /** "Do you live with a child under 19 and are you the main caregiver?" */
  caregiverOfChildUnder19: YesNo | null
  usCitizenOrNational: YesNo | null
  /** Value from the page-32 eligible immigration status list, when a noncitizen. */
  immigrationStatus: string | null
  hasMedicareOrSsiOrSsdi: YesNo | null
  income: Saca2IncomeItem[]
}

export type AssetCategory =
  | "bankAccounts"
  | "primaryResidence"
  | "otherRealEstate"
  | "lifeInsurance"
  | "securities"
  | "annuities"
  | "assistedLivingDeposit"
  | "vehicles"
  | "burial"
  | "trusts"

export interface BankAccountRow {
  ownerName: string
  accountType: string
  institution: string
  accountNumber: string
  currentBalance: number | null
  balanceOnAdmissionDate: number | null
  open: boolean
  closedOn: string | null
  balanceWhenClosed: number | null
}

export interface RealEstateRow {
  address: string
  propertyType: string
  currentValue: number | null
}

export interface LifeInsuranceRow {
  owners: string
  company: string
  policyNumber: string
  faceValue: number | null
  insuranceType: string
  cashSurrenderValue: number | null
}

export interface SecuritiesRow {
  kind: "cash" | "stocks" | "bonds" | "savingsBonds" | "mutualFunds" | "options" | "futures" | "other"
  owners: string
  company: string
  accountNumber: string
  currentValue: number | null
  valueOnAdmissionDate: number | null
  joint: boolean
}

export interface AnnuityRow {
  owners: string
  institution: string
  contractNumber: string
  purchasedOn: string | null
}

export interface FacilityDepositRow {
  facilityName: string
  facilityAddress: string
  amount: number | null
  depositedOn: string | null
}

export interface VehicleRow {
  owner: "you" | "spouse"
  vehicleType: string
  yearMakeModel: string
  fairMarketValue: number | null
  amountOwed: number | null
}

export interface BurialRow {
  owner: "you" | "spouse"
  kind: "contract" | "trust" | "lifeInsurance" | "burialOnlyAccount" | "plot"
  amount: number | null
}

export interface TrustRow {
  name: string
  revocable: boolean | null
  currentPrincipal: number | null
  principalOnAdmissionDate: number | null
  trustees: string
  grantors: string
  beneficiaries: string
}

export interface Saca2Assets {
  /** Gate answers ("Do you or your spouse own any ...?"); null = unanswered. */
  gates: Partial<Record<AssetCategory, YesNo | null>>
  bankAccounts: BankAccountRow[]
  primaryResidence: RealEstateRow[]
  otherRealEstate: RealEstateRow[]
  lifeInsurance: LifeInsuranceRow[]
  securities: SecuritiesRow[]
  annuities: AnnuityRow[]
  assistedLivingDeposits: FacilityDepositRow[]
  vehicles: VehicleRow[]
  burial: BurialRow[]
  trusts: TrustRow[]
}

/** Supplement A, Resource Transfers (60-month look-back). */
export interface Saca2Transfer {
  description: string
  /** ISO YYYY-MM-DD. */
  dateOfTransfer: string | null
  transferredTo: string
  relationship: string
  amount: number | null
}

export interface SupplementA {
  needsNursingFacility: YesNo | null
  applyingHcbsWaiver: YesNo | null
  applyingPace: YesNo | null
  intendsToReturnHome: YesNo | null
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
  /** Tax returns filed in the last two years. */
  taxReturnsFiled: "bothYears" | "oneYear" | "neither" | null
  hasCopiesOfTaxReturns: YesNo | null
}

export interface SupplementB {
  members: Array<{ name: string; federallyRecognizedTribe: YesNo | null; tribeName: string }>
}

export type DailyLivingActivity =
  | "mobility"
  | "medications"
  | "bathing"
  | "dressing"
  | "rangeOfMotion"
  | "eating"
  | "toileting"

export interface SupplementC {
  healthProblems: string[]
  activities: Partial<
    Record<
      DailyLivingActivity,
      { needsHandsOnHelp: YesNo | null; timesPerDay: number | null; daysPerWeek: number | null }
    >
  >
  caregivers: Array<{ name: string; relationship: string }>
}

export interface SupplementD {
  jobs: Array<{
    employeeName: string
    employerName: string
    eligibleWithinThreeMonths: YesNo | null
    meetsMinimumValue: YesNo | null
    employeeMonthlyPremium: number | null
  }>
}

export interface Saca2Supplements {
  a: SupplementA
  b: SupplementB
  c: SupplementC
  d: SupplementD
}

export interface Saca2Answers {
  /** Server-safe (non-PHI): which program boxes were checked on page 1. */
  intake: {
    programs: {
      masshealthHsn: boolean
      longTermCare: boolean
      hcbsWaiver: boolean
      healthConnector: boolean
    }
    applyForSnap: boolean
  }
  /**
   * Screening-only questions drawn from EOM 26-03 that the printed form does not
   * ask directly. Non-PHI categorical flags.
   */
  screening: {
    disabledAndWorkingQualifies: YesNo | null
    commonHealthTenYears: YesNo | null
  }
  /** Index 0 = Person 1 (applicant), index 1 = Person 2 (spouse / other). */
  persons: Saca2Person[]
  aian: { anyMember: YesNo | null }
  previousMedicalBills: { hasBills: YesNo | null }
  assets: Saca2Assets
  transfers: Saca2Transfer[]
  health: {
    employerOfferedCoverage: YesNo | null
    enrolledInEmployerCoverage: boolean
  }
  /** Step 8 — personal-care attendant screen. */
  pca: {
    needsPca: YesNo | null
    paidByMassHealthLastSixMonths: YesNo | null
    byPerson: Array<{
      permanentDisability: YesNo | null
      disabilityBlocksAdls: YesNo | null
      willContactPcmAgency: YesNo | null
    }>
  }
  supplements: Saca2Supplements
  signature: {
    signedBy: "applicant" | "authorizedRepresentative" | "responsibleParty" | null
  }
}

export function emptySaca2Person(): Saca2Person {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    dateOfBirth: null,
    relationshipToPerson1: "",
    applyingForCoverage: null,
    inInstitution: null,
    isLegallyMarried: null,
    livesWithPerson1: null,
    residentOfMassachusetts: null,
    caregiverOfChildUnder19: null,
    usCitizenOrNational: null,
    immigrationStatus: null,
    hasMedicareOrSsiOrSsdi: null,
    income: [],
  }
}

export function emptySaca2Answers(): Saca2Answers {
  return {
    intake: {
      programs: { masshealthHsn: false, longTermCare: false, hcbsWaiver: false, healthConnector: false },
      applyForSnap: false,
    },
    screening: { disabledAndWorkingQualifies: null, commonHealthTenYears: null },
    persons: [emptySaca2Person()],
    aian: { anyMember: null },
    previousMedicalBills: { hasBills: null },
    assets: {
      gates: {},
      bankAccounts: [],
      primaryResidence: [],
      otherRealEstate: [],
      lifeInsurance: [],
      securities: [],
      annuities: [],
      assistedLivingDeposits: [],
      vehicles: [],
      burial: [],
      trusts: [],
    },
    transfers: [],
    health: { employerOfferedCoverage: null, enrolledInEmployerCoverage: false },
    pca: { needsPca: null, paidByMassHealthLastSixMonths: null, byPerson: [] },
    supplements: {
      a: {
        needsNursingFacility: null,
        applyingHcbsWaiver: null,
        applyingPace: null,
        intendsToReturnHome: null,
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
        taxReturnsFiled: null,
        hasCopiesOfTaxReturns: null,
      },
      b: { members: [] },
      c: { healthProblems: [], activities: {}, caregivers: [] },
      d: { jobs: [] },
    },
    signature: { signedBy: null },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/masshealth/saca2/__tests__/age.test.ts lib/masshealth/saca2/__tests__/types.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, and `tsc` reports no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/age.ts lib/masshealth/saca2/types.ts lib/masshealth/saca2/__tests__/age.test.ts lib/masshealth/saca2/__tests__/types.test.ts
git commit -m "feat(saca2): add answer types, empty-answer factories, and age helper" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Step registry (`schema.ts`)

**Files:**
- Create: `lib/masshealth/saca2/schema.ts`
- Test: `lib/masshealth/saca2/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type Saca2StepId = "intake" | "person1" | "person2" | "aian" | "previousBills" | "assets" | "healthInsurance" | "hra" | "pca" | "additionalCoverage" | "signature" | "suppA" | "suppB" | "suppC" | "suppD" | "ard" | "irs4506"`
  - `interface Saca2StepDef { id: Saca2StepId; kind: "step" | "supplement" | "attachment"; formStep: number | null; formPages: readonly [number, number]; titleKey: string }`
  - `SACA2_STEPS: readonly Saca2StepDef[]` (in form order)
  - `getStepDef(id: Saca2StepId): Saca2StepDef`

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/schema.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_STEPS, getStepDef } from "@/lib/masshealth/saca2/schema"

describe("SACA2_STEPS", () => {
  it("has unique ids in form order", () => {
    const ids = SACA2_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([
      "intake",
      "person1",
      "person2",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "pca",
      "additionalCoverage",
      "signature",
      "suppA",
      "suppB",
      "suppC",
      "suppD",
      "ard",
      "irs4506",
    ])
  })

  it("maps form pages from the 2026-08 PDF", () => {
    expect(getStepDef("person1").formPages).toEqual([1, 6])
    expect(getStepDef("person2").formPages).toEqual([7, 11])
    expect(getStepDef("assets").formPages).toEqual([12, 15])
    expect(getStepDef("suppA").formPages).toEqual([25, 28])
    expect(getStepDef("suppD").formPages).toEqual([31, 31])
    expect(getStepDef("ard").formPages).toEqual([33, 36])
    expect(getStepDef("irs4506").formPages).toEqual([37, 38])
  })

  it("numbers the form's Steps 1-10 and leaves supplements/attachments unnumbered", () => {
    expect(getStepDef("person1").formStep).toBe(1)
    expect(getStepDef("person2").formStep).toBe(2)
    expect(getStepDef("aian").formStep).toBe(3)
    expect(getStepDef("previousBills").formStep).toBe(4)
    expect(getStepDef("assets").formStep).toBe(5)
    expect(getStepDef("healthInsurance").formStep).toBe(6)
    expect(getStepDef("hra").formStep).toBe(7)
    expect(getStepDef("pca").formStep).toBe(8)
    expect(getStepDef("additionalCoverage").formStep).toBe(9)
    expect(getStepDef("signature").formStep).toBe(10)
    expect(getStepDef("suppA").formStep).toBeNull()
    expect(getStepDef("ard").kind).toBe("attachment")
    expect(getStepDef("suppB").kind).toBe("supplement")
  })

  it("gives every step an i18n title key", () => {
    for (const step of SACA2_STEPS) {
      expect(step.titleKey).toMatch(/^saca2\.step\.[a-zA-Z0-9]+$/)
    }
  })

  it("throws for an unknown step id", () => {
    // @ts-expect-error intentionally invalid
    expect(() => getStepDef("nope")).toThrow(/unknown step/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `lib/masshealth/saca2/schema.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

export type Saca2StepId =
  | "intake"
  | "person1"
  | "person2"
  | "aian"
  | "previousBills"
  | "assets"
  | "healthInsurance"
  | "hra"
  | "pca"
  | "additionalCoverage"
  | "signature"
  | "suppA"
  | "suppB"
  | "suppC"
  | "suppD"
  | "ard"
  | "irs4506"

export interface Saca2StepDef {
  id: Saca2StepId
  kind: "step" | "supplement" | "attachment"
  /** The form's own "STEP n" number; null for the intake block, supplements, and attachments. */
  formStep: number | null
  /** Inclusive form-page range in the SACA-2_2026-08 PDF (form pages, not PDF indices). */
  formPages: readonly [number, number]
  titleKey: string
}

/** Steps in form order. Question-level schema is added in the wizard plan. */
export const SACA2_STEPS: readonly Saca2StepDef[] = [
  { id: "intake", kind: "step", formStep: null, formPages: [1, 1], titleKey: "saca2.step.intake" },
  { id: "person1", kind: "step", formStep: 1, formPages: [1, 6], titleKey: "saca2.step.person1" },
  { id: "person2", kind: "step", formStep: 2, formPages: [7, 11], titleKey: "saca2.step.person2" },
  { id: "aian", kind: "step", formStep: 3, formPages: [12, 12], titleKey: "saca2.step.aian" },
  { id: "previousBills", kind: "step", formStep: 4, formPages: [12, 12], titleKey: "saca2.step.previousBills" },
  { id: "assets", kind: "step", formStep: 5, formPages: [12, 15], titleKey: "saca2.step.assets" },
  { id: "healthInsurance", kind: "step", formStep: 6, formPages: [16, 16], titleKey: "saca2.step.healthInsurance" },
  { id: "hra", kind: "step", formStep: 7, formPages: [17, 17], titleKey: "saca2.step.hra" },
  { id: "pca", kind: "step", formStep: 8, formPages: [17, 18], titleKey: "saca2.step.pca" },
  { id: "additionalCoverage", kind: "step", formStep: 9, formPages: [18, 18], titleKey: "saca2.step.additionalCoverage" },
  { id: "signature", kind: "step", formStep: 10, formPages: [18, 24], titleKey: "saca2.step.signature" },
  { id: "suppA", kind: "supplement", formStep: null, formPages: [25, 28], titleKey: "saca2.step.suppA" },
  { id: "suppB", kind: "supplement", formStep: null, formPages: [29, 29], titleKey: "saca2.step.suppB" },
  { id: "suppC", kind: "supplement", formStep: null, formPages: [30, 30], titleKey: "saca2.step.suppC" },
  { id: "suppD", kind: "supplement", formStep: null, formPages: [31, 31], titleKey: "saca2.step.suppD" },
  { id: "ard", kind: "attachment", formStep: null, formPages: [33, 36], titleKey: "saca2.step.ard" },
  { id: "irs4506", kind: "attachment", formStep: null, formPages: [37, 38], titleKey: "saca2.step.irs4506" },
]

export function getStepDef(id: Saca2StepId): Saca2StepDef {
  const def = SACA2_STEPS.find((s) => s.id === id)
  if (!def) throw new Error(`Unknown step: ${String(id)}`)
  return def
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/masshealth/saca2/__tests__/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/schema.ts lib/masshealth/saca2/__tests__/schema.test.ts
git commit -m "feat(saca2): add step registry mapped to the 2026-08 form" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Step visibility rules

**Files:**
- Create: `lib/masshealth/saca2/visibility.ts`
- Test: `lib/masshealth/saca2/__tests__/visibility.test.ts`

**Interfaces:**
- Consumes: `Saca2Answers`, `Saca2Person` (Task 2); `calculateAge` (Task 2); `Saca2StepId`, `SACA2_STEPS` (Task 3).
- Produces:
  - `isStepVisible(id: Saca2StepId, answers: Saca2Answers, on?: Date): boolean`
  - `getVisibleSteps(answers: Saca2Answers, on?: Date): Saca2StepId[]` (form order; `on` defaults to `new Date()`)

Rules (all use strict `=== "yes"`; `null` is never "yes"):
- Always visible: `intake`, `person1`, `aian`, `previousBills`, `assets`, `healthInsurance`, `hra`, `signature`.
- `person2`: `persons.length > 1` **or** Person 1 `isLegallyMarried === "yes"`.
- `pca` (Step 8): Person 1 age `>= 65` **and** `supplements.a.needsNursingFacility !== "yes"` **and** `intake.programs.longTermCare === false`. Age `null` → hidden.
- `additionalCoverage` (Step 9): exactly one of the (up to two) persons is `>= 65` and the other is `< 65` and married to / living with them (`persons[1].livesWithPerson1 === "yes"` or Person 1 married `"yes"`), and neither has `caregiverOfChildUnder19 === "yes"`. Any unknown age → hidden.
- `suppA`: `intake.programs.longTermCare || intake.programs.hcbsWaiver` **or** `needsNursingFacility === "yes"` **or** `applyingHcbsWaiver === "yes"` **or** `applyingPace === "yes"`.
- `suppB`: `aian.anyMember === "yes"`.
- `suppC`: `pca.needsPca === "yes"` **and** `pca.paidByMassHealthLastSixMonths !== "yes"` **and** some `pca.byPerson` entry has all three of `permanentDisability`, `disabilityBlocksAdls`, `willContactPcmAgency` equal to `"yes"`.
- `suppD`: `health.employerOfferedCoverage === "yes"` **or** `health.enrolledInEmployerCoverage`.
- `ard`: `signature.signedBy === "authorizedRepresentative"`.
- `irs4506`: `supplements.a.taxReturnsFiled` is `"bothYears"` or `"oneYear"` **and** `hasCopiesOfTaxReturns === "no"`.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/visibility.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { emptySaca2Answers, emptySaca2Person, type Saca2Answers } from "@/lib/masshealth/saca2/types"
import { getVisibleSteps, isStepVisible } from "@/lib/masshealth/saca2/visibility"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

describe("always-visible steps", () => {
  it("shows the core steps for a blank application and nothing conditional", () => {
    expect(getVisibleSteps(answers(), ON)).toEqual([
      "intake",
      "person1",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "signature",
    ])
  })
})

describe("person2", () => {
  it("is hidden for a single applicant and shown when a second person exists", () => {
    expect(isStepVisible("person2", answers(), ON)).toBe(false)
    expect(
      isStepVisible("person2", answers((a) => a.persons.push(emptySaca2Person())), ON),
    ).toBe(true)
  })

  it("is shown when Person 1 says they are legally married", () => {
    expect(
      isStepVisible("person2", answers((a) => (a.persons[0].isLegallyMarried = "yes")), ON),
    ).toBe(true)
  })
})

describe("pca (Step 8)", () => {
  it("shows for a 65+ applicant not entering a facility", () => {
    const a = answers((x) => (x.persons[0].dateOfBirth = "1961-10-13"))
    expect(isStepVisible("pca", a, ON)).toBe(true)
  })

  it("hides for under 65, unknown/invalid DOB, facility applicants, and LTC applicants", () => {
    expect(isStepVisible("pca", answers((x) => (x.persons[0].dateOfBirth = "1961-10-14")), ON)).toBe(false)
    expect(isStepVisible("pca", answers(), ON)).toBe(false)
    expect(isStepVisible("pca", answers((x) => (x.persons[0].dateOfBirth = "garbage")), ON)).toBe(false)
    expect(
      isStepVisible(
        "pca",
        answers((x) => {
          x.persons[0].dateOfBirth = "1950-01-01"
          x.supplements.a.needsNursingFacility = "yes"
        }),
        ON,
      ),
    ).toBe(false)
    expect(
      isStepVisible(
        "pca",
        answers((x) => {
          x.persons[0].dateOfBirth = "1950-01-01"
          x.intake.programs.longTermCare = true
        }),
        ON,
      ),
    ).toBe(false)
  })
})

describe("additionalCoverage (Step 9)", () => {
  function couple(p1Dob: string | null, p2Dob: string | null, mutate: (a: Saca2Answers) => void = () => {}) {
    return answers((a) => {
      a.persons[0].dateOfBirth = p1Dob
      a.persons[0].isLegallyMarried = "yes"
      const p2 = emptySaca2Person()
      p2.dateOfBirth = p2Dob
      p2.livesWithPerson1 = "yes"
      a.persons.push(p2)
      mutate(a)
    })
  }

  it("shows for a married 65+/under-65 couple living together with no child under 19", () => {
    expect(isStepVisible("additionalCoverage", couple("1955-01-01", "1970-01-01"), ON)).toBe(true)
    expect(isStepVisible("additionalCoverage", couple("1970-01-01", "1955-01-01"), ON)).toBe(true)
  })

  it("hides when both are 65+, both under 65, or either age is unknown", () => {
    expect(isStepVisible("additionalCoverage", couple("1950-01-01", "1955-01-01"), ON)).toBe(false)
    expect(isStepVisible("additionalCoverage", couple("1970-01-01", "1975-01-01"), ON)).toBe(false)
    expect(isStepVisible("additionalCoverage", couple("1950-01-01", null), ON)).toBe(false)
  })

  it("hides when someone is the caregiver of a child under 19, or the second person does not live with Person 1", () => {
    expect(
      isStepVisible(
        "additionalCoverage",
        couple("1955-01-01", "1970-01-01", (a) => (a.persons[1].caregiverOfChildUnder19 = "yes")),
        ON,
      ),
    ).toBe(false)
    expect(
      isStepVisible(
        "additionalCoverage",
        couple("1955-01-01", "1970-01-01", (a) => (a.persons[1].livesWithPerson1 = "no")),
        ON,
      ),
    ).toBe(false)
  })

  it("hides for a single applicant", () => {
    expect(isStepVisible("additionalCoverage", answers((a) => (a.persons[0].dateOfBirth = "1950-01-01")), ON)).toBe(false)
  })
})

describe("suppA", () => {
  it("shows for any long-term-care signal and never for an unanswered form", () => {
    expect(isStepVisible("suppA", answers(), ON)).toBe(false)
    expect(isStepVisible("suppA", answers((a) => (a.intake.programs.longTermCare = true)), ON)).toBe(true)
    expect(isStepVisible("suppA", answers((a) => (a.intake.programs.hcbsWaiver = true)), ON)).toBe(true)
    expect(isStepVisible("suppA", answers((a) => (a.supplements.a.needsNursingFacility = "yes")), ON)).toBe(true)
    expect(isStepVisible("suppA", answers((a) => (a.supplements.a.applyingHcbsWaiver = "yes")), ON)).toBe(true)
    expect(isStepVisible("suppA", answers((a) => (a.supplements.a.applyingPace = "yes")), ON)).toBe(true)
  })

  it('treats "no" and null as not triggering', () => {
    expect(isStepVisible("suppA", answers((a) => (a.supplements.a.needsNursingFacility = "no")), ON)).toBe(false)
  })
})

describe("supplements B, C, D and attachments", () => {
  it("suppB follows the AI/AN screen", () => {
    expect(isStepVisible("suppB", answers((a) => (a.aian.anyMember = "yes")), ON)).toBe(true)
    expect(isStepVisible("suppB", answers((a) => (a.aian.anyMember = "no")), ON)).toBe(false)
    expect(isStepVisible("suppB", answers(), ON)).toBe(false)
  })

  it("suppC needs PCA, no MassHealth-paid PCA in 6 months, and one person who answered yes to all three", () => {
    const base = (mutate: (a: Saca2Answers) => void) =>
      answers((a) => {
        a.pca.needsPca = "yes"
        a.pca.paidByMassHealthLastSixMonths = "no"
        a.pca.byPerson = [
          { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" },
        ]
        mutate(a)
      })
    expect(isStepVisible("suppC", base(() => {}), ON)).toBe(true)
    expect(isStepVisible("suppC", base((a) => (a.pca.paidByMassHealthLastSixMonths = "yes")), ON)).toBe(false)
    expect(isStepVisible("suppC", base((a) => (a.pca.byPerson[0].willContactPcmAgency = "no")), ON)).toBe(false)
    expect(isStepVisible("suppC", base((a) => (a.pca.byPerson[0].permanentDisability = null)), ON)).toBe(false)
    expect(isStepVisible("suppC", base((a) => (a.pca.needsPca = "no")), ON)).toBe(false)
  })

  it("suppD follows employer coverage", () => {
    expect(isStepVisible("suppD", answers((a) => (a.health.employerOfferedCoverage = "yes")), ON)).toBe(true)
    expect(isStepVisible("suppD", answers((a) => (a.health.enrolledInEmployerCoverage = true)), ON)).toBe(true)
    expect(isStepVisible("suppD", answers(), ON)).toBe(false)
  })

  it("ARD appears only when an authorized representative signs", () => {
    expect(isStepVisible("ard", answers((a) => (a.signature.signedBy = "authorizedRepresentative")), ON)).toBe(true)
    expect(isStepVisible("ard", answers((a) => (a.signature.signedBy = "applicant")), ON)).toBe(false)
    expect(isStepVisible("ard", answers(), ON)).toBe(false)
  })

  it("IRS 4506 appears only when returns were filed but copies were not kept", () => {
    const f = (filed: "bothYears" | "oneYear" | "neither" | null, copies: "yes" | "no" | null) =>
      answers((a) => {
        a.supplements.a.taxReturnsFiled = filed
        a.supplements.a.hasCopiesOfTaxReturns = copies
      })
    expect(isStepVisible("irs4506", f("bothYears", "no"), ON)).toBe(true)
    expect(isStepVisible("irs4506", f("oneYear", "no"), ON)).toBe(true)
    expect(isStepVisible("irs4506", f("bothYears", "yes"), ON)).toBe(false)
    expect(isStepVisible("irs4506", f("neither", "no"), ON)).toBe(false)
    expect(isStepVisible("irs4506", f(null, null), ON)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/visibility.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `lib/masshealth/saca2/visibility.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { calculateAge } from "./age"
import { SACA2_STEPS, type Saca2StepId } from "./schema"
import type { Saca2Answers } from "./types"

const SENIOR_AGE = 65

function ageOf(answers: Saca2Answers, index: number, on: Date): number | null {
  return calculateAge(answers.persons[index]?.dateOfBirth, on)
}

function showsPca(a: Saca2Answers, on: Date): boolean {
  const age = ageOf(a, 0, on)
  return (
    age !== null &&
    age >= SENIOR_AGE &&
    a.supplements.a.needsNursingFacility !== "yes" &&
    !a.intake.programs.longTermCare
  )
}

function showsAdditionalCoverage(a: Saca2Answers, on: Date): boolean {
  if (a.persons.length < 2) return false
  const age1 = ageOf(a, 0, on)
  const age2 = ageOf(a, 1, on)
  if (age1 === null || age2 === null) return false
  const oneSenior = (age1 >= SENIOR_AGE) !== (age2 >= SENIOR_AGE)
  if (!oneSenior) return false
  const livesTogether = a.persons[1].livesWithPerson1 === "yes" || a.persons[0].isLegallyMarried === "yes"
  if (!livesTogether || a.persons[1].livesWithPerson1 === "no") return false
  return a.persons.every((p) => p.caregiverOfChildUnder19 !== "yes")
}

function showsSuppA(a: Saca2Answers): boolean {
  const { programs } = a.intake
  const s = a.supplements.a
  return (
    programs.longTermCare ||
    programs.hcbsWaiver ||
    s.needsNursingFacility === "yes" ||
    s.applyingHcbsWaiver === "yes" ||
    s.applyingPace === "yes"
  )
}

function showsSuppC(a: Saca2Answers): boolean {
  if (a.pca.needsPca !== "yes" || a.pca.paidByMassHealthLastSixMonths === "yes") return false
  return a.pca.byPerson.some(
    (p) =>
      p.permanentDisability === "yes" &&
      p.disabilityBlocksAdls === "yes" &&
      p.willContactPcmAgency === "yes",
  )
}

export function isStepVisible(id: Saca2StepId, answers: Saca2Answers, on: Date = new Date()): boolean {
  switch (id) {
    case "intake":
    case "person1":
    case "aian":
    case "previousBills":
    case "assets":
    case "healthInsurance":
    case "hra":
    case "signature":
      return true
    case "person2":
      return answers.persons.length > 1 || answers.persons[0]?.isLegallyMarried === "yes"
    case "pca":
      return showsPca(answers, on)
    case "additionalCoverage":
      return showsAdditionalCoverage(answers, on)
    case "suppA":
      return showsSuppA(answers)
    case "suppB":
      return answers.aian.anyMember === "yes"
    case "suppC":
      return showsSuppC(answers)
    case "suppD":
      return answers.health.employerOfferedCoverage === "yes" || answers.health.enrolledInEmployerCoverage
    case "ard":
      return answers.signature.signedBy === "authorizedRepresentative"
    case "irs4506": {
      const s = answers.supplements.a
      return (s.taxReturnsFiled === "bothYears" || s.taxReturnsFiled === "oneYear") && s.hasCopiesOfTaxReturns === "no"
    }
  }
}

export function getVisibleSteps(answers: Saca2Answers, on: Date = new Date()): Saca2StepId[] {
  return SACA2_STEPS.filter((s) => isStepVisible(s.id, answers, on)).map((s) => s.id)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/masshealth/saca2/__tests__/visibility.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, no type errors (the `switch` is exhaustive over `Saca2StepId`).

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/visibility.ts lib/masshealth/saca2/__tests__/visibility.test.ts
git commit -m "feat(saca2): add step visibility rules" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Synthetic patient cases

**Files:**
- Create: `lib/masshealth/saca2/synthetic-cases.ts`
- Test: `lib/masshealth/saca2/__tests__/synthetic-cases.test.ts`

Cases are TypeScript (not JSON) so they are type-checked against `Saca2Answers` and reusable by later plans (engine, PDF fill, e2e). All names/numbers are fabricated.

**Interfaces:**
- Consumes: `Saca2Answers`, `emptySaca2Answers`, `emptySaca2Person` (Task 2); `getVisibleSteps` (Task 4).
- Produces:
  - `interface Saca2SyntheticCase { id: string; description: string; referenceDate: string; answers: Saca2Answers; expectedVisibleSteps: Saca2StepId[] }`
  - `SACA2_SYNTHETIC_CASES: readonly Saca2SyntheticCase[]`
  - `getSyntheticCase(id: string): Saca2SyntheticCase`
  - Case ids: `single-senior-home`, `couple-spouse-in-nursing-facility`, `hcbs-waiver-applicant`, `senior-parent-of-child-under-19`, `mixed-age-couple`, `trust-and-annuity-applicant`, `overflow-accounts`.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/synthetic-cases.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_SYNTHETIC_CASES, getSyntheticCase } from "@/lib/masshealth/saca2/synthetic-cases"
import { getVisibleSteps } from "@/lib/masshealth/saca2/visibility"

describe("SACA2_SYNTHETIC_CASES", () => {
  it("contains the seven planned cases with unique ids", () => {
    const ids = SACA2_SYNTHETIC_CASES.map((c) => c.id)
    expect(ids).toEqual([
      "single-senior-home",
      "couple-spouse-in-nursing-facility",
      "hcbs-waiver-applicant",
      "senior-parent-of-child-under-19",
      "mixed-age-couple",
      "trust-and-annuity-applicant",
      "overflow-accounts",
    ])
  })

  it.each(SACA2_SYNTHETIC_CASES.map((c) => [c.id, c] as const))(
    "%s: visibility matches the expected steps",
    (_id, c) => {
      expect(getVisibleSteps(c.answers, new Date(`${c.referenceDate}T12:00:00Z`))).toEqual(
        c.expectedVisibleSteps,
      )
    },
  )

  it("uses only fabricated identifiers (no real-looking SSNs or emails)", () => {
    const json = JSON.stringify(SACA2_SYNTHETIC_CASES)
    expect(json).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/)
    expect(json).not.toMatch(/@(?!example\.test)/)
  })

  it("couple-spouse-in-nursing-facility carries a transfer inside the 60-month window", () => {
    const c = getSyntheticCase("couple-spouse-in-nursing-facility")
    expect(c.answers.transfers.length).toBeGreaterThan(0)
    expect(c.answers.supplements.a.needsNursingFacility).toBe("yes")
  })

  it("overflow-accounts has more bank accounts than the form's two rows", () => {
    expect(getSyntheticCase("overflow-accounts").answers.assets.bankAccounts.length).toBeGreaterThan(2)
  })

  it("throws on an unknown case id", () => {
    expect(() => getSyntheticCase("nope")).toThrow(/unknown synthetic case/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/synthetic-cases.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `lib/masshealth/saca2/synthetic-cases.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2StepId } from "./schema"
import {
  emptySaca2Answers,
  emptySaca2Person,
  type BankAccountRow,
  type Saca2Answers,
  type Saca2Person,
} from "./types"

/** All data below is fabricated. Never copy real applicant data here. */
export interface Saca2SyntheticCase {
  id: string
  description: string
  /** ISO date used as "today" so age-gated rules are deterministic. */
  referenceDate: string
  answers: Saca2Answers
  expectedVisibleSteps: Saca2StepId[]
}

function person(overrides: Partial<Saca2Person>): Saca2Person {
  return { ...emptySaca2Person(), ...overrides }
}

function account(n: number, balance: number): BankAccountRow {
  return {
    ownerName: "Test Person",
    accountType: "savings",
    institution: `Example Bank ${n}`,
    accountNumber: `000000${n}`,
    currentBalance: balance,
    balanceOnAdmissionDate: null,
    open: true,
    closedOn: null,
    balanceWhenClosed: null,
  }
}

const REFERENCE_DATE = "2026-10-13"
const CORE: Saca2StepId[] = [
  "intake",
  "person1",
  "aian",
  "previousBills",
  "assets",
  "healthInsurance",
  "hra",
  "signature",
]

function singleSenior(): Saca2Answers {
  const a = emptySaca2Answers()
  a.persons[0] = person({
    firstName: "Edna",
    lastName: "Testcase",
    dateOfBirth: "1950-04-02",
    applyingForCoverage: "yes",
    residentOfMassachusetts: "yes",
    usCitizenOrNational: "yes",
    inInstitution: "no",
    isLegallyMarried: "no",
    caregiverOfChildUnder19: "no",
    income: [{ kind: "socialSecurity", amount: 1400, frequency: "monthly" }],
  })
  a.assets.bankAccounts = [account(1, 1200)]
  return a
}

function spouseInNursingFacility(): Saca2Answers {
  const a = emptySaca2Answers()
  a.intake.programs.longTermCare = true
  a.persons[0] = person({
    firstName: "Walter",
    lastName: "Testcase",
    dateOfBirth: "1944-09-20",
    applyingForCoverage: "yes",
    residentOfMassachusetts: "yes",
    usCitizenOrNational: "yes",
    inInstitution: "yes",
    isLegallyMarried: "yes",
    caregiverOfChildUnder19: "no",
    income: [
      { kind: "socialSecurity", amount: 2100, frequency: "monthly" },
      { kind: "pension", amount: 600, frequency: "monthly" },
    ],
  })
  a.persons.push(
    person({
      firstName: "Dorothy",
      lastName: "Testcase",
      dateOfBirth: "1946-02-11",
      relationshipToPerson1: "spouse",
      applyingForCoverage: "no",
      livesWithPerson1: "no",
      residentOfMassachusetts: "yes",
      caregiverOfChildUnder19: "no",
      income: [{ kind: "socialSecurity", amount: 1300, frequency: "monthly" }],
    }),
  )
  a.supplements.a.needsNursingFacility = "yes"
  a.supplements.a.intendsToReturnHome = "no"
  a.supplements.a.spouseMonthlyExpenses = {
    rent: null,
    mortgage: 1500,
    homeownersInsurance: 120,
    realEstateTaxes: 400,
    condoOrCoopFee: null,
    assistedLivingRoomAndBoard: null,
    paysHeat: "yes",
    paysUtilities: "yes",
  }
  a.supplements.a.taxReturnsFiled = "bothYears"
  a.supplements.a.hasCopiesOfTaxReturns = "yes"
  a.assets.primaryResidence = [{ address: "1 Example St, Testville MA", propertyType: "one-family", currentValue: 450000 }]
  a.assets.bankAccounts = [account(1, 54000), account(2, 18000)]
  a.transfers = [
    {
      description: "Cash gift",
      dateOfTransfer: "2024-03-15",
      transferredTo: "Test Child",
      relationship: "child",
      amount: 30000,
    },
  ]
  return a
}

function hcbsWaiver(): Saca2Answers {
  const a = emptySaca2Answers()
  a.intake.programs.hcbsWaiver = true
  a.persons[0] = person({
    firstName: "Rosa",
    lastName: "Testcase",
    dateOfBirth: "1948-12-05",
    applyingForCoverage: "yes",
    residentOfMassachusetts: "yes",
    usCitizenOrNational: "yes",
    inInstitution: "no",
    isLegallyMarried: "no",
    caregiverOfChildUnder19: "no",
    income: [{ kind: "socialSecurity", amount: 1500, frequency: "monthly" }],
  })
  a.supplements.a.applyingHcbsWaiver = "yes"
  a.supplements.a.taxReturnsFiled = "oneYear"
  a.supplements.a.hasCopiesOfTaxReturns = "no"
  return a
}

function seniorParentOfChild(): Saca2Answers {
  const a = singleSenior()
  a.persons[0].caregiverOfChildUnder19 = "yes"
  return a
}

function mixedAgeCouple(): Saca2Answers {
  const a = emptySaca2Answers()
  a.persons[0] = person({
    firstName: "Harold",
    lastName: "Testcase",
    dateOfBirth: "1955-06-30",
    applyingForCoverage: "yes",
    residentOfMassachusetts: "yes",
    usCitizenOrNational: "yes",
    isLegallyMarried: "yes",
    caregiverOfChildUnder19: "no",
  })
  a.persons.push(
    person({
      firstName: "June",
      lastName: "Testcase",
      dateOfBirth: "1968-08-14",
      relationshipToPerson1: "spouse",
      applyingForCoverage: "yes",
      livesWithPerson1: "yes",
      residentOfMassachusetts: "yes",
      usCitizenOrNational: "yes",
      isLegallyMarried: "yes",
      caregiverOfChildUnder19: "no",
    }),
  )
  return a
}

function trustAndAnnuity(): Saca2Answers {
  const a = spouseInNursingFacility()
  a.assets.trusts = [
    {
      name: "Testcase Family Trust",
      revocable: false,
      currentPrincipal: 90000,
      principalOnAdmissionDate: 95000,
      trustees: "Test Trustee",
      grantors: "Walter Testcase",
      beneficiaries: "Test Child",
    },
  ]
  a.assets.annuities = [
    { owners: "Walter Testcase", institution: "Example Annuity Co", contractNumber: "A-0001", purchasedOn: "2023-05-01" },
  ]
  a.aian.anyMember = "no"
  return a
}

function overflowAccounts(): Saca2Answers {
  const a = singleSenior()
  a.assets.bankAccounts = [account(1, 500), account(2, 700), account(3, 900), account(4, 1100)]
  return a
}

export const SACA2_SYNTHETIC_CASES: readonly Saca2SyntheticCase[] = [
  {
    id: "single-senior-home",
    description: "Single 76-year-old at home, Social Security only, one savings account.",
    referenceDate: REFERENCE_DATE,
    answers: singleSenior(),
    expectedVisibleSteps: [...CORE.slice(0, 2), ...CORE.slice(2, 5), "healthInsurance", "hra", "pca", "signature"],
  },
  {
    id: "couple-spouse-in-nursing-facility",
    description: "Husband in a nursing facility, wife at home; $30k gift inside the 60-month window.",
    referenceDate: REFERENCE_DATE,
    answers: spouseInNursingFacility(),
    expectedVisibleSteps: [
      "intake",
      "person1",
      "person2",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "signature",
      "suppA",
    ],
  },
  {
    id: "hcbs-waiver-applicant",
    description: "Single 77-year-old applying for a Home- and Community-Based Services Waiver; no copies of tax returns.",
    referenceDate: REFERENCE_DATE,
    answers: hcbsWaiver(),
    expectedVisibleSteps: [
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
      "irs4506",
    ],
  },
  {
    id: "senior-parent-of-child-under-19",
    description: "65+ applicant who lives with and cares for a child under 19 (belongs on ACA-3).",
    referenceDate: REFERENCE_DATE,
    answers: seniorParentOfChild(),
    expectedVisibleSteps: [...CORE.slice(0, 2), ...CORE.slice(2, 5), "healthInsurance", "hra", "pca", "signature"],
  },
  {
    id: "mixed-age-couple",
    description: "Married couple, husband 71 and wife 58, living together with no child under 19.",
    referenceDate: REFERENCE_DATE,
    answers: mixedAgeCouple(),
    expectedVisibleSteps: [
      "intake",
      "person1",
      "person2",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "pca",
      "additionalCoverage",
      "signature",
    ],
  },
  {
    id: "trust-and-annuity-applicant",
    description: "Nursing-facility couple with an irrevocable trust and a recent annuity.",
    referenceDate: REFERENCE_DATE,
    answers: trustAndAnnuity(),
    expectedVisibleSteps: [
      "intake",
      "person1",
      "person2",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "signature",
      "suppA",
    ],
  },
  {
    id: "overflow-accounts",
    description: "Single senior with four bank accounts (form has room for two).",
    referenceDate: REFERENCE_DATE,
    answers: overflowAccounts(),
    expectedVisibleSteps: [...CORE.slice(0, 2), ...CORE.slice(2, 5), "healthInsurance", "hra", "pca", "signature"],
  },
]

export function getSyntheticCase(id: string): Saca2SyntheticCase {
  const found = SACA2_SYNTHETIC_CASES.find((c) => c.id === id)
  if (!found) throw new Error(`Unknown synthetic case: ${id}`)
  return found
}
```

Check on the expected lists: `CORE` is `["intake","person1","aian","previousBills","assets","healthInsurance","hra","signature"]`, so `[...CORE.slice(0,2), ...CORE.slice(2,5), "healthInsurance","hra","pca","signature"]` evaluates to `intake, person1, aian, previousBills, assets, healthInsurance, hra, pca, signature` — the correct form order with `pca` inserted before `signature`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/masshealth/saca2/__tests__/synthetic-cases.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS. If a case fails its visibility expectation, the *case data or the rule* is wrong — fix whichever contradicts the spec rule (do not loosen the assertion).

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/synthetic-cases.ts lib/masshealth/saca2/__tests__/synthetic-cases.test.ts
git commit -m "feat(saca2): add synthetic patient cases" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Stop SACA-2 drafts from opening the ACA-3 wizard

**Files:**
- Create: `components/application/saca2/saca2-unavailable-notice.tsx`
- Create: `components/application/saca2/use-is-saca2-application.ts`
- Modify: `app/application/new/page.tsx` (render the notice instead of the tabs when the application is SACA-2)
- Test: `components/application/saca2/__tests__/use-is-saca2-application.test.tsx`
- Modify test: `app/application/new/__tests__/new-application-page.test.tsx` (add cases; do not alter existing ones)

**Interfaces:**
- Consumes: `getApplicationTypeBaseForm` and `isMassHealthApplicationType` from `@/lib/masshealth/application-types` (existing); `authenticatedFetch` from `@/lib/supabase/authenticated-fetch` (existing); `GET /api/applications/[applicationId]/draft` returning `{ ok: true, record: { applicationType: string | null } }` (existing).
- Produces:
  - `useIsSaca2Application(applicationId: string | undefined, reduxApplicationType: string, actingForPatientId?: string): "saca2" | "other" | "unknown"` — resolves from Redux when the type is known, otherwise fetches the draft once.
  - `<Saca2UnavailableNotice />` — card with an `data-testid="saca2-unavailable"` root, explaining online SACA-2 is not available yet and linking to the official application page (`https://www.mass.gov/lists/applications-to-become-a-masshealth-member`) and the MassHealth phone number (`MASSHEALTH_PHONE` from `@/lib/masshealth/constants`).

Behaviour: while the lookup is `"unknown"` and there is an `applicationId` query param, render nothing from the ACA-3 tabs (avoid flashing the wrong wizard); with no `applicationId` (brand-new application) behave exactly as today.

- [ ] **Step 1: Write the failing hook test**

Create `components/application/saca2/__tests__/use-is-saca2-application.test.tsx`:

```tsx
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mocks.authenticatedFetch,
}))

import { useIsSaca2Application } from "@/components/application/saca2/use-is-saca2-application"

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as unknown as Response
}

describe("useIsSaca2Application", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("answers from Redux without fetching when the type is known", () => {
    const { result } = renderHook(() => useIsSaca2Application("app-1", "saca2"))
    expect(result.current).toBe("saca2")
    expect(mocks.authenticatedFetch).not.toHaveBeenCalled()

    const other = renderHook(() => useIsSaca2Application("app-2", "aca3"))
    expect(other.result.current).toBe("other")
  })

  it("returns other immediately when there is no application id (new application)", () => {
    const { result } = renderHook(() => useIsSaca2Application(undefined, ""))
    expect(result.current).toBe("other")
    expect(mocks.authenticatedFetch).not.toHaveBeenCalled()
  })

  it("looks the type up from the server draft after a reload (Redux empty)", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      jsonResponse({ ok: true, record: { applicationType: "saca2" } }),
    )
    const { result } = renderHook(() => useIsSaca2Application("app-3", ""))
    expect(result.current).toBe("unknown")
    await waitFor(() => expect(result.current).toBe("saca2"))
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith(
      "/api/applications/app-3/draft",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("forwards the acting-for-patient header for social workers", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      jsonResponse({ ok: true, record: { applicationType: "aca3" } }),
    )
    const { result } = renderHook(() => useIsSaca2Application("app-4", "", "patient-9"))
    await waitFor(() => expect(result.current).toBe("other"))
    const init = mocks.authenticatedFetch.mock.calls[0][1] as { headers?: Record<string, string> }
    expect(init.headers?.["X-Acting-For-Patient"]).toBe("patient-9")
  })

  it("falls back to other when the lookup fails or the draft has no type", async () => {
    mocks.authenticatedFetch.mockRejectedValueOnce(new Error("network"))
    const failed = renderHook(() => useIsSaca2Application("app-5", ""))
    await waitFor(() => expect(failed.result.current).toBe("other"))

    mocks.authenticatedFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, record: { applicationType: null } }),
    )
    const untyped = renderHook(() => useIsSaca2Application("app-6", ""))
    await waitFor(() => expect(untyped.result.current).toBe("other"))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/application/saca2/__tests__/use-is-saca2-application.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook and the notice**

Create `components/application/saca2/use-is-saca2-application.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { useEffect, useState } from "react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import {
  getApplicationTypeBaseForm,
  isMassHealthApplicationType,
} from "@/lib/masshealth/application-types"

export type Saca2Lookup = "saca2" | "other" | "unknown"

function classify(type: string | null | undefined): Saca2Lookup {
  if (!type) return "other"
  if (!isMassHealthApplicationType(type)) return "other"
  return getApplicationTypeBaseForm(type) === "saca2" ? "saca2" : "other"
}

/**
 * Is this application a SACA-2? Redux is not persisted, so after a reload the type
 * is unknown client-side; fall back to the server draft once.
 */
export function useIsSaca2Application(
  applicationId: string | undefined,
  reduxApplicationType: string,
  actingForPatientId?: string,
): Saca2Lookup {
  const [fetched, setFetched] = useState<{ id: string; result: Saca2Lookup } | null>(null)
  const needsLookup = Boolean(applicationId) && !reduxApplicationType

  useEffect(() => {
    if (!needsLookup || !applicationId) return
    let cancelled = false
    const headers: Record<string, string> = {}
    if (actingForPatientId) headers["X-Acting-For-Patient"] = actingForPatientId

    // Promise.resolve().then(...) also turns a synchronous throw from the fetch helper
    // into a rejection, so the page falls back to "other" instead of crashing.
    Promise.resolve()
      .then(() =>
        authenticatedFetch(`/api/applications/${applicationId}/draft`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(6_000),
        }),
      )
      .then((res) => res.json() as Promise<{ ok: boolean; record?: { applicationType: string | null } }>)
      .then((data) => {
        if (cancelled) return
        setFetched({ id: applicationId, result: classify(data.ok ? data.record?.applicationType : null) })
      })
      .catch(() => {
        if (!cancelled) setFetched({ id: applicationId, result: "other" })
      })

    return () => {
      cancelled = true
    }
  }, [needsLookup, applicationId, actingForPatientId])

  if (!applicationId) return "other"
  if (reduxApplicationType) return classify(reduxApplicationType)
  return fetched?.id === applicationId ? fetched.result : "unknown"
}
```

Create `components/application/saca2/saca2-unavailable-notice.tsx`:

```tsx
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { MASSHEALTH_PHONE } from "@/lib/masshealth/constants"

const OFFICIAL_APPLICATIONS_URL = "https://www.mass.gov/lists/applications-to-become-a-masshealth-member"

export function Saca2UnavailableNotice() {
  return (
    <section
      data-testid="saca2-unavailable"
      className="space-y-3 rounded-lg border bg-card p-6 text-card-foreground"
      aria-labelledby="saca2-unavailable-title"
    >
      <h2 id="saca2-unavailable-title" className="text-lg font-semibold">
        Online SACA-2 is not available yet
      </h2>
      <p className="text-sm text-muted-foreground">
        The application for seniors and people needing long-term-care services (SACA-2) is not
        yet available in this app. We have not started the standard ACA-3 form for you, because
        it is a different application.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          Download the official SACA-2 from{" "}
          <a
            className="underline"
            href={OFFICIAL_APPLICATIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            mass.gov
          </a>
          .
        </li>
        <li>Or call MassHealth at {MASSHEALTH_PHONE} (TTY 711) to apply by phone.</li>
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: Run the hook test to verify it passes**

Run: `npx vitest run components/application/saca2/__tests__/use-is-saca2-application.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add failing page tests**

Edit `app/application/new/__tests__/new-application-page.test.tsx`. Add `authenticatedFetch` to the hoisted mocks object and mock the module, import `createApplication`, then append new cases. Make these edits:

1. In the `vi.hoisted(() => ({ ... }))` block add `authenticatedFetch: vi.fn(),` as a new property.
2. After the existing `vi.mock("@/lib/utils/random-id", ...)` block add:

```tsx
vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mocks.authenticatedFetch,
}))
```

3. Change the application-slice import line to also import the action:

```tsx
import { applicationReducer, createApplication } from "@/lib/redux/features/application-slice"
```

4. Change `renderPage` so tests can pre-seed the store:

```tsx
function renderPage(seed?: (store: ReturnType<typeof makeStore>) => void) {
  const store = makeStore()
  seed?.(store)
  return render(
    <Provider store={store}>
      <NewApplicationPage />
    </Provider>,
  )
}
```

5. In the existing `beforeEach` of `describe("new application page", ...)`, after the existing lines, add a default for the new lookup so the pre-existing tests that pass `applicationId` keep working (they now resolve to "other" after one async tick; their `waitFor`s already tolerate that):

```tsx
    mocks.authenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, record: { applicationType: "aca3" } }),
    })
```

6. Append inside the `describe("new application page", ...)` block, before its closing `})`:

```tsx
  it("shows the SACA-2 notice, not the ACA-3 wizard, when Redux says the draft is SACA-2", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-saca" }))

    renderPage((store) =>
      store.dispatch(createApplication({ applicationId: "app-saca", applicationType: "saca2" })),
    )

    expect(await screen.findByTestId("saca2-unavailable")).toBeInTheDocument()
    expect(mocks.intakeChat).not.toHaveBeenCalled()
    expect(mocks.formWizard).not.toHaveBeenCalled()
    expect(mocks.applicationAssistant).not.toHaveBeenCalled()
  })

  it("shows the SACA-2 notice after a reload, when only the server draft knows the type", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-reload" }))
    mocks.authenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, record: { applicationType: "saca2" } }),
    })

    renderPage()

    expect(await screen.findByTestId("saca2-unavailable")).toBeInTheDocument()
    expect(mocks.intakeChat).not.toHaveBeenCalled()
    expect(mocks.formWizard).not.toHaveBeenCalled()
  })

  it("does not flash the ACA-3 flow while the server lookup is pending", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-pending" }))
    mocks.authenticatedFetch.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.queryByTestId("saca2-unavailable")).not.toBeInTheDocument()
    expect(mocks.intakeChat).not.toHaveBeenCalled()
    expect(mocks.formWizard).not.toHaveBeenCalled()
  })

  it("still opens the ACA-3 flow for non-SACA-2 drafts", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-aca3" }))

    renderPage((store) =>
      store.dispatch(createApplication({ applicationId: "app-aca3", applicationType: "aca3" })),
    )

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(screen.queryByTestId("saca2-unavailable")).not.toBeInTheDocument()
  })
```

- [ ] **Step 6: Run page tests to verify the new ones fail**

Run: `npx vitest run app/application/new/__tests__/new-application-page.test.tsx`
Expected: the four new tests FAIL (the notice never renders / ACA-3 renders); the original tests still PASS.

- [ ] **Step 7: Wire the guard into the page**

Edit `app/application/new/page.tsx`:

1. Add imports near the other component imports:

```tsx
import { Saca2UnavailableNotice } from "@/components/application/saca2/saca2-unavailable-notice"
import { useIsSaca2Application } from "@/components/application/saca2/use-is-saca2-application"
```

2. After the existing `const savedApplicationType = useAppSelector(...)` block and before `const typeLabel = ...`, add:

```tsx
  const saca2Lookup = useIsSaca2Application(queryApplicationId || undefined, savedApplicationType, actingForPatientId)
```

3. Immediately before the main `return (` of `NewApplicationPageContent`, add:

```tsx
  if (saca2Lookup === "unknown") {
    return <div className="container mx-auto px-4 py-6" />
  }

  if (saca2Lookup === "saca2") {
    return (
      <div className="container mx-auto space-y-4 px-4 py-6">
        <h1 className="text-xl font-semibold text-foreground">SACA-2 Application</h1>
        <Saca2UnavailableNotice />
      </div>
    )
  }
```

Hooks must stay above these early returns: confirm `useIsSaca2Application` is called before the first `return` and that no other hook is added after them.

- [ ] **Step 8: Run all affected tests plus type check and lint**

Run:

```bash
npx vitest run app/application/new components/application/saca2 lib/masshealth && npx tsc --noEmit -p tsconfig.json && npx eslint app/application/new components/application/saca2 lib/masshealth/saca2
```

Expected: all PASS; no type errors; no lint errors.

- [ ] **Step 9: Commit**

```bash
git add components/application/saca2 app/application/new/page.tsx app/application/new/__tests__/new-application-page.test.tsx
git commit -m "fix(saca2): show a notice instead of opening the ACA-3 wizard for SACA-2 drafts" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Update the spec to match what plan 1 settled

**Files:**
- Modify: `docs/superpowers/specs/2026-10-13-saca2-application-design.md`

**Interfaces:** none.

- [ ] **Step 1: Edit the spec**

Apply these three edits:

1. In §6 (Build order), replace the Phase 0 row with:

```
| 0 | `types`, step registry (`schema.ts`), `visibility`, `figures-2026` + staleness guard, synthetic cases, and a guard so SACA-2 drafts show a notice instead of the ACA-3 wizard (plan `2026-10-13-saca2-foundation.md`). Question-level schema and the `saca2_enabled` flag move to Phase 1, where the renderer and the wizard they gate are built. |
```

2. In §7 (Open items), replace item 1 and item 2 with:

```
1. ~~Ownership / social-worker authorization~~ — resolved: `getApplicationDraft(userId, applicationId, actingFor)` in `lib/db/application-drafts.ts` (the `X-Acting-For-Patient` path used by `GET /api/applications/[applicationId]/draft`). The fill route reuses it.
2. **Feature-flag reader** — nothing in app code reads `public.feature_flags` today. Phase 1 decides between a runtime server-evaluated env flag (passed as a prop from a server component) and building a DB reader; an env flag avoids a Docker rebuild, unlike `NEXT_PUBLIC_*`.
```

3. In §2 (Current state), after the "Dead end today" row's text, append: ` Fixed in Phase 0 by a notice (hook + component under components/application/saca2/).`

- [ ] **Step 2: Verify and commit**

Run: `grep -n "Phase 0\|getApplicationDraft" docs/superpowers/specs/2026-10-13-saca2-application-design.md`
Expected: the edited lines appear.

```bash
git add docs/superpowers/specs/2026-10-13-saca2-application-design.md
git commit -m "docs(saca2): reflect plan-1 decisions in the spec" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Final verification (after Task 7)

- [ ] Run the full relevant suite and project checks:

```bash
npx vitest run lib/masshealth app/application components/application && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2 components/application/saca2 app/application/new
```

Expected: all PASS, no type or lint errors, and `git status` shows only the pre-existing unrelated changes (`next-env.d.ts`, `test-results.json`, `.codex/`).

- [ ] Manual check (optional, needs a logged-in dev session): pick **SACA-2** on `/application/type`, confirm the notice appears at `/application/new?applicationId=…` and the ACA-3 chat/wizard does not; pick **ACA-3** and confirm it still works.
