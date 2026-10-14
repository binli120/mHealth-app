# SACA-2 Wizard Core (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working, PHI-safe SACA-2 wizard platform (question schema, validation, step renderer, save/resume, feature flag) with the first six steps — intake, Person 1, Person 2, AI/AN screen, previous medical bills, who-signs — behind a flag that stays **off**.

**Architecture:** Questions are typed data (`lib/masshealth/saca2/questions/`), validated by pure functions, rendered by a generic `Saca2StepForm`, and driven by a reducer (`wizard-state.ts`). Persistence reuses the ACA-3 PHI machinery: a PHI-free snapshot is autosaved to `PUT /api/applications/[id]/draft`; PHI lives only in React memory until the user runs Save & Exit (`PhiSaveExitDialog`, encrypted blob in storage). `/application/new` shows the wizard for SACA-2 drafts only when `GET /api/config/saca2` says the env flag `SACA2_ENABLED` is on; otherwise the plan-1 notice stays.

**Tech Stack:** TypeScript, Next.js App Router, React `useReducer`, Vitest + React Testing Library, existing `components/ui` primitives, existing `lib/phi-token` and `/api/applications/*` routes.

**Spec:** `docs/superpowers/specs/2026-10-13-saca2-application-design.md` (Phase 1). Builds on `docs/superpowers/plans/2026-10-13-saca2-foundation.md` (merged).

## Scope and sequence

| Plan | Content | Status |
|---|---|---|
| 1 `…-saca2-foundation.md` | types, figures, visibility, synthetic cases, notice | merged |
| **2 (this file)** | wizard platform + steps: intake, Person 1/2, AI/AN, previous bills, who-signs; flag; PHI-safe save/resume | ready |
| 2b | remaining question content: assets (repeaters), transfers, health insurance, HRA, PCA, Step 9, Supplements A–D, ARD, IRS 4506, optional demographics, tax/Health Connector questions, deductions | after 2 |
| 3 | field map + PDF fill | after 2b |
| 4 | eligibility engine + checklist | after 2b |
| 5 | i18n, chat intake driver, touchpoints, e2e, rollout | after 3 and 4 |

The flag must not be turned on until **2b** ships: until then the wizard has only six of the form's steps.

## Decisions to confirm (made here, easy to change)

1. **No PHI at rest in the browser.** ACA-3 also writes the full snapshot (PHI included) to `localStorage`. SACA-2 keeps PHI in memory only, plus the existing encrypted Save & Exit blob, and warns before the tab closes. Cost: a refresh loses un-secured PHI. A later change can add an opt-in autosave of the encrypted blob.
2. **All SACA-2 answer keys except `intake` and `signature` are PHI** (including `screening`, `aian`, `health`, `pca`) and are stripped from the server draft.
3. **Flag = env var `SACA2_ENABLED` read at runtime by a public route**, not the unused `feature_flags` DB table and not `NEXT_PUBLIC_*` (no Docker rebuild needed).
4. **Server `currentStep` = furthest step reached, capped at 9.** The draft route only accepts 1–9 and refuses to overwrite a higher stored step, so saving the *current* step would leave server state stale after the user steps back.

## Global Constraints

- Run commands from `/Users/blee/dev/masshealth-repo/mHealth-app` with Node 22: `export PATH=/Users/blee/.nvm/versions/node/v22.23.0/bin:$PATH` (the shell default, Node 18.0.0, cannot run vitest).
- Form version strings: `SACA2_FORM_CODE = "SACA-2_2026-08"`, `SACA2_SCHEMA_VERSION = "saca2-2026-08"` (from `lib/masshealth/saca2/types.ts`).
- PHI never in the server `draft_state`; the `PUT` body must contain no value the user typed into a PHI key. Server `currentStep` must be an integer 1–9.
- No `APPROVED`/determination wording anywhere; the wizard only collects answers in this plan.
- English only in this plan; step titles come from `STEP_TITLES` so i18n can swap them later (`titleKey` already exists on each step).
- Repo style: 2-space indent, no semicolons, double quotes, `@author: Bin Lee` / `@email: blee@comura.ai` header on every new file, tests in `__tests__/` next to the module, imports via `@/`.
- ACA-3 behaviour must not change (its tests must stay green, including the PHI key change in Task 3).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **PHI leak to the server:** after the user types a name and SSN, the autosave `PUT` body must contain neither value, nor any key from `persons`, `assets`, `screening`, `aian`, `health`, `pca`, `supplements`, `transfers`, `previousMedicalBills`. → Task 9 test.
2. **Stale server state after stepping back:** server `currentStep` never decreases and never exceeds 9. → Task 6 test.
3. **Hidden required questions must not block Next** (e.g. SSN when "no SSN" is chosen; mailing address when "same as street"). → Task 5 tests.
4. **Reload with a PHI blob on the server:** the user sees the resume prompt (or auto-restore with a server key), and nothing crashes when the server draft is empty, garbage, or from an older schema version. → Task 6 (normalize) and Task 9 tests.
5. **Prototype pollution through answer paths** (`__proto__`, `constructor`). → Task 1 test.
6. **Flag failure fails closed:** if `/api/config/saca2` errors, the SACA-2 draft shows the notice, never the wizard and never the ACA-3 form. → Task 8 and Task 10 tests.

---

### Task 1: Answer-path helpers

**Files:**
- Create: `lib/masshealth/saca2/answer-paths.ts`
- Test: `lib/masshealth/saca2/__tests__/answer-paths.test.ts`

**Interfaces:**
- Produces:
  - `parsePath(path: string): Array<string | number>` — splits on `.`; all-digit segments become numbers; throws on `__proto__`, `constructor`, `prototype`.
  - `getAtPath(root: unknown, path: string): unknown` — `undefined` when any segment is missing.
  - `setAtPath<T>(root: T, path: string, value: unknown): T` — immutable; clones only the nodes along the path; creates arrays for numeric segments and objects otherwise.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/answer-paths.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { getAtPath, parsePath, setAtPath } from "@/lib/masshealth/saca2/answer-paths"

describe("parsePath", () => {
  it("turns digit segments into numbers", () => {
    expect(parsePath("persons.0.firstName")).toEqual(["persons", 0, "firstName"])
  })

  it("rejects prototype-pollution segments", () => {
    expect(() => parsePath("__proto__.polluted")).toThrow(/forbidden/i)
    expect(() => parsePath("persons.constructor.prototype")).toThrow(/forbidden/i)
    expect(() => parsePath("a.prototype")).toThrow(/forbidden/i)
  })
})

describe("getAtPath", () => {
  const root = { persons: [{ firstName: "Ada", income: [{ amount: 5 }] }], intake: { programs: { longTermCare: true } } }

  it("reads nested objects and array indices", () => {
    expect(getAtPath(root, "persons.0.firstName")).toBe("Ada")
    expect(getAtPath(root, "persons.0.income.0.amount")).toBe(5)
    expect(getAtPath(root, "intake.programs.longTermCare")).toBe(true)
  })

  it("returns undefined for missing or non-object steps", () => {
    expect(getAtPath(root, "persons.3.firstName")).toBeUndefined()
    expect(getAtPath(root, "intake.programs.longTermCare.deeper")).toBeUndefined()
    expect(getAtPath(null, "a.b")).toBeUndefined()
  })
})

describe("setAtPath", () => {
  it("does not mutate the original and shares untouched branches", () => {
    const root = { a: { x: 1 }, b: { y: 2 } }
    const next = setAtPath(root, "a.x", 9)
    expect(root.a.x).toBe(1)
    expect(next.a.x).toBe(9)
    expect(next.b).toBe(root.b)
  })

  it("updates array elements without mutating the source array", () => {
    const root = { persons: [{ firstName: "A" }, { firstName: "B" }] }
    const next = setAtPath(root, "persons.1.firstName", "Z")
    expect(root.persons[1].firstName).toBe("B")
    expect(next.persons[1].firstName).toBe("Z")
    expect(next.persons[0]).toBe(root.persons[0])
  })

  it("creates missing containers: arrays for numeric segments, objects otherwise", () => {
    const next = setAtPath({} as Record<string, unknown>, "persons.0.income.1.amount", 3)
    expect(next).toEqual({ persons: [{ income: [undefined, { amount: 3 }] }] })
    expect(Array.isArray((next as { persons: unknown }).persons)).toBe(true)
  })

  it("can replace a whole array value", () => {
    const next = setAtPath({ persons: [{ income: [] as unknown[] }] }, "persons.0.income", [{ amount: 1 }])
    expect(next.persons[0].income).toEqual([{ amount: 1 }])
  })

  it("rejects forbidden segments and empty paths and never pollutes Object.prototype", () => {
    expect(() => setAtPath({}, "__proto__.polluted", true)).toThrow(/forbidden/i)
    expect(() => setAtPath({}, "", 1)).toThrow(/empty path/i)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/answer-paths.test.ts`
Expected: FAIL — cannot resolve `@/lib/masshealth/saca2/answer-paths`.

- [ ] **Step 3: Write the implementation**

Create `lib/masshealth/saca2/answer-paths.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

export type PathSegment = string | number

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"])

export function parsePath(path: string): PathSegment[] {
  return path
    .split(".")
    .filter((segment) => segment !== "")
    .map((segment) => {
      if (FORBIDDEN_SEGMENTS.has(segment)) {
        throw new Error(`Forbidden path segment: ${segment}`)
      }
      return /^\d+$/.test(segment) ? Number(segment) : segment
    })
}

export function getAtPath(root: unknown, path: string): unknown {
  let current: unknown = root
  for (const segment of parsePath(path)) {
    if (current === null || current === undefined || typeof current !== "object") return undefined
    current = (current as Record<PathSegment, unknown>)[segment]
  }
  return current
}

function setIn(node: unknown, segments: PathSegment[], index: number, value: unknown): unknown {
  const segment = segments[index]
  const clone: Record<PathSegment, unknown> = Array.isArray(node)
    ? ([...node] as unknown as Record<PathSegment, unknown>)
    : node && typeof node === "object"
      ? { ...(node as Record<PathSegment, unknown>) }
      : typeof segment === "number"
        ? ([] as unknown as Record<PathSegment, unknown>)
        : {}
  clone[segment] = index === segments.length - 1 ? value : setIn(clone[segment], segments, index + 1, value)
  return clone
}

export function setAtPath<T>(root: T, path: string, value: unknown): T {
  const segments = parsePath(path)
  if (segments.length === 0) throw new Error("Empty path")
  return setIn(root, segments, 0, value) as T
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/masshealth/saca2/__tests__/answer-paths.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/answer-paths.ts lib/masshealth/saca2/__tests__/answer-paths.test.ts
git commit -m "feat(saca2): add immutable answer-path helpers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Extend answer types for Person 1/2, income, and the PHI key list

**Files:**
- Modify: `lib/masshealth/saca2/types.ts` (replace `SACA2_PHI_KEYS`, `Saca2IncomeItem`, `Saca2Person`, `emptySaca2Person`)
- Modify: `lib/masshealth/saca2/__tests__/types.test.ts`

**Interfaces:**
- Consumes: existing `types.ts` exports from plan 1.
- Produces:
  - `SACA2_PHI_KEYS = ["screening","persons","aian","previousMedicalBills","assets","transfers","health","pca","supplements"] as const`
  - `SACA2_SERVER_SAFE_KEYS = ["intake","signature"] as const`
  - `Saca2IncomeItem` gains optional `employerNameAndAddress?: string` and `hoursPerWeek?: number | null`
  - `Saca2Person` gains the fields listed in Step 3; every existing field keeps its name and type.

- [ ] **Step 1: Write the failing tests**

In `lib/masshealth/saca2/__tests__/types.test.ts`, change the import to also pull `SACA2_SERVER_SAFE_KEYS`:

```ts
import {
  SACA2_FORM_CODE,
  SACA2_PHI_KEYS,
  SACA2_SCHEMA_VERSION,
  SACA2_SERVER_SAFE_KEYS,
  emptySaca2Answers,
  emptySaca2Person,
} from "@/lib/masshealth/saca2/types"
```

Replace the test named `lists the PHI-bearing top-level keys` with:

```ts
  it("classifies every top-level answer key as PHI or server-safe, and only intake/signature are server-safe", () => {
    const keys = Object.keys(emptySaca2Answers()).sort()
    expect([...SACA2_PHI_KEYS, ...SACA2_SERVER_SAFE_KEYS].sort()).toEqual(keys)
    expect([...SACA2_SERVER_SAFE_KEYS]).toEqual(["intake", "signature"])
  })
```

Append a new `describe` at the end of the file:

```ts
describe("emptySaca2Person defaults", () => {
  it("gives every new person field an empty default", () => {
    const p = emptySaca2Person()
    expect(p.streetAddress).toBe("")
    expect(p.noHomeAddress).toBe(false)
    expect(p.mailingSameAsStreet).toBe(true)
    expect(p.state).toBe("MA")
    expect(p.sexAtBirth).toBeNull()
    expect(p.hasSsn).toBeNull()
    expect(p.ssn).toBe("")
    expect(p.hasIncome).toBeNull()
    expect(p.expectedIncomeThisYear).toBeNull()
    expect(p.expectedIncomeNextYear).toBeNull()
    expect(p.livingArrangement).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/masshealth/saca2/__tests__/types.test.ts`
Expected: FAIL — `SACA2_SERVER_SAFE_KEYS` is not exported / `p.streetAddress` is `undefined`.

- [ ] **Step 3: Implement the type changes**

In `lib/masshealth/saca2/types.ts`:

1. Replace the `SACA2_PHI_KEYS` declaration and its comment with:

```ts
/**
 * Top-level answer keys that contain PHI. These must travel only through the
 * client-encrypted resume blob (lib/phi-token), never the server draft_state.
 * Everything except SACA2_SERVER_SAFE_KEYS is PHI: even yes/no answers such as
 * disability, PCA need, or tribal membership are health/identity data once tied
 * to a user.
 */
export const SACA2_PHI_KEYS = [
  "screening",
  "persons",
  "aian",
  "previousMedicalBills",
  "assets",
  "transfers",
  "health",
  "pca",
  "supplements",
] as const

/** Top-level keys that may be stored in the server draft_state. */
export const SACA2_SERVER_SAFE_KEYS = ["intake", "signature"] as const
```

2. Replace the `Saca2IncomeItem` interface with:

```ts
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
  /** Wages only: employer name and address. */
  employerNameAndAddress?: string
  /** Wages and self-employment: average hours worked each week. */
  hoursPerWeek?: number | null
}
```

3. Replace the whole `Saca2Person` interface (the block starting `/** One person block`) with:

```ts
/** One person block (Step 1 = Person 1, Step 2 = Person 2). */
export interface Saca2Person {
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  /** ISO YYYY-MM-DD. */
  dateOfBirth: string | null
  sexAtBirth: "male" | "female" | null
  relationshipToPerson1: string
  applyingForCoverage: YesNo | null

  noHomeAddress: boolean
  streetAddress: string
  apartment: string
  city: string
  state: string
  zip: string
  county: string
  /** Q9 / Person 2 Q6: hospital, nursing facility, or other institution. */
  inInstitution: YesNo | null
  facilityName: string
  mailingSameAsStreet: boolean
  mailingAddress: string
  mailingApartment: string
  mailingCity: string
  mailingState: string
  mailingZip: string

  mobilePhone: string
  otherPhone: string
  email: string
  preferredLanguageSpoken: string
  preferredLanguageWritten: string

  hasSsn: YesNo | null
  ssn: string
  noSsnReason: "illness" | "justApplied" | "noncitizenException" | "religiousException" | null

  usCitizenOrNational: YesNo | null
  naturalizedCitizen: YesNo | null
  alienNumber: string
  citizenshipCertificateNumber: string
  hasEligibleImmigrationStatus: YesNo | null
  /** Slug from the page-32 eligible immigration status list. */
  immigrationStatus: string | null
  /** Slug from the page-32 immigration document type list. */
  immigrationDocumentType: string | null
  immigrationDocumentId: string
  immigrationDocumentExpiry: string | null

  /** Residency question (Person 1 Q14 / Person 2 Q24). */
  residentOfMassachusetts: YesNo | null
  /** "Do you live with a child under 19 and are you the main caregiver?" */
  caregiverOfChildUnder19: YesNo | null
  isLegallyMarried: YesNo | null
  livesWithPerson1: YesNo | null
  hasDisability: YesNo | null
  everGotSsi: YesNo | null
  /** mm/yyyy */
  lastSsiMonth: string
  livingArrangement: "alone" | "withSpouse" | "restHome" | "someoneElsesHome" | null
  /** Screening aid (not a form question): used to decide which proofs are needed. */
  hasMedicareOrSsiOrSsdi: YesNo | null

  hasIncome: YesNo | null
  income: Saca2IncomeItem[]
  expectedIncomeThisYear: number | null
  expectedIncomeNextYear: number | null
}
```

4. Replace the whole `emptySaca2Person` function with:

```ts
export function emptySaca2Person(): Saca2Person {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    dateOfBirth: null,
    sexAtBirth: null,
    relationshipToPerson1: "",
    applyingForCoverage: null,

    noHomeAddress: false,
    streetAddress: "",
    apartment: "",
    city: "",
    state: "MA",
    zip: "",
    county: "",
    inInstitution: null,
    facilityName: "",
    mailingSameAsStreet: true,
    mailingAddress: "",
    mailingApartment: "",
    mailingCity: "",
    mailingState: "MA",
    mailingZip: "",

    mobilePhone: "",
    otherPhone: "",
    email: "",
    preferredLanguageSpoken: "",
    preferredLanguageWritten: "",

    hasSsn: null,
    ssn: "",
    noSsnReason: null,

    usCitizenOrNational: null,
    naturalizedCitizen: null,
    alienNumber: "",
    citizenshipCertificateNumber: "",
    hasEligibleImmigrationStatus: null,
    immigrationStatus: null,
    immigrationDocumentType: null,
    immigrationDocumentId: "",
    immigrationDocumentExpiry: null,

    residentOfMassachusetts: null,
    caregiverOfChildUnder19: null,
    isLegallyMarried: null,
    livesWithPerson1: null,
    hasDisability: null,
    everGotSsi: null,
    lastSsiMonth: "",
    livingArrangement: null,
    hasMedicareOrSsiOrSsdi: null,

    hasIncome: null,
    income: [],
    expectedIncomeThisYear: null,
    expectedIncomeNextYear: null,
  }
}
```

- [ ] **Step 4: Run tests and the type check**

Run: `npx vitest run lib/masshealth/saca2 && npx tsc --noEmit -p tsconfig.json`
Expected: PASS (all saca2 tests, including the synthetic cases and visibility tests that build persons via `emptySaca2Person()`); `tsc` prints no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/types.ts lib/masshealth/saca2/__tests__/types.test.ts
git commit -m "feat(saca2): extend person/income types and classify PHI vs server-safe keys" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: One PHI key list for client and server

**Files:**
- Modify: `lib/phi-token/phi-fields.ts` (extend `PHI_DATA_KEYS`)
- Modify: `lib/db/application-drafts.ts` (import the shared key set instead of a private copy)
- Test: `lib/phi-token/__tests__/phi-fields.test.ts` (create)
- Test: `lib/db/__tests__/application-drafts-phi-strip.test.ts` (create)

**Interfaces:**
- Consumes: `SACA2_PHI_KEYS`, `SACA2_SERVER_SAFE_KEYS` (Task 2); `PHI_DATA_KEY_SET`, `PHI_DATA_KEYS` (existing).
- Produces: `PHI_DATA_KEYS` that includes every `SACA2_PHI_KEYS` entry plus `"contact"`, `"preApp"`. The server strip in `upsertApplicationDraft` uses `PHI_DATA_KEY_SET` (no private copy, so the two lists cannot drift).

- [ ] **Step 1: Write the failing tests**

Create `lib/phi-token/__tests__/phi-fields.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { PHI_DATA_KEYS, PHI_DATA_KEY_SET } from "@/lib/phi-token/phi-fields"
import { SACA2_PHI_KEYS, SACA2_SERVER_SAFE_KEYS } from "@/lib/masshealth/saca2/types"

describe("PHI_DATA_KEYS", () => {
  it("keeps the original ACA-3 keys", () => {
    for (const key of ["contact", "preApp", "persons"]) {
      expect(PHI_DATA_KEY_SET.has(key)).toBe(true)
    }
  })

  it("covers every SACA-2 PHI key", () => {
    for (const key of SACA2_PHI_KEYS) {
      expect(PHI_DATA_KEY_SET.has(key)).toBe(true)
    }
  })

  it("never classifies a server-safe SACA-2 key as PHI", () => {
    for (const key of SACA2_SERVER_SAFE_KEYS) {
      expect(PHI_DATA_KEY_SET.has(key)).toBe(false)
    }
  })

  it("does not claim ACA-3 non-PHI data keys", () => {
    for (const key of ["assister", "assisterEnabled", "attestation"]) {
      expect(PHI_DATA_KEY_SET.has(key)).toBe(false)
    }
  })

  it("has no duplicates", () => {
    expect(new Set(PHI_DATA_KEYS).size).toBe(PHI_DATA_KEYS.length)
  })
})
```

Create `lib/db/__tests__/application-drafts-phi-strip.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const query = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: () => ({ query }),
}))

import { upsertApplicationDraft } from "@/lib/db/application-drafts"

const USER_ID = "07d7e11d-6a3d-41a8-826d-66e38470c830"
const APPLICANT_ID = "11111111-1111-4111-8111-111111111111"
const APPLICATION_ID = "88cbe518-ea42-476b-a8e9-12207573ff2c"

const DRAFT_ROW = {
  id: APPLICATION_ID,
  status: "draft",
  application_type: "saca2",
  draft_state: {},
  draft_step: 2,
  last_saved_at: "2026-10-13T00:00:00.000Z",
  submitted_at: null,
  created_at: "2026-10-13T00:00:00.000Z",
  updated_at: "2026-10-13T00:00:00.000Z",
  phi_draft_resume_id: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ id: APPLICANT_ID }] })
    .mockResolvedValueOnce({ rows: [DRAFT_ROW] })
})

describe("upsertApplicationDraft PHI stripping", () => {
  it("removes every SACA-2 PHI key from the persisted draft_state but keeps server-safe keys", async () => {
    await upsertApplicationDraft({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      applicationType: "saca2",
      wizardState: {
        schemaVersion: "saca2-2026-08",
        currentStep: 2,
        data: {
          intake: { programs: { longTermCare: true } },
          signature: { signedBy: "applicant" },
          screening: { commonHealthTenYears: "yes" },
          persons: [{ firstName: "Ada", ssn: "123456789" }],
          aian: { anyMember: "yes" },
          previousMedicalBills: { hasBills: "yes" },
          assets: { bankAccounts: [{ accountNumber: "9999" }] },
          transfers: [{ amount: 1 }],
          health: { employerOfferedCoverage: "yes" },
          pca: { needsPca: "yes" },
          supplements: { a: {} },
        },
      },
    })

    const call = query.mock.calls.find((c) => /INSERT INTO public\.applications \(/.test(String(c[0])))
    const saved = JSON.parse(String((call?.[1] as unknown[])[4])) as { data: Record<string, unknown> }
    expect(Object.keys(saved.data).sort()).toEqual(["intake", "signature"])
    expect(JSON.stringify(saved)).not.toMatch(/Ada|123456789|9999/)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/phi-token/__tests__/phi-fields.test.ts lib/db/__tests__/application-drafts-phi-strip.test.ts`
Expected: `phi-fields.test.ts` FAILS (`covers every SACA-2 PHI key`); `application-drafts-phi-strip.test.ts` FAILS because `assets`, `screening`, etc. are still persisted. (The step-cap test is added in Task 6 Step 5, once `wizard-state.ts` exists.)

- [ ] **Step 3: Implement**

In `lib/phi-token/phi-fields.ts` replace the doc comment and the `PHI_DATA_KEYS` declaration with:

```ts
/**
 * PHI fields within WizardState.data that must never be persisted on the server.
 *
 * ACA-3:
 *   contact  — applicant name, address, SSN, DOB, phone, citizenship, language prefs
 *   preApp   — pre-application personal questions
 *   persons  — household member identities, SSNs, DOBs, incomes, coverage details
 * SACA-2 (see SACA2_PHI_KEYS in lib/masshealth/saca2/types.ts):
 *   screening, persons, aian, previousMedicalBills, assets, transfers, health, pca,
 *   supplements — everything except the `intake` and `signature` keys.
 *
 * These keys are stripped from wizard state before any server PUT and before
 * any DB write. PHI travels only in the encrypted client-side resume blob.
 * This module is pure (no browser crypto), so server code may import it.
 */
export const PHI_DATA_KEYS = [
  "contact",
  "preApp",
  "persons",
  "screening",
  "aian",
  "previousMedicalBills",
  "assets",
  "transfers",
  "health",
  "pca",
  "supplements",
] as const
```

In `lib/db/application-drafts.ts`:

1. Add this import next to the other imports at the top:

```ts
import { PHI_DATA_KEY_SET } from "@/lib/phi-token/phi-fields"
```

2. Delete the `SERVER_PHI_DATA_KEYS` declaration (the `const SERVER_PHI_DATA_KEYS = new Set([...])` line) and replace its use inside `stripPhiFromWizardState`:

```ts
    if (!PHI_DATA_KEY_SET.has(key)) {
```

3. In the doc comment above `stripPhiFromWizardState`, replace the sentence about the "server-side copy" with: `The key list is shared with the client (lib/phi-token/phi-fields.ts, a pure module) so the two cannot drift.`

- [ ] **Step 4: Run tests, including the ACA-3 suites that use the key list**

Run: `npx vitest run lib/phi-token lib/db components/application app/api/applications`
Expected: PASS (all). If an ACA-3 test fails, it is relying on `PHI_DATA_KEYS` having exactly three entries — fix that test's expectation to iterate the exported constant, not to the old literal.

- [ ] **Step 5: Commit**

```bash
git add lib/phi-token/phi-fields.ts lib/phi-token/__tests__/phi-fields.test.ts lib/db/application-drafts.ts lib/db/__tests__/application-drafts-phi-strip.test.ts
git commit -m "feat(saca2): share one PHI key list between client and server draft strip" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Question model and validation

**Files:**
- Create: `lib/masshealth/saca2/questions/types.ts`
- Create: `lib/masshealth/saca2/questions/builders.ts`
- Create: `lib/masshealth/saca2/questions/validate.ts`
- Test: `lib/masshealth/saca2/__tests__/questions-validate.test.ts`

**Interfaces:**
- Consumes: `Saca2Answers`, `emptySaca2Answers` (plan 1 / Task 2); `getAtPath` (Task 1).
- Produces (`questions/types.ts`):
  - `Saca2QuestionKind = "text"|"date"|"yesNo"|"money"|"number"|"select"|"ssn"|"phone"|"email"|"checkbox"|"repeater"`
  - `Saca2QuestionContext = { answers: Saca2Answers; personIndex: number; on: Date; item?: Record<string, unknown> }`
  - `Saca2Text = string | ((ctx: Saca2QuestionContext) => string)`; `resolveText(text: Saca2Text | undefined, ctx): string`
  - `Saca2Option = { value: string; label: string }`
  - `Saca2RepeaterConfig = { questions: Saca2Question[]; emptyItem: () => Record<string, unknown>; addLabel: string; itemTitle: string; maxItems: number }`
  - `Saca2Question = { id; kind; path; label: Saca2Text; help?: Saca2Text; options?: readonly Saca2Option[]; required?: boolean | ((ctx) => boolean); visibleWhen?: (ctx) => boolean; validate?: (value: unknown, ctx) => string | null; repeater?: Saca2RepeaterConfig }`
  - `Saca2Section = { id: string; title: Saca2Text; description?: Saca2Text; questions: Saca2Question[] }`
  - `Saca2StepContent = { scope: "root" | "person"; sections: Saca2Section[]; validateStep?: (answers: Saca2Answers, personIndex: number) => Record<string, string> }`
  - `resolveQuestionPath(scope, personIndex, path): string`, `isQuestionVisible(q, ctx): boolean`, `isQuestionRequired(q, ctx): boolean`
- Produces (`questions/builders.ts`): `text|date|yesNo|money|number|ssn|phone|email|checkbox(path, label, extra?)`, `select(path, label, options, extra?)`, `repeater(path, label, config, extra?)`, `opts(pairs)`; each sets `id = path`.
- Produces (`questions/validate.ts`): `isEmptyValue(kind, value): boolean`, `validateValue(q, value, ctx): string | null`, `validateQuestions(questions, ctx, scope, personIndex, basePath?, out?): Record<string, string>` — keys are absolute answer paths.

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-validate.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { emptySaca2Answers } from "@/lib/masshealth/saca2/types"
import type { Saca2QuestionContext } from "@/lib/masshealth/saca2/questions/types"
import {
  checkbox,
  date,
  email,
  money,
  opts,
  phone,
  repeater,
  select,
  ssn,
  text,
  yesNo,
} from "@/lib/masshealth/saca2/questions/builders"
import { isEmptyValue, validateQuestions, validateValue } from "@/lib/masshealth/saca2/questions/validate"

function ctx(overrides: Partial<Saca2QuestionContext> = {}): Saca2QuestionContext {
  return { answers: emptySaca2Answers(), personIndex: 0, on: new Date("2026-10-13T12:00:00Z"), ...overrides }
}

describe("builders", () => {
  it("use the path as the id", () => {
    const q = text("firstName", "First name", { required: true })
    expect(q).toMatchObject({ id: "firstName", path: "firstName", kind: "text", required: true })
  })
})

describe("isEmptyValue", () => {
  it("treats null, undefined, blank strings, and empty arrays as empty", () => {
    expect(isEmptyValue("text", null)).toBe(true)
    expect(isEmptyValue("text", undefined)).toBe(true)
    expect(isEmptyValue("text", "   ")).toBe(true)
    expect(isEmptyValue("repeater", [])).toBe(true)
    expect(isEmptyValue("text", "a")).toBe(false)
    expect(isEmptyValue("money", 0)).toBe(false)
  })

  it("treats an unchecked checkbox as empty", () => {
    expect(isEmptyValue("checkbox", false)).toBe(true)
    expect(isEmptyValue("checkbox", true)).toBe(false)
  })
})

describe("validateValue", () => {
  it("requires a value only when the question is required", () => {
    expect(validateValue(text("a", "A", { required: true }), "", ctx())).toMatch(/required/i)
    expect(validateValue(text("a", "A"), "", ctx())).toBeNull()
    expect(validateValue(yesNo("a", "A", { required: true }), null, ctx())).toMatch(/required/i)
  })

  it("supports conditional required", () => {
    const q = text("a", "A", { required: (c) => c.personIndex === 1 })
    expect(validateValue(q, "", ctx({ personIndex: 0 }))).toBeNull()
    expect(validateValue(q, "", ctx({ personIndex: 1 }))).toMatch(/required/i)
  })

  it("validates SSN as exactly nine digits, ignoring dashes and spaces", () => {
    expect(validateValue(ssn("s", "SSN"), "123-45-6789", ctx())).toBeNull()
    expect(validateValue(ssn("s", "SSN"), "123 45 6789", ctx())).toBeNull()
    expect(validateValue(ssn("s", "SSN"), "12345678", ctx())).toMatch(/9-digit/i)
  })

  it("validates phone as ten digits and email shape", () => {
    expect(validateValue(phone("p", "Phone"), "(617) 555-0100", ctx())).toBeNull()
    expect(validateValue(phone("p", "Phone"), "555-0100", ctx())).toMatch(/10-digit/i)
    expect(validateValue(email("e", "Email"), "a@b.co", ctx())).toBeNull()
    expect(validateValue(email("e", "Email"), "nope", ctx())).toMatch(/valid email/i)
  })

  it("validates dates as real ISO calendar dates", () => {
    expect(validateValue(date("d", "D"), "2026-02-28", ctx())).toBeNull()
    expect(validateValue(date("d", "D"), "2026-02-30", ctx())).toMatch(/valid date/i)
    expect(validateValue(date("d", "D"), "02/03/2026", ctx())).toMatch(/valid date/i)
  })

  it("validates money as a finite number that is not negative", () => {
    expect(validateValue(money("m", "M"), 0, ctx())).toBeNull()
    expect(validateValue(money("m", "M"), 12.5, ctx())).toBeNull()
    expect(validateValue(money("m", "M"), -1, ctx())).toMatch(/0 or more/i)
    expect(validateValue(money("m", "M"), Number.NaN, ctx())).toMatch(/0 or more/i)
  })

  it("restricts select to its options and yesNo to yes/no", () => {
    const q = select("s", "S", opts([["a", "A"], ["b", "B"]]))
    expect(validateValue(q, "a", ctx())).toBeNull()
    expect(validateValue(q, "z", ctx())).toMatch(/listed options/i)
    expect(validateValue(yesNo("y", "Y"), "maybe", ctx())).toMatch(/yes or no/i)
  })

  it("requires a checkbox to be checked only when required", () => {
    expect(validateValue(checkbox("c", "C", { required: true }), false, ctx())).toMatch(/required/i)
    expect(validateValue(checkbox("c", "C"), false, ctx())).toBeNull()
  })

  it("runs a custom validator after the built-in checks", () => {
    const q = text("a", "A", { validate: (v) => (v === "bad" ? "No bad values." : null) })
    expect(validateValue(q, "bad", ctx())).toBe("No bad values.")
    expect(validateValue(q, "good", ctx())).toBeNull()
  })
})

describe("validateQuestions", () => {
  it("skips questions whose visibleWhen is false, even if required", () => {
    const questions = [
      yesNo("persons.0.hasSsn", "Has SSN?", { required: true }),
      ssn("persons.0.ssn", "SSN", { required: true, visibleWhen: (c) => c.answers.persons[0].hasSsn === "yes" }),
    ]
    const answers = emptySaca2Answers()
    answers.persons[0].hasSsn = "no"
    const errors = validateQuestions(questions, ctx({ answers }), "root", 0)
    expect(Object.keys(errors)).toEqual([])
  })

  it("keys errors by absolute path for person scope", () => {
    const questions = [text("firstName", "First", { required: true })]
    const errors = validateQuestions(questions, ctx(), "person", 1)
    expect(errors).toEqual({ "persons.1.firstName": "This question is required." })
  })

  it("requires at least one repeater item when the repeater is required, and validates items by index", () => {
    const itemQuestions = [money("amount", "Amount", { required: true }), text("note", "Note")]
    const rep = repeater("income", "Income", {
      questions: itemQuestions,
      emptyItem: () => ({ amount: null, note: "" }),
      addLabel: "Add income",
      itemTitle: "Income source",
      maxItems: 3,
    }, { required: true })

    const none = emptySaca2Answers()
    expect(validateQuestions([rep], ctx({ answers: none }), "person", 0)).toEqual({
      "persons.0.income": "Add at least one.",
    })

    const some = emptySaca2Answers()
    ;(some.persons[0].income as unknown[]) = [
      { amount: 10, note: "" },
      { amount: null, note: "" },
    ]
    expect(validateQuestions([rep], ctx({ answers: some }), "person", 0)).toEqual({
      "persons.0.income.1.amount": "This question is required.",
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-validate.test.ts`
Expected: FAIL — cannot resolve `@/lib/masshealth/saca2/questions/builders`.

- [ ] **Step 3: Write the implementation**

Create `lib/masshealth/saca2/questions/types.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2Answers } from "../types"

export type Saca2QuestionKind =
  | "text"
  | "date"
  | "yesNo"
  | "money"
  | "number"
  | "select"
  | "ssn"
  | "phone"
  | "email"
  | "checkbox"
  | "repeater"

export interface Saca2QuestionContext {
  answers: Saca2Answers
  /** Which person block a person-scope step is rendering (0 = Person 1). Root-scope steps use 0. */
  personIndex: number
  on: Date
  /** Present only for questions inside a repeater item. */
  item?: Record<string, unknown>
}

export type Saca2Text = string | ((ctx: Saca2QuestionContext) => string)

export function resolveText(text: Saca2Text | undefined, ctx: Saca2QuestionContext): string {
  if (text === undefined) return ""
  return typeof text === "function" ? text(ctx) : text
}

export interface Saca2Option {
  value: string
  label: string
}

export interface Saca2RepeaterConfig {
  questions: Saca2Question[]
  emptyItem: () => Record<string, unknown>
  addLabel: string
  itemTitle: string
  maxItems: number
}

export interface Saca2Question {
  /** Unique within a step. Builders set it equal to `path`. */
  id: string
  kind: Saca2QuestionKind
  /**
   * Path relative to the step scope: person scope -> `persons.{personIndex}.{path}`,
   * root scope -> the path as written, inside a repeater -> a key of the item.
   */
  path: string
  label: Saca2Text
  help?: Saca2Text
  options?: readonly Saca2Option[]
  required?: boolean | ((ctx: Saca2QuestionContext) => boolean)
  visibleWhen?: (ctx: Saca2QuestionContext) => boolean
  /** Custom check, run after the built-in kind check for non-empty values. */
  validate?: (value: unknown, ctx: Saca2QuestionContext) => string | null
  repeater?: Saca2RepeaterConfig
}

export interface Saca2Section {
  id: string
  title: Saca2Text
  description?: Saca2Text
  questions: Saca2Question[]
}

export interface Saca2StepContent {
  scope: "root" | "person"
  sections: Saca2Section[]
  /** Cross-field checks that no single question can express. Keys are absolute answer paths. */
  validateStep?: (answers: Saca2Answers, personIndex: number) => Record<string, string>
}

export function resolveQuestionPath(scope: "root" | "person", personIndex: number, path: string): string {
  return scope === "person" ? `persons.${personIndex}.${path}` : path
}

export function isQuestionVisible(question: Saca2Question, ctx: Saca2QuestionContext): boolean {
  return question.visibleWhen ? question.visibleWhen(ctx) : true
}

export function isQuestionRequired(question: Saca2Question, ctx: Saca2QuestionContext): boolean {
  return typeof question.required === "function" ? question.required(ctx) : Boolean(question.required)
}
```

Create `lib/masshealth/saca2/questions/builders.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type {
  Saca2Option,
  Saca2Question,
  Saca2QuestionKind,
  Saca2RepeaterConfig,
  Saca2Text,
} from "./types"

type Extra = Partial<Omit<Saca2Question, "id" | "kind" | "path" | "label" | "options" | "repeater">>

function make(kind: Saca2QuestionKind, path: string, label: Saca2Text, extra: Extra = {}): Saca2Question {
  return { id: path, kind, path, label, ...extra }
}

export const text = (path: string, label: Saca2Text, extra?: Extra) => make("text", path, label, extra)
export const date = (path: string, label: Saca2Text, extra?: Extra) => make("date", path, label, extra)
export const yesNo = (path: string, label: Saca2Text, extra?: Extra) => make("yesNo", path, label, extra)
export const money = (path: string, label: Saca2Text, extra?: Extra) => make("money", path, label, extra)
export const number = (path: string, label: Saca2Text, extra?: Extra) => make("number", path, label, extra)
export const ssn = (path: string, label: Saca2Text, extra?: Extra) => make("ssn", path, label, extra)
export const phone = (path: string, label: Saca2Text, extra?: Extra) => make("phone", path, label, extra)
export const email = (path: string, label: Saca2Text, extra?: Extra) => make("email", path, label, extra)
export const checkbox = (path: string, label: Saca2Text, extra?: Extra) => make("checkbox", path, label, extra)

export function select(
  path: string,
  label: Saca2Text,
  options: readonly Saca2Option[],
  extra?: Extra,
): Saca2Question {
  return { ...make("select", path, label, extra), options }
}

export function repeater(
  path: string,
  label: Saca2Text,
  config: Saca2RepeaterConfig,
  extra?: Extra,
): Saca2Question {
  return { ...make("repeater", path, label, extra), repeater: config }
}

export function opts(pairs: ReadonlyArray<readonly [string, string]>): Saca2Option[] {
  return pairs.map(([value, label]) => ({ value, label }))
}
```

Create `lib/masshealth/saca2/questions/validate.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { getAtPath } from "../answer-paths"
import {
  isQuestionRequired,
  isQuestionVisible,
  resolveQuestionPath,
  type Saca2Question,
  type Saca2QuestionContext,
  type Saca2QuestionKind,
} from "./types"

const REQUIRED_MESSAGE = "This question is required."

export function isEmptyValue(kind: Saca2QuestionKind, value: unknown): boolean {
  if (kind === "checkbox") return value !== true
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

function isRealIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const probe = new Date(Date.UTC(year, month - 1, day))
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
}

export function validateValue(
  question: Saca2Question,
  value: unknown,
  ctx: Saca2QuestionContext,
): string | null {
  if (isEmptyValue(question.kind, value)) {
    return isQuestionRequired(question, ctx) ? REQUIRED_MESSAGE : null
  }

  switch (question.kind) {
    case "ssn":
      if (String(value).replace(/\D/g, "").length !== 9) return "Enter a 9-digit Social Security number."
      break
    case "phone":
      if (String(value).replace(/\D/g, "").length !== 10) return "Enter a 10-digit phone number."
      break
    case "email":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return "Enter a valid email address."
      break
    case "date":
      if (typeof value !== "string" || !isRealIsoDate(value)) return "Enter a valid date."
      break
    case "money":
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return "Enter a number that is 0 or more."
      }
      break
    case "select":
      if (!question.options?.some((option) => option.value === value)) return "Choose one of the listed options."
      break
    case "yesNo":
      if (value !== "yes" && value !== "no") return "Choose Yes or No."
      break
    default:
      break
  }

  return question.validate?.(value, ctx) ?? null
}

/** Validate visible questions; returned keys are absolute answer paths. */
export function validateQuestions(
  questions: Saca2Question[],
  ctx: Saca2QuestionContext,
  scope: "root" | "person",
  personIndex: number,
  basePath?: string,
  out: Record<string, string> = {},
): Record<string, string> {
  for (const question of questions) {
    if (!isQuestionVisible(question, ctx)) continue

    const absolutePath =
      basePath !== undefined ? `${basePath}.${question.path}` : resolveQuestionPath(scope, personIndex, question.path)
    const value = basePath !== undefined && ctx.item ? ctx.item[question.path] : getAtPath(ctx.answers, absolutePath)

    if (question.kind === "repeater" && question.repeater) {
      const items = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
      if (items.length === 0) {
        if (isQuestionRequired(question, ctx)) out[absolutePath] = "Add at least one."
        continue
      }
      items.forEach((item, index) => {
        validateQuestions(
          question.repeater!.questions,
          { ...ctx, item },
          scope,
          personIndex,
          `${absolutePath}.${index}`,
          out,
        )
      })
      continue
    }

    const message = validateValue(question, value, ctx)
    if (message) out[absolutePath] = message
  }
  return out
}
```

- [ ] **Step 4: Run the test and the type check**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-validate.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions lib/masshealth/saca2/__tests__/questions-validate.test.ts
git commit -m "feat(saca2): add question model, builders, and validation" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Step content and the step registry

**Files:**
- Create: `lib/masshealth/saca2/questions/immigration-options.ts`
- Create: `lib/masshealth/saca2/questions/person.ts`
- Create: `lib/masshealth/saca2/questions/root-steps.ts`
- Create: `lib/masshealth/saca2/questions/index.ts`
- Test: `lib/masshealth/saca2/__tests__/questions-content.test.ts`

**Interfaces:**
- Consumes: builders and validators (Task 4); `Saca2StepId` and `SACA2_STEPS` (plan 1); `getAtPath` (Task 1); `emptySaca2Answers` (Task 2).
- Produces (`questions/index.ts`):
  - `getStepContent(stepId: Saca2StepId): Saca2StepContent | null` — `null` for steps with no content yet
  - `IMPLEMENTED_STEP_IDS: ReadonlySet<Saca2StepId>` = intake, person1, person2, aian, previousBills, signature
  - `STEP_TITLES: Record<Saca2StepId, string>`
  - `getStepPersonIndex(stepId: Saca2StepId): number` — person1 → 0, person2 → 1, everything else → 0
  - `validateStep(stepId, answers, on: Date): Record<string, string>` — runs every section's questions for the step's person index, plus the step's `validateStep` hook; `{}` for steps without content
- Produces (`immigration-options.ts`): `IMMIGRATION_STATUS_OPTIONS`, `IMMIGRATION_DOCUMENT_OPTIONS` (`Saca2Option[]`, values are slugs of the labels).

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/questions-content.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { getAtPath } from "@/lib/masshealth/saca2/answer-paths"
import {
  IMPLEMENTED_STEP_IDS,
  STEP_TITLES,
  getStepContent,
  getStepPersonIndex,
  validateStep,
} from "@/lib/masshealth/saca2/questions"
import {
  IMMIGRATION_DOCUMENT_OPTIONS,
  IMMIGRATION_STATUS_OPTIONS,
} from "@/lib/masshealth/saca2/questions/immigration-options"
import { resolveQuestionPath, type Saca2Question } from "@/lib/masshealth/saca2/questions/types"
import { SACA2_STEPS } from "@/lib/masshealth/saca2/schema"
import { emptySaca2Answers, emptySaca2Person, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function allQuestions(stepId: Parameters<typeof getStepContent>[0]): Saca2Question[] {
  const content = getStepContent(stepId)
  return content ? content.sections.flatMap((section) => section.questions) : []
}

describe("step registry", () => {
  it("implements exactly the six planned steps", () => {
    expect([...IMPLEMENTED_STEP_IDS].sort()).toEqual(
      ["aian", "intake", "person1", "person2", "previousBills", "signature"].sort(),
    )
    for (const id of IMPLEMENTED_STEP_IDS) expect(getStepContent(id)).not.toBeNull()
    expect(getStepContent("assets")).toBeNull()
  })

  it("has an English title for every step", () => {
    for (const step of SACA2_STEPS) expect(STEP_TITLES[step.id].length).toBeGreaterThan(0)
  })

  it("maps person steps to person indexes", () => {
    expect(getStepPersonIndex("person1")).toBe(0)
    expect(getStepPersonIndex("person2")).toBe(1)
    expect(getStepPersonIndex("intake")).toBe(0)
  })
})

describe("question definitions", () => {
  it.each([...IMPLEMENTED_STEP_IDS])("%s: ids are unique and every path resolves on empty answers", (stepId) => {
    const content = getStepContent(stepId)!
    const questions = allQuestions(stepId)
    const ids = questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)

    const answers = emptySaca2Answers()
    answers.persons.push(emptySaca2Person())
    for (const q of questions) {
      const path = resolveQuestionPath(content.scope, 1, q.path)
      expect(getAtPath(answers, path), `${stepId}:${q.path}`).not.toBeUndefined()
    }
  })

  it("lists the eligible immigration statuses and document types from form page 32", () => {
    expect(IMMIGRATION_STATUS_OPTIONS.map((o) => o.label)).toContain("Lawful permanent resident")
    expect(IMMIGRATION_DOCUMENT_OPTIONS.map((o) => o.label)).toContain("Foreign passport")
    for (const list of [IMMIGRATION_STATUS_OPTIONS, IMMIGRATION_DOCUMENT_OPTIONS]) {
      expect(new Set(list.map((o) => o.value)).size).toBe(list.length)
      for (const o of list) expect(o.value).toMatch(/^[a-z0-9-]+$/)
    }
  })
})

describe("validateStep: intake", () => {
  it("requires at least one program box", () => {
    const answers = emptySaca2Answers()
    expect(Object.keys(validateStep("intake", answers, ON))).toEqual(["intake.programs.masshealthHsn"])
    answers.intake.programs.longTermCare = true
    expect(validateStep("intake", answers, ON)).toEqual({})
  })
})

describe("validateStep: person1", () => {
  function basicPerson1(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
    const a = emptySaca2Answers()
    const p = a.persons[0]
    p.firstName = "Edna"
    p.lastName = "Testcase"
    p.dateOfBirth = "1950-04-02"
    p.sexAtBirth = "female"
    p.applyingForCoverage = "yes"
    p.noHomeAddress = false
    p.streetAddress = "1 Example St"
    p.city = "Testville"
    p.state = "MA"
    p.zip = "02101"
    p.inInstitution = "no"
    p.mobilePhone = "6175550100"
    p.hasSsn = "no"
    p.noSsnReason = "justApplied"
    p.usCitizenOrNational = "yes"
    p.naturalizedCitizen = "no"
    p.residentOfMassachusetts = "yes"
    p.caregiverOfChildUnder19 = "no"
    p.isLegallyMarried = "no"
    p.hasDisability = "no"
    p.everGotSsi = "no"
    p.hasMedicareOrSsiOrSsdi = "yes"
    p.hasIncome = "no"
    mutate(a)
    return a
  }

  it("flags the required basics on an empty form", () => {
    const errors = validateStep("person1", emptySaca2Answers(), ON)
    for (const key of [
      "persons.0.firstName",
      "persons.0.lastName",
      "persons.0.dateOfBirth",
      "persons.0.sexAtBirth",
      "persons.0.applyingForCoverage",
      "persons.0.inInstitution",
      "persons.0.mobilePhone",
    ]) {
      expect(errors[key], key).toBeDefined()
    }
  })

  it("passes a complete single applicant", () => {
    expect(validateStep("person1", basicPerson1(), ON)).toEqual({})
  })

  it("does not ask for hidden answers: no SSN field when 'no SSN', no mailing when same as street, no immigration when a citizen", () => {
    const errors = validateStep("person1", basicPerson1(), ON)
    expect(errors["persons.0.ssn"]).toBeUndefined()
    expect(errors["persons.0.mailingAddress"]).toBeUndefined()
    expect(errors["persons.0.immigrationStatus"]).toBeUndefined()
  })

  it("requires the SSN (and a valid one) when the person has one", () => {
    const missing = validateStep("person1", basicPerson1((a) => { a.persons[0].hasSsn = "yes" }), ON)
    expect(missing["persons.0.ssn"]).toMatch(/required/i)
    const bad = validateStep("person1", basicPerson1((a) => { a.persons[0].hasSsn = "yes"; a.persons[0].ssn = "12" }), ON)
    expect(bad["persons.0.ssn"]).toMatch(/9-digit/i)
    const good = validateStep("person1", basicPerson1((a) => { a.persons[0].hasSsn = "yes"; a.persons[0].ssn = "123-45-6789" }), ON)
    expect(good["persons.0.ssn"]).toBeUndefined()
  })

  it("requires a mailing address when there is no home address or mailing differs", () => {
    const noHome = validateStep("person1", basicPerson1((a) => { a.persons[0].noHomeAddress = true }), ON)
    expect(noHome["persons.0.mailingAddress"]).toMatch(/required/i)
    expect(noHome["persons.0.streetAddress"]).toBeUndefined()
    const differs = validateStep("person1", basicPerson1((a) => { a.persons[0].mailingSameAsStreet = false }), ON)
    expect(differs["persons.0.mailingAddress"]).toMatch(/required/i)
  })

  it("requires immigration details only for non-citizens with an eligible status", () => {
    const nonCitizen = validateStep("person1", basicPerson1((a) => {
      a.persons[0].usCitizenOrNational = "no"
      a.persons[0].naturalizedCitizen = null
    }), ON)
    expect(nonCitizen["persons.0.hasEligibleImmigrationStatus"]).toMatch(/required/i)
    const eligible = validateStep("person1", basicPerson1((a) => {
      a.persons[0].usCitizenOrNational = "no"
      a.persons[0].naturalizedCitizen = null
      a.persons[0].hasEligibleImmigrationStatus = "yes"
    }), ON)
    expect(eligible["persons.0.immigrationStatus"]).toMatch(/required/i)
    expect(eligible["persons.0.immigrationDocumentType"]).toMatch(/required/i)
  })

  it("rejects a date of birth in the future or before 1900", () => {
    expect(validateStep("person1", basicPerson1((a) => { a.persons[0].dateOfBirth = "2027-01-01" }), ON)["persons.0.dateOfBirth"]).toMatch(/future/i)
    expect(validateStep("person1", basicPerson1((a) => { a.persons[0].dateOfBirth = "1899-12-31" }), ON)["persons.0.dateOfBirth"]).toMatch(/1900/)
  })

  it("only asks for income detail when the person has income", () => {
    const noIncome = validateStep("person1", basicPerson1(), ON)
    expect(noIncome["persons.0.expectedIncomeThisYear"]).toBeUndefined()
    const withIncome = validateStep("person1", basicPerson1((a) => { a.persons[0].hasIncome = "yes" }), ON)
    expect(withIncome["persons.0.income"]).toMatch(/at least one/i)
    expect(withIncome["persons.0.expectedIncomeThisYear"]).toMatch(/required/i)
  })

  it("skips the coverage-only questions when the person is not applying", () => {
    const errors = validateStep("person1", basicPerson1((a) => {
      a.persons[0].applyingForCoverage = "no"
      a.persons[0].hasSsn = null
      a.persons[0].usCitizenOrNational = null
      a.persons[0].residentOfMassachusetts = null
    }), ON)
    expect(errors["persons.0.hasSsn"]).toBeUndefined()
    expect(errors["persons.0.usCitizenOrNational"]).toBeUndefined()
  })
})

describe("validateStep: person2", () => {
  it("also requires the relationship to Person 1 and whether they live together", () => {
    const answers = emptySaca2Answers()
    answers.persons.push(emptySaca2Person())
    const errors = validateStep("person2", answers, ON)
    expect(errors["persons.1.relationshipToPerson1"]).toMatch(/required/i)
    expect(errors["persons.1.livesWithPerson1"]).toMatch(/required/i)
    expect(errors["persons.1.firstName"]).toMatch(/required/i)
  })

  it("does not ask Person 1 for a relationship", () => {
    expect(validateStep("person1", emptySaca2Answers(), ON)["persons.0.relationshipToPerson1"]).toBeUndefined()
  })
})

describe("validateStep: aian, previousBills, signature", () => {
  it("each requires its single answer", () => {
    expect(validateStep("aian", emptySaca2Answers(), ON)["aian.anyMember"]).toMatch(/required/i)
    expect(validateStep("previousBills", emptySaca2Answers(), ON)["previousMedicalBills.hasBills"]).toMatch(/required/i)
    expect(validateStep("signature", emptySaca2Answers(), ON)["signature.signedBy"]).toMatch(/required/i)
  })

  it("returns no errors for steps without content", () => {
    expect(validateStep("assets", emptySaca2Answers(), ON)).toEqual({})
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/questions-content.test.ts`
Expected: FAIL — cannot resolve `@/lib/masshealth/saca2/questions`.

- [ ] **Step 3: Write the immigration option lists**

Create `lib/masshealth/saca2/questions/immigration-options.ts` (source: SACA-2_2026-08 form page 32):

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2Option } from "./types"

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function toOptions(labels: readonly string[]): Saca2Option[] {
  return labels.map((label) => ({ value: slugify(label), label }))
}

/** Eligible immigration statuses (form page 32). */
export const IMMIGRATION_STATUS_OPTIONS: Saca2Option[] = toOptions([
  "Amerasian",
  "Granted asylum",
  "Cuban Haitian entrant",
  "Deportation withheld",
  "Native American born in Canada or non-US territories",
  "Refugee",
  "Victim of severe trafficking or their spouse, child, sibling, or parent",
  "Iraqi special immigrant",
  "Afghan special immigrant or certain Afghan evacuees",
  "Conditional entrant granted before 1980",
  "Veteran or active-duty military or their spouse or dependent",
  "COFA Migrant",
  "Lawful permanent resident",
  "Granted parole for at least one year",
  "Battered spouse or child (or their parent or child)",
  "Nonimmigrant status (visa)",
  "Granted parole for less than one year",
  "Granted temporary resident status",
  "Granted Temporary Protected Status (TPS) or applicant for TPS with employment authorization",
  "Granted employment authorization under 8 CFR 274a(12)(c)",
  "Family unity beneficiaries",
  "Deferred enforced departure",
  "Deferred Action Status except for Deferred Action for Childhood Arrivals (DACA)",
  "Granted an administrative stay of removal under 8 CFR 241",
  "Approved visa petition with a pending application for adjustment of status",
  "Applicant for asylum or for withholding of removal with employment authorization",
  "Applicant (for at least 180 days) under 14 years old for asylum or for withholding of removal",
  "Granted withholding of removal under the Convention Against Torture",
  "Applicant for Special Immigrant Juvenile (SIJ) status",
  "Applicant or granted status under Deferred Action for Childhood Arrivals (DACA)",
  "I have a document but do not have any status listed above (Person Residing Under Color of Law, PRUCOL)",
])

/** Immigration document types (form page 32). */
export const IMMIGRATION_DOCUMENT_OPTIONS: Saca2Option[] = toOptions([
  "Reentry Permit (I-327)",
  "Permanent Resident Card (green card, I-551)",
  "Refugee Travel Document (I-571)",
  "Employment Authorization Card (I-766)",
  "Machine Readable Immigrant Visa (with temporary I-551 language)",
  "Temporary I-551 stamp (on passport or I-94, I-94A)",
  "Arrival/Departure Record (I-94, I-94A)",
  "Arrival/Departure Record in unexpired foreign passport (I-94)",
  "Foreign passport",
  "Certificate of Eligibility for Nonimmigrant Student Status (I-20)",
  "Certificate of Eligibility for Exchange Visitor Status (DS2019)",
  "Notice of Action (I-797)",
  "Document indicating withholding of removal (or withholding of deportation)",
  "Administrative order staying removal issued by the Department of Homeland Security",
  "Document indicating a member of a federally recognized Indian tribe or American Indian born in Canada",
  "Office of Refugee Resettlement (ORR) eligibility letter (if under 18)",
  "Resident of American Samoa Card",
  "USCIS Acknowledgement of Receipt (I-797C)",
  "US Visas (such as B1/B2, R-Visa, Border Crossing Card, J/F/M)",
])
```

- [ ] **Step 4: Write the Person 1 / Person 2 content**

Create `lib/masshealth/saca2/questions/person.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { calculateAge } from "../age"
import {
  checkbox,
  date,
  email,
  money,
  number,
  opts,
  phone,
  repeater,
  select,
  ssn,
  text,
  yesNo,
} from "./builders"
import { IMMIGRATION_DOCUMENT_OPTIONS, IMMIGRATION_STATUS_OPTIONS } from "./immigration-options"
import type { Saca2QuestionContext, Saca2StepContent } from "./types"

const person = (ctx: Saca2QuestionContext) => ctx.answers.persons[ctx.personIndex]
const who = (you: string, they: string) => (ctx: Saca2QuestionContext) => (ctx.personIndex === 0 ? you : they)
const isSecondPerson = (ctx: Saca2QuestionContext) => ctx.personIndex > 0
const applying = (ctx: Saca2QuestionContext) => person(ctx)?.applyingForCoverage === "yes"
const hasHomeAddress = (ctx: Saca2QuestionContext) => !person(ctx)?.noHomeAddress
const needsMailingAddress = (ctx: Saca2QuestionContext) => {
  const p = person(ctx)
  return Boolean(p?.noHomeAddress) || !p?.mailingSameAsStreet
}

const INCOME_KINDS = opts([
  ["wages", "Wages or salary"],
  ["selfEmployment", "Self-employment"],
  ["socialSecurity", "Social Security benefits"],
  ["pension", "Retirement or pension"],
  ["annuity", "Annuities"],
  ["trust", "Trusts"],
  ["unemployment", "Unemployment"],
  ["investment", "Interest, dividends, and other investment income"],
  ["royalty", "Royalty income"],
  ["alimony", "Alimony received"],
  ["veterans", "Federal veteran's benefits"],
  ["militaryRetirement", "Military retirement pay"],
  ["otherTaxable", "Other taxable income"],
  ["rental", "Rental income"],
  ["lottery", "Lottery and gambling winnings"],
])

const INCOME_FREQUENCIES = opts([
  ["weekly", "Weekly"],
  ["every2weeks", "Every 2 weeks"],
  ["twiceMonthly", "Twice a month"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["yearly", "Yearly"],
  ["oneTime", "One time only"],
])

function validateDateOfBirth(value: unknown, ctx: Saca2QuestionContext): string | null {
  if (typeof value !== "string") return null
  if (value < "1900-01-01") return "Enter a date of birth in 1900 or later."
  if (calculateAge(value, ctx.on) === null) return "Date of birth cannot be in the future."
  return null
}

export const PERSON_STEP_CONTENT: Saca2StepContent = {
  scope: "person",
  sections: [
    {
      id: "who",
      title: who("About you", "About this person"),
      questions: [
        text("firstName", "First name", { required: true }),
        text("middleName", "Middle name"),
        text("lastName", "Last name", { required: true }),
        text("suffix", "Suffix (Jr., Sr., III)"),
        date("dateOfBirth", "Date of birth", { required: true, validate: validateDateOfBirth }),
        select("sexAtBirth", who("What was your sex assigned at birth?", "What was this person's sex assigned at birth?"), opts([["male", "Male"], ["female", "Female"]]), {
          required: true,
          help: "This is usually the sex that was originally listed on the birth certificate.",
        }),
        text("relationshipToPerson1", "How is this person related to Person 1?", {
          required: true,
          visibleWhen: isSecondPerson,
        }),
        yesNo("applyingForCoverage", who("Are you applying for health coverage for yourself?", "Is this person applying for health coverage?"), {
          required: true,
          help: "If No, you only need to answer the address, contact, and income questions.",
        }),
      ],
    },
    {
      id: "home",
      title: "Where you live",
      questions: [
        checkbox("noHomeAddress", "No home address (a mailing address is required)"),
        text("streetAddress", "Street address", { required: true, visibleWhen: hasHomeAddress }),
        text("apartment", "Apartment or unit number", { visibleWhen: hasHomeAddress }),
        text("city", "City", { required: true, visibleWhen: hasHomeAddress }),
        text("state", "State", {
          required: true,
          visibleWhen: hasHomeAddress,
          validate: (v) => (/^[A-Za-z]{2}$/.test(String(v)) ? null : "Enter the 2-letter state code."),
        }),
        text("zip", "ZIP code", {
          required: true,
          visibleWhen: hasHomeAddress,
          validate: (v) => (/^\d{5}(-\d{4})?$/.test(String(v)) ? null : "Enter a 5-digit ZIP code."),
        }),
        text("county", "County", { visibleWhen: hasHomeAddress }),
        yesNo("inInstitution", who("Is where you live a hospital, nursing facility, or other institution?", "Is where this person lives a hospital, nursing facility, or other institution?"), {
          required: true,
        }),
        text("facilityName", "Facility name", {
          required: true,
          visibleWhen: (ctx) => person(ctx)?.inInstitution === "yes",
        }),
        checkbox("mailingSameAsStreet", "Mailing address is the same as the street address", { visibleWhen: hasHomeAddress }),
        text("mailingAddress", "Mailing street address", { required: true, visibleWhen: needsMailingAddress }),
        text("mailingApartment", "Mailing apartment or unit number", { visibleWhen: needsMailingAddress }),
        text("mailingCity", "Mailing city", { required: true, visibleWhen: needsMailingAddress }),
        text("mailingState", "Mailing state", {
          required: true,
          visibleWhen: needsMailingAddress,
          validate: (v) => (/^[A-Za-z]{2}$/.test(String(v)) ? null : "Enter the 2-letter state code."),
        }),
        text("mailingZip", "Mailing ZIP code", {
          required: true,
          visibleWhen: needsMailingAddress,
          validate: (v) => (/^\d{5}(-\d{4})?$/.test(String(v)) ? null : "Enter a 5-digit ZIP code."),
        }),
      ],
    },
    {
      id: "contact",
      title: "Contact",
      questions: [
        phone("mobilePhone", "Mobile phone number", { required: (ctx) => ctx.personIndex === 0 }),
        phone("otherPhone", "Other phone number"),
        email("email", "Email address"),
        text("preferredLanguageSpoken", "Preferred spoken language, if not English"),
        text("preferredLanguageWritten", "Preferred written language, if not English", {
          help: "We use your preferred written language to send notices. If you leave this blank, notices are sent in English.",
        }),
      ],
    },
    {
      id: "status",
      title: "Identity, citizenship, and residency",
      questions: [
        yesNo("hasSsn", who("Do you have a Social Security number (SSN)?", "Does this person have a Social Security number (SSN)?"), {
          required: applying,
          visibleWhen: applying,
          help: "An SSN is needed for everyone applying who has one. Exceptions: religious exemption, nonwork-only SSN, or not eligible for an SSN.",
        }),
        ssn("ssn", "Social Security number", {
          required: true,
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.hasSsn === "yes",
        }),
        select(
          "noSsnReason",
          "Why is there no SSN?",
          opts([
            ["illness", "Illness exception"],
            ["justApplied", "Just applied"],
            ["noncitizenException", "Noncitizen exception"],
            ["religiousException", "Religious exception"],
          ]),
          { visibleWhen: (ctx) => applying(ctx) && person(ctx)?.hasSsn === "no" },
        ),
        yesNo("usCitizenOrNational", who("Are you a US citizen or US national?", "Is this person a US citizen or US national?"), {
          required: applying,
          visibleWhen: applying,
        }),
        yesNo("naturalizedCitizen", "Naturalized, derived, or acquired citizen (not born in the US)?", {
          required: true,
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.usCitizenOrNational === "yes",
        }),
        text("alienNumber", "Alien number", {
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.naturalizedCitizen === "yes",
        }),
        text("citizenshipCertificateNumber", "Naturalization or citizenship certificate number", {
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.naturalizedCitizen === "yes",
        }),
        yesNo("hasEligibleImmigrationStatus", "Do they have an eligible immigration status?", {
          required: true,
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.usCitizenOrNational === "no",
        }),
        select("immigrationStatus", "Immigration status", IMMIGRATION_STATUS_OPTIONS, {
          required: true,
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.hasEligibleImmigrationStatus === "yes",
        }),
        select("immigrationDocumentType", "Immigration document type", IMMIGRATION_DOCUMENT_OPTIONS, {
          required: true,
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.hasEligibleImmigrationStatus === "yes",
        }),
        text("immigrationDocumentId", "Document ID number", {
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.hasEligibleImmigrationStatus === "yes",
        }),
        date("immigrationDocumentExpiry", "Document expiration date", {
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.hasEligibleImmigrationStatus === "yes",
        }),
        yesNo("residentOfMassachusetts", who("Do you live in Massachusetts and intend to stay here (even without a fixed address), or did you come for a job or to look for work?", "Does this person live in Massachusetts and intend to stay here (even without a fixed address), or did they come for a job or to look for work?"), {
          required: applying,
          visibleWhen: applying,
          help: "If you are only visiting for pleasure or to receive medical care outside a nursing facility, answer No.",
        }),
        yesNo("caregiverOfChildUnder19", who("Do you live with a child younger than 19 and are you the main person taking care of them?", "Does this person live with a child younger than 19 and are they the main person taking care of them?"), {
          required: applying,
          visibleWhen: applying,
          help: "If Yes, the ACA-3 application may fit better than SACA-2.",
        }),
        yesNo("isLegallyMarried", who("Are you legally married?", "Is this person legally married?"), {
          required: applying,
          visibleWhen: applying,
        }),
        yesNo("livesWithPerson1", "Does this person live with Person 1?", {
          required: isSecondPerson,
          visibleWhen: isSecondPerson,
        }),
        yesNo("hasDisability", who("Do you have a disability (including a disabling mental health condition) that has lasted or is expected to last at least 12 months?", "Does this person have a disability (including a disabling mental health condition) that has lasted or is expected to last at least 12 months?"), {
          required: applying,
          visibleWhen: applying,
          help: "If legally blind, answer Yes.",
        }),
        yesNo("everGotSsi", who("Did you ever get Supplemental Security Income (SSI)?", "Did this person ever get Supplemental Security Income (SSI)?"), {
          required: applying,
          visibleWhen: applying,
        }),
        text("lastSsiMonth", "When did they last get SSI? (mm/yyyy)", {
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.everGotSsi === "yes",
          validate: (v) => (/^(0[1-9]|1[0-2])\/\d{4}$/.test(String(v)) ? null : "Use the format mm/yyyy."),
        }),
        select(
          "livingArrangement",
          "Where do they live?",
          opts([
            ["alone", "Alone"],
            ["withSpouse", "With a spouse"],
            ["restHome", "In a rest home"],
            ["someoneElsesHome", "In someone else's home"],
          ]),
          { visibleWhen: (ctx) => applying(ctx) && person(ctx)?.everGotSsi === "yes" },
        ),
        yesNo("hasMedicareOrSsiOrSsdi", who("Do you get Medicare, SSI, or SSDI?", "Does this person get Medicare, SSI, or SSDI?"), {
          required: applying,
          visibleWhen: applying,
          help: "Not a form question. We use it to tell you which proofs you will need (people who get these usually do not need to prove citizenship and identity again).",
        }),
      ],
    },
    {
      id: "income",
      title: "Income",
      questions: [
        yesNo("hasIncome", who("Do you have any income?", "Does this person have any income?"), { required: true }),
        repeater(
          "income",
          "Income sources",
          {
            questions: [
              select("kind", "Type of income", INCOME_KINDS, { required: true }),
              money("amount", "Amount before taxes ($)", { required: true }),
              select("frequency", "How often", INCOME_FREQUENCIES, { required: true }),
              text("employerNameAndAddress", "Employer name and address", {
                visibleWhen: (ctx) => ctx.item?.kind === "wages",
              }),
              number("hoursPerWeek", "Average hours worked each week", {
                visibleWhen: (ctx) => ctx.item?.kind === "wages" || ctx.item?.kind === "selfEmployment",
              }),
            ],
            emptyItem: () => ({ kind: null, amount: null, frequency: null }),
            addLabel: "Add an income source",
            itemTitle: "Income source",
            maxItems: 15,
          },
          { required: true, visibleWhen: (ctx) => person(ctx)?.hasIncome === "yes" },
        ),
        money("expectedIncomeThisYear", "Total expected income this calendar year ($)", {
          required: true,
          visibleWhen: (ctx) => person(ctx)?.hasIncome === "yes",
        }),
        money("expectedIncomeNextYear", "Total expected income next calendar year, if different ($)", {
          visibleWhen: (ctx) => person(ctx)?.hasIncome === "yes",
        }),
      ],
    },
  ],
}
```

- [ ] **Step 5: Write the root-scope steps**

Create `lib/masshealth/saca2/questions/root-steps.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { calculateAge } from "../age"
import { checkbox, opts, select, yesNo } from "./builders"
import type { Saca2StepContent } from "./types"

export const INTAKE_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "programs",
      title: "What are you applying for?",
      description: "Check every program that applies. MassHealth will check whether anyone on this application is eligible for MassHealth or the Health Safety Net.",
      questions: [
        checkbox("intake.programs.masshealthHsn", "MassHealth or the Health Safety Net (HSN)"),
        checkbox("intake.programs.longTermCare", "Long-term care (nursing home or chronic hospital)"),
        checkbox("intake.programs.hcbsWaiver", "Home- and Community-Based Services (HCBS) Waiver"),
        checkbox("intake.programs.healthConnector", "Health Connector programs"),
        checkbox("intake.applyForSnap", "Also send this application to the Department of Transitional Assistance to apply for SNAP"),
      ],
    },
    {
      id: "screening",
      title: "Which application fits",
      description: "These two questions are not on the printed form. We use them only to check that SACA-2 is the right application.",
      questions: [
        yesNo("screening.disabledAndWorkingQualifies", "Are you disabled and either working 40 or more hours a month, or working now and worked at least 240 hours in the last six months?", {
          visibleWhen: (ctx) => {
            const age = calculateAge(ctx.answers.persons[0]?.dateOfBirth, ctx.on)
            return age === null || age >= 65
          },
        }),
        yesNo("screening.commonHealthTenYears", "Have you received MassHealth CommonHealth for 10 years?", {
          visibleWhen: (ctx) => {
            const age = calculateAge(ctx.answers.persons[0]?.dateOfBirth, ctx.on)
            return age === null || age >= 65
          },
        }),
      ],
    },
  ],
  validateStep: (answers) => {
    const { programs } = answers.intake
    const any = programs.masshealthHsn || programs.longTermCare || programs.hcbsWaiver || programs.healthConnector
    return any ? {} : { "intake.programs.masshealthHsn": "Select at least one program." }
  },
}

export const AIAN_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "aian",
      title: "American Indian or Alaska Native household members",
      questions: [
        yesNo("aian.anyMember", "Are you or is anyone in your household an American Indian or Alaska Native?", {
          required: true,
          help: "If Yes, you will complete Supplement B later.",
        }),
      ],
    },
  ],
}

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
      ],
    },
  ],
}

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
  ],
}
```

- [ ] **Step 6: Write the registry**

Create `lib/masshealth/saca2/questions/index.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2StepId } from "../schema"
import type { Saca2Answers } from "../types"
import { PERSON_STEP_CONTENT } from "./person"
import {
  AIAN_STEP_CONTENT,
  INTAKE_STEP_CONTENT,
  PREVIOUS_BILLS_STEP_CONTENT,
  SIGNATURE_STEP_CONTENT,
} from "./root-steps"
import type { Saca2StepContent } from "./types"
import { validateQuestions } from "./validate"

const CONTENT: Partial<Record<Saca2StepId, Saca2StepContent>> = {
  intake: INTAKE_STEP_CONTENT,
  person1: PERSON_STEP_CONTENT,
  person2: PERSON_STEP_CONTENT,
  aian: AIAN_STEP_CONTENT,
  previousBills: PREVIOUS_BILLS_STEP_CONTENT,
  signature: SIGNATURE_STEP_CONTENT,
}

export const IMPLEMENTED_STEP_IDS: ReadonlySet<Saca2StepId> = new Set(Object.keys(CONTENT) as Saca2StepId[])

export const STEP_TITLES: Record<Saca2StepId, string> = {
  intake: "Programs",
  person1: "Person 1 information",
  person2: "Person 2 information",
  aian: "American Indian or Alaska Native members",
  previousBills: "Previous medical bills",
  assets: "Assets",
  healthInsurance: "Health insurance",
  hra: "Health reimbursement arrangements",
  pca: "Personal-care attendant services",
  additionalCoverage: "Additional coverage for married persons under 65",
  signature: "Who will sign",
  suppA: "Supplement A: Long-term care",
  suppB: "Supplement B: American Indian or Alaska Native",
  suppC: "Supplement C: Personal-care attendant",
  suppD: "Supplement D: Health coverage from jobs",
  ard: "Authorized Representative Designation",
  irs4506: "IRS Form 4506",
}

export function getStepContent(stepId: Saca2StepId): Saca2StepContent | null {
  return CONTENT[stepId] ?? null
}

export function getStepPersonIndex(stepId: Saca2StepId): number {
  return stepId === "person2" ? 1 : 0
}

/** Validate one step; keys are absolute answer paths, `{}` means the step can advance. */
export function validateStep(stepId: Saca2StepId, answers: Saca2Answers, on: Date): Record<string, string> {
  const content = getStepContent(stepId)
  if (!content) return {}
  const personIndex = getStepPersonIndex(stepId)
  const ctx = { answers, personIndex, on }
  const errors: Record<string, string> = {}
  for (const section of content.sections) {
    validateQuestions(section.questions, ctx, content.scope, personIndex, undefined, errors)
  }
  return { ...errors, ...(content.validateStep?.(answers, personIndex) ?? {}) }
}
```

- [ ] **Step 7: Run the tests and the type check**

Run: `npx vitest run lib/masshealth/saca2 && npx tsc --noEmit -p tsconfig.json`
Expected: PASS (including the new content test); no type errors. If an `it.each` path-resolution case fails, the question's `path` does not match a field on `Saca2Person` / `Saca2Answers` — fix the path, not the test.

- [ ] **Step 8: Commit**

```bash
git add lib/masshealth/saca2/questions lib/masshealth/saca2/__tests__/questions-content.test.ts
git commit -m "feat(saca2): add step content for intake, Person 1/2, AI/AN, bills, and signer" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Wizard state, snapshots, and hydration

**Files:**
- Create: `lib/masshealth/saca2/wizard-state.ts`
- Test: `lib/masshealth/saca2/__tests__/wizard-state.test.ts`
- Modify: `lib/db/__tests__/application-drafts-phi-strip.test.ts` (re-add the cap test and import removed in Task 3)

**Interfaces:**
- Consumes: `Saca2Answers`, `emptySaca2Answers`, `emptySaca2Person`, `SACA2_SCHEMA_VERSION` (types); `setAtPath` (Task 1); `IMPLEMENTED_STEP_IDS`, `getStepPersonIndex`-independent helpers (Task 5); `SACA2_STEPS`, `Saca2StepId` (plan 1); `getVisibleSteps` (plan 1); `splitWizardState` from `@/lib/phi-token/token` (test only).
- Produces:
  - `SERVER_DRAFT_MAX_STEP = 9`
  - `interface Saca2WizardState { schemaVersion: "saca2-2026-08"; data: Saca2Answers; currentStepId: Saca2StepId; furthestStepNumber: number; completedSteps: Saca2StepId[]; errors: Record<string,string>; dirty: boolean; phiDirty: boolean }`
  - `type Saca2WizardAction = { type:"hydrate"; payload: Saca2WizardState } | { type:"set_answer"; path: string; value: unknown } | { type:"set_step"; stepId: Saca2StepId } | { type:"mark_complete"; stepId: Saca2StepId } | { type:"set_errors"; errors: Record<string,string> } | { type:"mark_saved" } | { type:"mark_phi_secured" }`
  - `createInitialWizardState(): Saca2WizardState`
  - `saca2WizardReducer(state, action): Saca2WizardState`
  - `getWizardSteps(answers: Saca2Answers, on: Date): Saca2StepId[]` — visible steps that have content
  - `buildSaca2Snapshot(state): Record<string, unknown>` — `{ schemaVersion, currentStepId, currentStep, furthestStepNumber, completedSteps, data, persistedAt }`
  - `normalizeSaca2State(raw: unknown): Saca2WizardState | null`

- [ ] **Step 1: Write the failing test**

Create `lib/masshealth/saca2/__tests__/wizard-state.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { splitWizardState } from "@/lib/phi-token/token"
import { SACA2_STEPS } from "@/lib/masshealth/saca2/schema"
import { SACA2_SCHEMA_VERSION, emptySaca2Answers } from "@/lib/masshealth/saca2/types"
import {
  SERVER_DRAFT_MAX_STEP,
  buildSaca2Snapshot,
  createInitialWizardState,
  getWizardSteps,
  normalizeSaca2State,
  saca2WizardReducer,
} from "@/lib/masshealth/saca2/wizard-state"

const ON = new Date("2026-10-13T12:00:00Z")

describe("createInitialWizardState", () => {
  it("starts on intake with nothing dirty", () => {
    const s = createInitialWizardState()
    expect(s.currentStepId).toBe("intake")
    expect(s.furthestStepNumber).toBe(1)
    expect(s.dirty).toBe(false)
    expect(s.phiDirty).toBe(false)
    expect(s.schemaVersion).toBe(SACA2_SCHEMA_VERSION)
  })
})

describe("saca2WizardReducer", () => {
  it("set_answer updates the value immutably, clears that path's error, and marks both dirty flags", () => {
    const s0 = { ...createInitialWizardState(), errors: { "persons.0.firstName": "required", other: "x" } }
    const s1 = saca2WizardReducer(s0, { type: "set_answer", path: "persons.0.firstName", value: "Ada" })
    expect(s1.data.persons[0].firstName).toBe("Ada")
    expect(s0.data.persons[0].firstName).toBe("")
    expect(s1.errors).toEqual({ other: "x" })
    expect(s1.dirty).toBe(true)
    expect(s1.phiDirty).toBe(true)
  })

  it("set_step to person2 creates Person 2 once", () => {
    const s1 = saca2WizardReducer(createInitialWizardState(), { type: "set_step", stepId: "person2" })
    expect(s1.data.persons).toHaveLength(2)
    expect(s1.currentStepId).toBe("person2")
    const s2 = saca2WizardReducer(s1, { type: "set_step", stepId: "person1" })
    const s3 = saca2WizardReducer(s2, { type: "set_step", stepId: "person2" })
    expect(s3.data.persons).toHaveLength(2)
  })

  it("set_step never lowers the furthest step and clears errors", () => {
    let s = createInitialWizardState()
    s = saca2WizardReducer(s, { type: "set_step", stepId: "signature" })
    const furthest = s.furthestStepNumber
    expect(furthest).toBe(SACA2_STEPS.findIndex((x) => x.id === "signature") + 1)
    s = saca2WizardReducer({ ...s, errors: { a: "b" } }, { type: "set_step", stepId: "person1" })
    expect(s.furthestStepNumber).toBe(furthest)
    expect(s.errors).toEqual({})
  })

  it("mark_complete is idempotent", () => {
    let s = createInitialWizardState()
    s = saca2WizardReducer(s, { type: "mark_complete", stepId: "intake" })
    s = saca2WizardReducer(s, { type: "mark_complete", stepId: "intake" })
    expect(s.completedSteps).toEqual(["intake"])
  })

  it("mark_saved and mark_phi_secured clear only their own flag", () => {
    let s = saca2WizardReducer(createInitialWizardState(), { type: "set_answer", path: "persons.0.firstName", value: "A" })
    s = saca2WizardReducer(s, { type: "mark_saved" })
    expect(s.dirty).toBe(false)
    expect(s.phiDirty).toBe(true)
    s = saca2WizardReducer(s, { type: "mark_phi_secured" })
    expect(s.phiDirty).toBe(false)
  })

  it("hydrate replaces the state", () => {
    const hydrated = { ...createInitialWizardState(), currentStepId: "aian" as const }
    expect(saca2WizardReducer(createInitialWizardState(), { type: "hydrate", payload: hydrated }).currentStepId).toBe("aian")
  })
})

describe("getWizardSteps", () => {
  it("returns only visible steps that have content", () => {
    const answers = emptySaca2Answers()
    expect(getWizardSteps(answers, ON)).toEqual(["intake", "person1", "aian", "previousBills", "signature"])
    answers.persons[0].isLegallyMarried = "yes"
    expect(getWizardSteps(answers, ON)).toContain("person2")
  })
})

describe("buildSaca2Snapshot", () => {
  it("keeps the server draft step within 1..9 and equal to the furthest step when small", () => {
    let s = createInitialWizardState()
    expect(buildSaca2Snapshot(s).currentStep).toBe(1)
    s = saca2WizardReducer(s, { type: "set_step", stepId: "signature" })
    expect(buildSaca2Snapshot(s).currentStep).toBe(SERVER_DRAFT_MAX_STEP)
  })

  it("does not decrease when the user steps back", () => {
    let s = saca2WizardReducer(createInitialWizardState(), { type: "set_step", stepId: "aian" })
    const forward = buildSaca2Snapshot(s).currentStep as number
    s = saca2WizardReducer(s, { type: "set_step", stepId: "intake" })
    expect(buildSaca2Snapshot(s).currentStep).toBe(forward)
    expect(buildSaca2Snapshot(s).currentStepId).toBe("intake")
  })

  it("leaves only intake and signature after the PHI split", () => {
    let s = saca2WizardReducer(createInitialWizardState(), { type: "set_answer", path: "persons.0.firstName", value: "Ada" })
    s = saca2WizardReducer(s, { type: "set_answer", path: "persons.0.ssn", value: "123456789" })
    s = saca2WizardReducer(s, { type: "set_answer", path: "intake.programs.longTermCare", value: true })
    const { safeState, phiPayload } = splitWizardState(buildSaca2Snapshot(s))
    expect(Object.keys((safeState as { data: object }).data).sort()).toEqual(["intake", "signature"])
    expect(JSON.stringify(safeState)).not.toMatch(/Ada|123456789/)
    expect(JSON.stringify(phiPayload)).toMatch(/Ada/)
  })

  it("has no error or dirty flags", () => {
    const snap = buildSaca2Snapshot({ ...createInitialWizardState(), errors: { a: "b" }, dirty: true })
    expect(snap).not.toHaveProperty("errors")
    expect(snap).not.toHaveProperty("dirty")
    expect(typeof snap.persistedAt).toBe("string")
  })
})

describe("normalizeSaca2State", () => {
  it("round-trips a snapshot", () => {
    let s = saca2WizardReducer(createInitialWizardState(), { type: "set_answer", path: "persons.0.firstName", value: "Ada" })
    s = saca2WizardReducer(s, { type: "set_step", stepId: "aian" })
    const back = normalizeSaca2State(buildSaca2Snapshot(s))
    expect(back?.data.persons[0].firstName).toBe("Ada")
    expect(back?.currentStepId).toBe("aian")
    expect(back?.dirty).toBe(false)
    expect(back?.phiDirty).toBe(false)
  })

  it("rejects garbage, other schema versions, and missing data", () => {
    expect(normalizeSaca2State(null)).toBeNull()
    expect(normalizeSaca2State("x")).toBeNull()
    expect(normalizeSaca2State({})).toBeNull()
    expect(normalizeSaca2State({ schemaVersion: "saca2-2025-01", data: {} })).toBeNull()
  })

  it("fills missing keys, keeps a PHI-free server draft usable, and drops unknown step ids", () => {
    const serverDraft = {
      schemaVersion: SACA2_SCHEMA_VERSION,
      currentStepId: "not-a-step",
      furthestStepNumber: 3,
      completedSteps: ["intake", "bogus"],
      data: { intake: { programs: { longTermCare: true } }, signature: { signedBy: "applicant" } },
    }
    const s = normalizeSaca2State(serverDraft)!
    expect(s.currentStepId).toBe("intake")
    expect(s.completedSteps).toEqual(["intake"])
    expect(s.data.intake.programs.longTermCare).toBe(true)
    expect(s.data.intake.programs.masshealthHsn).toBe(false)
    expect(s.data.persons).toHaveLength(1)
    expect(s.data.persons[0].state).toBe("MA")
    expect(s.data.supplements.a.needsNursingFacility).toBeNull()
    expect(s.furthestStepNumber).toBe(3)
  })

  it("merges partial persons onto defaults and keeps a second person", () => {
    const s = normalizeSaca2State({
      schemaVersion: SACA2_SCHEMA_VERSION,
      data: { persons: [{ firstName: "A" }, { firstName: "B" }] },
    })!
    expect(s.data.persons).toHaveLength(2)
    expect(s.data.persons[1].firstName).toBe("B")
    expect(s.data.persons[1].mailingSameAsStreet).toBe(true)
  })

  it("keeps free-form maps such as asset gates and daily-living activities", () => {
    const s = normalizeSaca2State({
      schemaVersion: SACA2_SCHEMA_VERSION,
      data: {
        assets: { gates: { bankAccounts: "yes", trusts: "no" } },
        supplements: { c: { activities: { eating: { needsHandsOnHelp: "yes", timesPerDay: 3, daysPerWeek: 7 } } } },
      },
    })!
    expect(s.data.assets.gates).toEqual({ bankAccounts: "yes", trusts: "no" })
    expect(s.data.supplements.c.activities.eating?.timesPerDay).toBe(3)
  })

  it("never lets a hostile payload add prototype keys", () => {
    const hostile = JSON.parse(
      `{"schemaVersion":"${SACA2_SCHEMA_VERSION}","data":{"__proto__":{"polluted":true},"persons":[{"__proto__":{"polluted":true}}]}}`,
    )
    normalizeSaca2State(hostile)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/wizard-state.test.ts`
Expected: FAIL — cannot resolve `@/lib/masshealth/saca2/wizard-state`.

- [ ] **Step 3: Write the implementation**

Create `lib/masshealth/saca2/wizard-state.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { setAtPath } from "./answer-paths"
import { IMPLEMENTED_STEP_IDS } from "./questions"
import { SACA2_STEPS, type Saca2StepId } from "./schema"
import {
  SACA2_SCHEMA_VERSION,
  emptySaca2Answers,
  emptySaca2Person,
  type Saca2Answers,
} from "./types"
import { getVisibleSteps } from "./visibility"

/** Mirrors MAX_APPLICATION_DRAFT_STEP in lib/db/application-drafts.ts (a test keeps them equal). */
export const SERVER_DRAFT_MAX_STEP = 9

export interface Saca2WizardState {
  schemaVersion: typeof SACA2_SCHEMA_VERSION
  data: Saca2Answers
  currentStepId: Saca2StepId
  /** 1-based position (in SACA2_STEPS order) of the furthest step ever reached. */
  furthestStepNumber: number
  completedSteps: Saca2StepId[]
  errors: Record<string, string>
  /** Changes not yet autosaved to the server (PHI-free snapshot). */
  dirty: boolean
  /** Changes not yet secured by Save & Exit (encrypted PHI blob). */
  phiDirty: boolean
}

export type Saca2WizardAction =
  | { type: "hydrate"; payload: Saca2WizardState }
  | { type: "set_answer"; path: string; value: unknown }
  | { type: "set_step"; stepId: Saca2StepId }
  | { type: "mark_complete"; stepId: Saca2StepId }
  | { type: "set_errors"; errors: Record<string, string> }
  | { type: "mark_saved" }
  | { type: "mark_phi_secured" }

const STEP_ID_SET: ReadonlySet<string> = new Set(SACA2_STEPS.map((step) => step.id))

function stepNumber(stepId: Saca2StepId): number {
  return SACA2_STEPS.findIndex((step) => step.id === stepId) + 1
}

export function createInitialWizardState(): Saca2WizardState {
  return {
    schemaVersion: SACA2_SCHEMA_VERSION,
    data: emptySaca2Answers(),
    currentStepId: "intake",
    furthestStepNumber: 1,
    completedSteps: [],
    errors: {},
    dirty: false,
    phiDirty: false,
  }
}

export function saca2WizardReducer(state: Saca2WizardState, action: Saca2WizardAction): Saca2WizardState {
  switch (action.type) {
    case "hydrate":
      return action.payload
    case "set_answer": {
      const errors = { ...state.errors }
      delete errors[action.path]
      return {
        ...state,
        data: setAtPath(state.data, action.path, action.value),
        errors,
        dirty: true,
        phiDirty: true,
      }
    }
    case "set_step": {
      const addPerson = action.stepId === "person2" && state.data.persons.length < 2
      return {
        ...state,
        data: addPerson ? { ...state.data, persons: [...state.data.persons, emptySaca2Person()] } : state.data,
        currentStepId: action.stepId,
        furthestStepNumber: Math.max(state.furthestStepNumber, stepNumber(action.stepId)),
        errors: {},
        dirty: true,
        phiDirty: state.phiDirty || addPerson,
      }
    }
    case "mark_complete":
      return state.completedSteps.includes(action.stepId)
        ? state
        : { ...state, completedSteps: [...state.completedSteps, action.stepId], dirty: true }
    case "set_errors":
      return { ...state, errors: action.errors }
    case "mark_saved":
      return { ...state, dirty: false }
    case "mark_phi_secured":
      return { ...state, phiDirty: false }
  }
}

/** Visible steps that have question content (steps without content are added in later plans). */
export function getWizardSteps(answers: Saca2Answers, on: Date): Saca2StepId[] {
  return getVisibleSteps(answers, on).filter((id) => IMPLEMENTED_STEP_IDS.has(id))
}

/**
 * Snapshot written to the server (after the PHI split) and to the encrypted blob.
 * `currentStep` is the furthest step reached, capped for the draft route, so a save
 * after stepping back never looks like a regression to the server's progress guard.
 */
export function buildSaca2Snapshot(state: Saca2WizardState): Record<string, unknown> {
  return {
    schemaVersion: SACA2_SCHEMA_VERSION,
    currentStepId: state.currentStepId,
    currentStep: Math.min(SERVER_DRAFT_MAX_STEP, Math.max(1, state.furthestStepNumber)),
    furthestStepNumber: state.furthestStepNumber,
    completedSteps: state.completedSteps,
    data: state.data,
    persistedAt: new Date().toISOString(),
  }
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function safeEntries(value: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(value).filter(([key]) => !FORBIDDEN_KEYS.has(key))
}

/** Recursively overlay `raw` onto `base`, keeping base's shape; arrays are replaced wholesale. */
function overlay<T>(base: T, raw: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(raw)) return base
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of safeEntries(raw)) {
    if (!(key in base)) continue
    const baseValue = (base as Record<string, unknown>)[key]
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      // An empty base object is a free-form map (e.g. assets.gates, supplements.c.activities):
      // keep the incoming keys instead of filtering them against an empty shape.
      out[key] =
        Object.keys(baseValue).length === 0
          ? Object.fromEntries(safeEntries(value))
          : overlay(baseValue, value)
    } else if (Array.isArray(baseValue) === Array.isArray(value) || value === null) {
      out[key] = value
    }
  }
  return out as T
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
  return { ...merged, persons: persons.length > 0 ? persons : base.persons }
}

export function normalizeSaca2State(raw: unknown): Saca2WizardState | null {
  if (!isPlainObject(raw) || raw.schemaVersion !== SACA2_SCHEMA_VERSION || !isPlainObject(raw.data)) {
    return null
  }

  const currentStepId =
    typeof raw.currentStepId === "string" && STEP_ID_SET.has(raw.currentStepId)
      ? (raw.currentStepId as Saca2StepId)
      : "intake"
  const completedSteps = Array.isArray(raw.completedSteps)
    ? raw.completedSteps.filter((id): id is Saca2StepId => typeof id === "string" && STEP_ID_SET.has(id))
    : []
  const furthest =
    typeof raw.furthestStepNumber === "number" && Number.isInteger(raw.furthestStepNumber) && raw.furthestStepNumber >= 1
      ? Math.min(raw.furthestStepNumber, SACA2_STEPS.length)
      : stepNumber(currentStepId)

  return {
    schemaVersion: SACA2_SCHEMA_VERSION,
    data: normalizeAnswers(raw.data),
    currentStepId,
    furthestStepNumber: Math.max(furthest, stepNumber(currentStepId)),
    completedSteps,
    errors: {},
    dirty: false,
    phiDirty: false,
  }
}
```

- [ ] **Step 4: Run the test and the type check**

Run: `npx vitest run lib/masshealth/saca2/__tests__/wizard-state.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS; no type errors. (`splitWizardState` is imported from `@/lib/phi-token/token`, which only calls browser crypto inside functions this test does not call, so it loads under jsdom.)

- [ ] **Step 5: Pin the client/server draft step cap**

In `lib/db/__tests__/application-drafts-phi-strip.test.ts` change the `application-drafts` import to `import { MAX_APPLICATION_DRAFT_STEP, upsertApplicationDraft } from "@/lib/db/application-drafts"`, add `import { SERVER_DRAFT_MAX_STEP } from "@/lib/masshealth/saca2/wizard-state"` right after it, and add this test inside the `describe`:

```ts
  it("keeps the client and server draft step caps in sync", () => {
    expect(SERVER_DRAFT_MAX_STEP).toBe(MAX_APPLICATION_DRAFT_STEP)
  })
```

Run: `npx vitest run lib/db/__tests__/application-drafts-phi-strip.test.ts lib/masshealth/saca2`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/masshealth/saca2/wizard-state.ts lib/masshealth/saca2/__tests__/wizard-state.test.ts lib/db/__tests__/application-drafts-phi-strip.test.ts
git commit -m "feat(saca2): add wizard reducer, snapshots, and hydration normalization" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Field and step-form components

**Files:**
- Create: `components/application/saca2/saca2-field.tsx`
- Create: `components/application/saca2/saca2-step-form.tsx`
- Test: `components/application/saca2/__tests__/saca2-step-form.test.tsx`

**Interfaces:**
- Consumes: `Saca2Question`, `Saca2QuestionContext`, `resolveText`, `isQuestionVisible`, `resolveQuestionPath` (Task 4); `getStepContent`, `getStepPersonIndex` (Task 5); `getAtPath` (Task 1); `Saca2Answers`; `Input`, `Label`, `Button` from `@/components/ui`.
- Produces:
  - `Saca2Field` props: `{ id: string; question: Saca2Question; label: string; help?: string; value: unknown; error?: string; onChange: (value: unknown) => void }`
  - `Saca2StepForm` props: `{ stepId: Saca2StepId; answers: Saca2Answers; personIndex: number; errors: Record<string, string>; onChange: (path: string, value: unknown) => void; on?: Date }` — renders every visible section/question for the step; `onChange` receives absolute answer paths.
  - Accessible names: yes/no group is a `group` named by the question label with radios "Yes"/"No"; each field's error is `role="alert"` and linked via `aria-describedby`.

- [ ] **Step 1: Write the failing test**

Create `components/application/saca2/__tests__/saca2-step-form.test.tsx`:

```tsx
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Saca2StepForm } from "@/components/application/saca2/saca2-step-form"
import { emptySaca2Answers, emptySaca2Person } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function renderForm(overrides: {
  stepId?: "intake" | "person1" | "person2" | "aian"
  answers?: ReturnType<typeof emptySaca2Answers>
  errors?: Record<string, string>
  onChange?: (path: string, value: unknown) => void
  personIndex?: number
} = {}) {
  const onChange = overrides.onChange ?? vi.fn()
  render(
    <Saca2StepForm
      stepId={overrides.stepId ?? "person1"}
      answers={overrides.answers ?? emptySaca2Answers()}
      personIndex={overrides.personIndex ?? 0}
      errors={overrides.errors ?? {}}
      onChange={onChange}
      on={ON}
    />,
  )
  return onChange
}

describe("Saca2StepForm: person step", () => {
  it("reports typed text with the absolute answer path", async () => {
    const onChange = renderForm()
    await userEvent.type(screen.getByLabelText("First name"), "A")
    expect(onChange).toHaveBeenLastCalledWith("persons.0.firstName", "A")
  })

  it("uses Person 2 wording and paths for the second person", async () => {
    const answers = emptySaca2Answers()
    answers.persons.push(emptySaca2Person())
    const onChange = renderForm({ stepId: "person2", personIndex: 1, answers })
    expect(screen.getByRole("group", { name: /is this person applying for health coverage/i })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("First name"), "B")
    expect(onChange).toHaveBeenLastCalledWith("persons.1.firstName", "B")
    expect(screen.getByLabelText(/related to person 1/i)).toBeInTheDocument()
  })

  it("answers yes/no with radios inside a labelled group", async () => {
    const onChange = renderForm()
    const group = screen.getByRole("group", { name: /are you applying for health coverage for yourself/i })
    await userEvent.click(within(group).getByRole("radio", { name: "Yes" }))
    expect(onChange).toHaveBeenLastCalledWith("persons.0.applyingForCoverage", "yes")
  })

  it("hides questions whose condition is not met and shows them when it is", () => {
    renderForm()
    expect(screen.queryByLabelText("Social Security number")).not.toBeInTheDocument()
    const answers = emptySaca2Answers()
    answers.persons[0].applyingForCoverage = "yes"
    answers.persons[0].hasSsn = "yes"
    renderForm({ answers })
    expect(screen.getByLabelText("Social Security number")).toBeInTheDocument()
  })

  it("parses money into a number and blank into null", async () => {
    // The form is controlled and the test's onChange does not update props, so each
    // interaction starts from the value 5 and is checked on its own.
    const answers = emptySaca2Answers()
    answers.persons[0].hasIncome = "yes"
    answers.persons[0].expectedIncomeThisYear = 5
    const onChange = renderForm({ answers })
    const field = screen.getByLabelText(/total expected income this calendar year/i)
    await userEvent.type(field, "1")
    expect(onChange).toHaveBeenLastCalledWith("persons.0.expectedIncomeThisYear", 51)
    await userEvent.clear(field)
    expect(onChange).toHaveBeenLastCalledWith("persons.0.expectedIncomeThisYear", null)
  })

  it("shows an error with role=alert linked to its field", () => {
    renderForm({ errors: { "persons.0.firstName": "This question is required." } })
    const input = screen.getByLabelText("First name")
    expect(input).toHaveAttribute("aria-invalid", "true")
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("This question is required.")
    expect(input.getAttribute("aria-describedby")).toContain(alert.id)
  })

  it("renders a select with its options and reports the chosen value", async () => {
    const onChange = renderForm()
    await userEvent.selectOptions(screen.getByLabelText(/sex assigned at birth/i), "female")
    expect(onChange).toHaveBeenLastCalledWith("persons.0.sexAtBirth", "female")
  })

  it("reports checkbox changes as booleans", async () => {
    const onChange = renderForm()
    await userEvent.click(screen.getByLabelText(/no home address/i))
    expect(onChange).toHaveBeenLastCalledWith("persons.0.noHomeAddress", true)
  })
})

describe("Saca2StepForm: income repeater", () => {
  function withIncome(items: unknown[]) {
    const answers = emptySaca2Answers()
    answers.persons[0].hasIncome = "yes"
    ;(answers.persons[0].income as unknown[]) = items
    return answers
  }

  it("adds an income item with the configured empty item", async () => {
    const onChange = renderForm({ answers: withIncome([]) })
    await userEvent.click(screen.getByRole("button", { name: "Add an income source" }))
    expect(onChange).toHaveBeenLastCalledWith("persons.0.income", [{ kind: null, amount: null, frequency: null }])
  })

  it("edits one item by absolute path and removes an item", async () => {
    const onChange = renderForm({
      answers: withIncome([
        { kind: "wages", amount: 5, frequency: "monthly" },
        { kind: "pension", amount: 7, frequency: "monthly" },
      ]),
    })
    const amounts = screen.getAllByLabelText(/amount before taxes/i)
    expect(amounts).toHaveLength(2)
    await userEvent.type(amounts[1], "1")
    expect(onChange).toHaveBeenLastCalledWith("persons.0.income.1.amount", 71)

    await userEvent.click(screen.getByRole("button", { name: "Remove Income source 1" }))
    expect(onChange).toHaveBeenLastCalledWith("persons.0.income", [{ kind: "pension", amount: 7, frequency: "monthly" }])
  })

  it("shows employer fields only for wages", () => {
    renderForm({
      answers: withIncome([
        { kind: "wages", amount: 5, frequency: "monthly" },
        { kind: "pension", amount: 7, frequency: "monthly" },
      ]),
    })
    expect(screen.getAllByLabelText(/employer name and address/i)).toHaveLength(1)
  })

  it("stops offering Add at the maximum number of items", () => {
    const items = Array.from({ length: 15 }, () => ({ kind: "wages", amount: 1, frequency: "monthly" }))
    renderForm({ answers: withIncome(items) })
    expect(screen.queryByRole("button", { name: "Add an income source" })).not.toBeInTheDocument()
  })
})

describe("Saca2StepForm: root steps", () => {
  it("intake checkboxes write to their absolute paths", async () => {
    const onChange = renderForm({ stepId: "intake" })
    await userEvent.click(screen.getByLabelText(/long-term care \(nursing home/i))
    expect(onChange).toHaveBeenLastCalledWith("intake.programs.longTermCare", true)
  })

  it("renders nothing for a step without content", () => {
    const { container } = render(
      <Saca2StepForm stepId="assets" answers={emptySaca2Answers()} personIndex={0} errors={{}} onChange={vi.fn()} on={ON} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/application/saca2/__tests__/saca2-step-form.test.tsx`
Expected: FAIL — cannot resolve `@/components/application/saca2/saca2-step-form`.

- [ ] **Step 3: Write `Saca2Field`**

Create `components/application/saca2/saca2-field.tsx`:

```tsx
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Saca2Question } from "@/lib/masshealth/saca2/questions/types"

interface Saca2FieldProps {
  id: string
  question: Saca2Question
  label: string
  help?: string
  value: unknown
  error?: string
  onChange: (value: unknown) => void
}

const SELECT_CLASS =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function asString(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value)
}

function parseNumber(raw: string): number | null {
  if (raw.trim() === "") return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function Saca2Field({ id, question, label, help, value, error, onChange }: Saca2FieldProps) {
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined

  const message = (
    <>
      {help ? (
        <p id={helpId} className="text-sm text-muted-foreground">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </>
  )

  if (question.kind === "yesNo") {
    return (
      <fieldset className="space-y-2" aria-describedby={describedBy}>
        <legend className="text-sm font-medium">{label}</legend>
        <div className="flex gap-6">
          {(["yes", "no"] as const).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={id}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
              />
              {option === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
        {message}
      </fieldset>
    )
  }

  if (question.kind === "checkbox") {
    return (
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <input
            id={id}
            type="checkbox"
            className="mt-1"
            checked={value === true}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{label}</span>
        </label>
        {message}
      </div>
    )
  }

  if (question.kind === "select") {
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <select
          id={id}
          className={SELECT_CLASS}
          value={asString(value)}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        >
          <option value="">Select…</option>
          {question.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {message}
      </div>
    )
  }

  const isNumeric = question.kind === "money" || question.kind === "number"
  const inputType =
    question.kind === "date" ? "date" : isNumeric ? "number" : question.kind === "email" ? "email" : "text"

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={inputType}
        value={asString(value)}
        {...(isNumeric ? { min: 0, step: question.kind === "money" ? "0.01" : "1", inputMode: "decimal" as const } : {})}
        {...(question.kind === "ssn" ? { inputMode: "numeric" as const, autoComplete: "off", maxLength: 11 } : {})}
        {...(question.kind === "phone" ? { inputMode: "tel" as const, autoComplete: "tel" } : {})}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(isNumeric ? parseNumber(event.target.value) : event.target.value)}
      />
      {message}
    </div>
  )
}
```

- [ ] **Step 4: Write `Saca2StepForm`**

Create `components/application/saca2/saca2-step-form.tsx`:

```tsx
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { Button } from "@/components/ui/button"
import { getAtPath } from "@/lib/masshealth/saca2/answer-paths"
import { getStepContent } from "@/lib/masshealth/saca2/questions"
import {
  isQuestionVisible,
  resolveQuestionPath,
  resolveText,
  type Saca2Question,
  type Saca2QuestionContext,
} from "@/lib/masshealth/saca2/questions/types"
import type { Saca2StepId } from "@/lib/masshealth/saca2/schema"
import type { Saca2Answers } from "@/lib/masshealth/saca2/types"
import { Saca2Field } from "./saca2-field"

interface Saca2StepFormProps {
  stepId: Saca2StepId
  answers: Saca2Answers
  personIndex: number
  errors: Record<string, string>
  onChange: (path: string, value: unknown) => void
  /** Reference date for age-based rules; defaults to now. */
  on?: Date
}

export function Saca2StepForm({ stepId, answers, personIndex, errors, onChange, on }: Saca2StepFormProps) {
  const content = getStepContent(stepId)
  if (!content) return null

  const ctx: Saca2QuestionContext = { answers, personIndex, on: on ?? new Date() }

  const renderQuestion = (question: Saca2Question) => {
    if (!isQuestionVisible(question, ctx)) return null
    const path = resolveQuestionPath(content.scope, personIndex, question.path)
    const label = resolveText(question.label, ctx)
    const help = question.help ? resolveText(question.help, ctx) : undefined

    if (question.kind === "repeater" && question.repeater) {
      const config = question.repeater
      const raw = getAtPath(answers, path)
      const items = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []
      return (
        <fieldset key={question.id} className="space-y-3">
          <legend className="text-sm font-medium">{label}</legend>
          {help ? <p className="text-sm text-muted-foreground">{help}</p> : null}
          {errors[path] ? (
            <p role="alert" className="text-sm text-destructive">
              {errors[path]}
            </p>
          ) : null}
          {items.map((item, index) => {
            const itemCtx: Saca2QuestionContext = { ...ctx, item }
            return (
              <div key={index} className="space-y-3 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">
                    {config.itemTitle} {index + 1}
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Remove ${config.itemTitle} ${index + 1}`}
                    onClick={() =>
                      onChange(
                        path,
                        items.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
                {config.questions.map((itemQuestion) => {
                  if (!isQuestionVisible(itemQuestion, itemCtx)) return null
                  const itemPath = `${path}.${index}.${itemQuestion.path}`
                  return (
                    <Saca2Field
                      key={itemQuestion.id}
                      id={itemPath}
                      question={itemQuestion}
                      label={resolveText(itemQuestion.label, itemCtx)}
                      help={itemQuestion.help ? resolveText(itemQuestion.help, itemCtx) : undefined}
                      value={item[itemQuestion.path]}
                      error={errors[itemPath]}
                      onChange={(value) => onChange(itemPath, value)}
                    />
                  )
                })}
              </div>
            )
          })}
          {items.length < config.maxItems ? (
            <Button type="button" variant="outline" onClick={() => onChange(path, [...items, config.emptyItem()])}>
              {config.addLabel}
            </Button>
          ) : null}
        </fieldset>
      )
    }

    return (
      <Saca2Field
        key={question.id}
        id={path}
        question={question}
        label={label}
        help={help}
        value={getAtPath(answers, path)}
        error={errors[path]}
        onChange={(value) => onChange(path, value)}
      />
    )
  }

  return (
    <div className="space-y-8">
      {content.sections.map((section) => {
        const rendered = section.questions.map(renderQuestion).filter(Boolean)
        if (rendered.length === 0) return null
        return (
          <section key={section.id} className="space-y-4">
            <h3 className="text-lg font-semibold">{resolveText(section.title, ctx)}</h3>
            {section.description ? (
              <p className="text-sm text-muted-foreground">{resolveText(section.description, ctx)}</p>
            ) : null}
            {rendered}
          </section>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Run the tests, type check, and lint**

Run: `npx vitest run components/application/saca2/__tests__/saca2-step-form.test.tsx && npx tsc --noEmit -p tsconfig.json && npx eslint components/application/saca2 lib/masshealth/saca2`
Expected: PASS, no type errors, no lint errors. If `Button` rejects `size="sm"` or `variant="outline"`, open `components/ui/button.tsx` and use the variant/size names it actually exports.

- [ ] **Step 6: Commit**

```bash
git add components/application/saca2/saca2-field.tsx components/application/saca2/saca2-step-form.tsx components/application/saca2/__tests__/saca2-step-form.test.tsx
git commit -m "feat(saca2): add accessible field and step-form renderer" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Feature flag route and hook

**Files:**
- Create: `lib/masshealth/saca2/flag.ts`
- Create: `app/api/config/saca2/route.ts`
- Create: `components/application/saca2/use-saca2-enabled.ts`
- Test: `lib/masshealth/saca2/__tests__/flag.test.ts`
- Test: `app/api/config/saca2/__tests__/route.test.ts`
- Test: `components/application/saca2/__tests__/use-saca2-enabled.test.tsx`

**Interfaces:**
- Produces:
  - `isSaca2Enabled(env?: Record<string, string | undefined>): boolean` — true only for `"true"` or `"1"` (trimmed, case-insensitive) in `SACA2_ENABLED`.
  - `GET /api/config/saca2` → `200 { enabled: boolean }` with `Cache-Control: no-store`.
  - `useSaca2Enabled(active: boolean): boolean | null` — `null` while loading or when `active` is false; `false` on any fetch failure (fails closed).

- [ ] **Step 1: Write the failing tests**

Create `lib/masshealth/saca2/__tests__/flag.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { isSaca2Enabled } from "@/lib/masshealth/saca2/flag"

describe("isSaca2Enabled", () => {
  it("is on only for true or 1", () => {
    expect(isSaca2Enabled({ SACA2_ENABLED: "true" })).toBe(true)
    expect(isSaca2Enabled({ SACA2_ENABLED: " TRUE " })).toBe(true)
    expect(isSaca2Enabled({ SACA2_ENABLED: "1" })).toBe(true)
  })

  it("is off when unset, empty, or anything else", () => {
    expect(isSaca2Enabled({})).toBe(false)
    expect(isSaca2Enabled({ SACA2_ENABLED: "" })).toBe(false)
    expect(isSaca2Enabled({ SACA2_ENABLED: "false" })).toBe(false)
    expect(isSaca2Enabled({ SACA2_ENABLED: "yes" })).toBe(false)
    expect(isSaca2Enabled({ SACA2_ENABLED: "0" })).toBe(false)
  })
})
```

Create `app/api/config/saca2/__tests__/route.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/config/saca2/route"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("GET /api/config/saca2", () => {
  it("reports disabled by default and is not cacheable", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ enabled: false })
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("reports enabled when SACA2_ENABLED=true at request time", async () => {
    vi.stubEnv("SACA2_ENABLED", "true")
    expect(await (await GET()).json()).toEqual({ enabled: true })
  })
})
```

Create `components/application/saca2/__tests__/use-saca2-enabled.test.tsx`:

```tsx
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSaca2Enabled } from "@/components/application/saca2/use-saca2-enabled"

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useSaca2Enabled", () => {
  it("does not fetch while inactive", () => {
    const { result } = renderHook(() => useSaca2Enabled(false))
    expect(result.current).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns the server's answer once active", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ enabled: true }) })
    const { result } = renderHook(() => useSaca2Enabled(true))
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith("/api/config/saca2", expect.objectContaining({ cache: "no-store" }))
  })

  it("fails closed on a network error, a non-OK status, or a malformed body", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"))
    const a = renderHook(() => useSaca2Enabled(true))
    await waitFor(() => expect(a.result.current).toBe(false))

    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ enabled: true }) })
    const b = renderHook(() => useSaca2Enabled(true))
    await waitFor(() => expect(b.result.current).toBe(false))

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: "true" }) })
    const c = renderHook(() => useSaca2Enabled(true))
    await waitFor(() => expect(c.result.current).toBe(false))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/masshealth/saca2/__tests__/flag.test.ts app/api/config components/application/saca2/__tests__/use-saca2-enabled.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementation**

Create `lib/masshealth/saca2/flag.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * SACA-2 rollout flag. Read at request time (not build time) so flipping the
 * environment variable needs a restart, not a rebuild. Off unless explicitly "true" or "1".
 */
export function isSaca2Enabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.SACA2_ENABLED?.trim().toLowerCase()
  return value === "true" || value === "1"
}
```

Create `app/api/config/saca2/route.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { NextResponse } from "next/server"
import { isSaca2Enabled } from "@/lib/masshealth/saca2/flag"

export const dynamic = "force-dynamic"

/** Public, non-sensitive rollout flag for the SACA-2 wizard. */
export async function GET() {
  return NextResponse.json({ enabled: isSaca2Enabled() }, { headers: { "Cache-Control": "no-store" } })
}
```

Create `components/application/saca2/use-saca2-enabled.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { useEffect, useState } from "react"

/**
 * Whether the SACA-2 wizard is enabled. `null` while inactive or loading;
 * `false` on any failure (fails closed: the notice is shown, never the wizard).
 */
export function useSaca2Enabled(active: boolean): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    fetch("/api/config/saca2", { cache: "no-store", signal: AbortSignal.timeout(6_000) })
      .then(async (res) => {
        if (!res.ok) return false
        const body = (await res.json()) as { enabled?: unknown }
        return body.enabled === true
      })
      .catch(() => false)
      .then((value) => {
        if (!cancelled) setEnabled(value)
      })
    return () => {
      cancelled = true
    }
  }, [active])

  return active ? enabled : null
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/masshealth/saca2/__tests__/flag.test.ts app/api/config components/application/saca2/__tests__/use-saca2-enabled.test.tsx`
Expected: PASS.

- [ ] **Step 5: Document the variable**

Append to `.env.example`:

```bash
cat >> .env.example <<'EOF'

# ── SACA-2 (seniors / long-term care) application ─────────────────────────────
# Runtime flag (read per request, no rebuild needed). Keep false until every SACA-2
# step ships; true shows the online wizard instead of the "not available yet" notice.
SACA2_ENABLED=false
EOF
```

- [ ] **Step 6: Commit**

```bash
git add lib/masshealth/saca2/flag.ts lib/masshealth/saca2/__tests__/flag.test.ts app/api/config components/application/saca2/use-saca2-enabled.ts components/application/saca2/__tests__/use-saca2-enabled.test.tsx .env.example
git commit -m "feat(saca2): add runtime SACA2_ENABLED flag route and hook" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The wizard container (hydrate, autosave, navigate, Save & Exit)

**Files:**
- Create: `components/application/saca2/saca2-wizard.tsx`
- Modify: `components/application/phi-save-exit-dialog.tsx` (widen the `wizardState` prop type)
- Test: `components/application/saca2/__tests__/saca2-wizard.test.tsx`

**Interfaces:**
- Consumes: `saca2WizardReducer`, `createInitialWizardState`, `getWizardSteps`, `buildSaca2Snapshot`, `normalizeSaca2State` (Task 6); `validateStep`, `getStepPersonIndex`, `STEP_TITLES` (Task 5); `Saca2StepForm` (Task 7); `splitWizardState` (`@/lib/phi-token/token`); `restorePhiDraftState` (`@/lib/phi-token/restore`); `PhiSaveExitDialog`, `PhiResumePrompt` (`@/components/application/phi-save-exit-dialog`); `WizardLayout` (`@/components/application/wizard-layout`); `authenticatedFetch`.
- Produces: `Saca2Wizard({ applicationId: string; actingForPatientId?: string })`. Root element has `data-testid="saca2-wizard"`.

Behavior contract:
- On mount, `GET /api/applications/{id}/draft` (with `X-Acting-For-Patient` when given). Hydrate from `draftState` via `normalizeSaca2State`; `null` → fresh state. If `record.phiDraftResumeId` is set: with `record.phiDraftKeyEnc` try `restorePhiDraftState` (auto-restore) and on failure — or without a server key — show `PhiResumePrompt`. A failed GET still lets the user start a fresh form.
- Autosave: when `dirty`, debounce 700 ms, `PUT /api/applications/{id}/draft` with `{ applicationType: "saca2", wizardState: safeState }` where `safeState = splitWizardState(buildSaca2Snapshot(state)).safeState`. Skip the PUT when the safe snapshot (excluding `persistedAt`) is unchanged since the last successful save. On HTTP ≥500 or 429, back off 15 s. Success → `mark_saved`.
- Next: validate the current step (`validateStep`); with errors → `set_errors` and stay; otherwise `mark_complete` and go to the next visible step; on the last step, open the Save & Exit dialog instead.
- Back: previous visible step. Save & Exit: opens `PhiSaveExitDialog`; on success the dialog calls `onExit` → `mark_phi_secured` and navigate to `/customer/dashboard` (or the social-worker patient applications page when `actingForPatientId` is set).
- While `phiDirty`, register a `beforeunload` handler.

- [ ] **Step 1: Widen the dialog prop type**

In `components/application/phi-save-exit-dialog.tsx`, change `wizardState: WizardState` in `PhiSaveExitDialogProps` to:

```ts
  /** Any wizard state with a `data` object (ACA-3 WizardState or a SACA-2 snapshot). */
  wizardState: object
```

If `WizardState` is no longer referenced anywhere else in that file, remove its import. Inside the component the existing code already does `{ ...wizardState, errors: {}, persistedAt: ... }` and casts to `Record<string, unknown>`, so no other change is needed.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (the ACA-3 `FormWizard` still passes its `WizardState`, which is assignable to `object`).

- [ ] **Step 2: Write the failing test**

Create `components/application/saca2/__tests__/saca2-wizard.test.tsx`:

```tsx
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  restorePhiDraftState: vi.fn(),
  push: vi.fn(),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({ authenticatedFetch: mocks.authenticatedFetch }))
vi.mock("@/lib/phi-token/restore", () => ({ restorePhiDraftState: mocks.restorePhiDraftState }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, back: vi.fn() }) }))
vi.mock("@/components/application/phi-save-exit-dialog", () => ({
  PhiSaveExitDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="save-exit-dialog" /> : null),
  PhiResumePrompt: ({ onSkip, onRestored }: { onSkip: () => void; onRestored: (s: Record<string, unknown>) => void }) => (
    <div data-testid="resume-prompt">
      <button type="button" onClick={onSkip}>skip-resume</button>
      <button
        type="button"
        onClick={() =>
          onRestored({
            schemaVersion: "saca2-2026-08",
            currentStepId: "person1",
            data: { persons: [{ firstName: "Restored" }] },
          })
        }
      >
        restore-resume
      </button>
    </div>
  ),
}))

import { Saca2Wizard } from "@/components/application/saca2/saca2-wizard"

const APP_ID = "88cbe518-ea42-476b-a8e9-12207573ff2c"

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

function draftGet(body: unknown) {
  return ok(body)
}

function putBodies(): Array<{ wizardState: Record<string, unknown>; applicationType: string }> {
  return mocks.authenticatedFetch.mock.calls
    .filter(([, init]) => (init as { method?: string } | undefined)?.method === "PUT")
    .map(([, init]) => JSON.parse(String((init as { body: string }).body)))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
    if (init?.method === "PUT") return ok({ ok: true })
    return draftGet({ ok: false })
  })
})

describe("Saca2Wizard: navigation and validation", () => {
  it("starts on the programs step and blocks Next until a program is chosen", async () => {
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByTestId("saca2-wizard")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "What are you applying for?" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/select at least one program/i)
    expect(screen.getByRole("heading", { name: "What are you applying for?" })).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText(/MassHealth or the Health Safety Net/i))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(await screen.findByRole("heading", { name: "About you" })).toBeInTheDocument()
  })

  it("goes Back without validating", async () => {
    render(<Saca2Wizard applicationId={APP_ID} />)
    await userEvent.click(await screen.findByLabelText(/MassHealth or the Health Safety Net/i))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await screen.findByRole("heading", { name: "About you" })
    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(await screen.findByRole("heading", { name: "What are you applying for?" })).toBeInTheDocument()
  })

  it("opens Save & Exit from the header action", async () => {
    render(<Saca2Wizard applicationId={APP_ID} />)
    await screen.findByTestId("saca2-wizard")
    await userEvent.click(screen.getAllByRole("button", { name: /save (&|and) exit/i })[0])
    expect(await screen.findByTestId("save-exit-dialog")).toBeInTheDocument()
  })
})

describe("Saca2Wizard: PHI-safe autosave", () => {
  // Real timers: autosave debounces for 700 ms, so these tests wait on the clock.
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  it("never sends typed PHI or PHI keys to the server draft", async () => {
    render(<Saca2Wizard applicationId={APP_ID} />)
    await userEvent.click(await screen.findByLabelText(/Long-term care \(nursing home/i))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await screen.findByRole("heading", { name: "About you" })
    await userEvent.type(screen.getByLabelText("First name"), "Ada")

    await waitFor(() => expect(putBodies().length).toBeGreaterThan(0), { timeout: 3_000 })
    await sleep(900)

    for (const body of putBodies()) {
      const raw = JSON.stringify(body)
      expect(raw).not.toMatch(/Ada/)
      expect(body.applicationType).toBe("saca2")
      const data = (body.wizardState as { data: Record<string, unknown> }).data
      for (const phiKey of ["persons", "assets", "screening", "aian", "health", "pca", "supplements", "transfers", "previousMedicalBills"]) {
        expect(data).not.toHaveProperty(phiKey)
      }
      const step = body.wizardState.currentStep as number
      expect(Number.isInteger(step) && step >= 1 && step <= 9).toBe(true)
    }
    const last = putBodies().at(-1)!
    expect((last.wizardState.data as { intake: { programs: { longTermCare: boolean } } }).intake.programs.longTermCare).toBe(true)
  })

  it("does not re-send an unchanged PHI-free snapshot when only PHI fields change", async () => {
    render(<Saca2Wizard applicationId={APP_ID} />)
    await userEvent.click(await screen.findByLabelText(/Long-term care \(nursing home/i))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await screen.findByRole("heading", { name: "About you" })
    await waitFor(() => expect(putBodies().length).toBeGreaterThan(0), { timeout: 3_000 })
    await sleep(900)

    const before = putBodies().length
    await userEvent.type(screen.getByLabelText("First name"), "Ada")
    await sleep(1_200)
    expect(putBodies().length).toBe(before)
  })
})

describe("Saca2Wizard: hydration and PHI resume", () => {
  it("resumes the saved step from a PHI-free server draft", async () => {
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      return draftGet({
        ok: true,
        record: { phiDraftResumeId: null, phiDraftKeyEnc: null },
        draftState: {
          schemaVersion: "saca2-2026-08",
          currentStepId: "aian",
          furthestStepNumber: 4,
          completedSteps: ["intake"],
          data: { intake: { programs: { longTermCare: true } } },
        },
      })
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByRole("heading", { name: "American Indian or Alaska Native household members" })).toBeInTheDocument()
  })

  it("shows the resume prompt when a PHI blob exists and no server key is held", async () => {
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      return draftGet({
        ok: true,
        record: { phiDraftResumeId: "11111111-1111-4111-8111-111111111111", phiDraftKeyEnc: null },
        draftState: { schemaVersion: "saca2-2026-08", currentStepId: "person1", data: {} },
      })
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByTestId("resume-prompt")).toBeInTheDocument()
    expect(mocks.restorePhiDraftState).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "restore-resume" }))
    expect(await screen.findByDisplayValue("Restored")).toBeInTheDocument()
    expect(screen.queryByTestId("resume-prompt")).not.toBeInTheDocument()
  })

  it("auto-restores PHI when the server holds the key, and falls back to the prompt if that fails", async () => {
    const withKey = async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      return draftGet({
        ok: true,
        record: { phiDraftResumeId: "11111111-1111-4111-8111-111111111111", phiDraftKeyEnc: "enc" },
        draftState: { schemaVersion: "saca2-2026-08", currentStepId: "person1", data: {} },
      })
    }
    mocks.authenticatedFetch.mockImplementation(withKey)
    mocks.restorePhiDraftState.mockResolvedValueOnce({
      schemaVersion: "saca2-2026-08",
      currentStepId: "person1",
      data: { persons: [{ firstName: "Auto" }] },
    })
    const first = render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByDisplayValue("Auto")).toBeInTheDocument()
    first.unmount()

    mocks.restorePhiDraftState.mockRejectedValueOnce(new Error("key unavailable"))
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByTestId("resume-prompt")).toBeInTheDocument()
  })

  it("starts a fresh form when the draft request fails or the draft is from another schema version", async () => {
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      throw new Error("offline")
    })
    const failed = render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByRole("heading", { name: "What are you applying for?" })).toBeInTheDocument()
    failed.unmount()

    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      return draftGet({ ok: true, record: {}, draftState: { schemaVersion: "old", data: {} } })
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByRole("heading", { name: "What are you applying for?" })).toBeInTheDocument()
  })

  it("sends the acting-for-patient header on the draft request", async () => {
    render(<Saca2Wizard applicationId={APP_ID} actingForPatientId="patient-9" />)
    await screen.findByTestId("saca2-wizard")
    const get = mocks.authenticatedFetch.mock.calls.find(([, init]) => (init as { method?: string }).method === "GET")
    expect((get?.[1] as { headers?: Record<string, string> }).headers?.["X-Acting-For-Patient"]).toBe("patient-9")
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run components/application/saca2/__tests__/saca2-wizard.test.tsx`
Expected: FAIL — cannot resolve `@/components/application/saca2/saca2-wizard`.

- [ ] **Step 4: Write the wizard**

Create `components/application/saca2/saca2-wizard.tsx`:

```tsx
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { PhiResumePrompt, PhiSaveExitDialog } from "@/components/application/phi-save-exit-dialog"
import { WizardLayout } from "@/components/application/wizard-layout"
import { Button } from "@/components/ui/button"
import { getStepPersonIndex, STEP_TITLES, validateStep } from "@/lib/masshealth/saca2/questions"
import {
  buildSaca2Snapshot,
  createInitialWizardState,
  getWizardSteps,
  normalizeSaca2State,
  saca2WizardReducer,
} from "@/lib/masshealth/saca2/wizard-state"
import { restorePhiDraftState } from "@/lib/phi-token/restore"
import { splitWizardState } from "@/lib/phi-token/token"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { Saca2StepForm } from "./saca2-step-form"

interface Saca2WizardProps {
  applicationId: string
  actingForPatientId?: string
}

interface PendingResume {
  resumeId: string
  hasServerKey: boolean
  serverState: Record<string, unknown>
}

const AUTOSAVE_DELAY_MS = 700
const FAILURE_BACKOFF_MS = 15_000

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function Saca2Wizard({ applicationId, actingForPatientId }: Saca2WizardProps) {
  const router = useRouter()
  const [state, dispatch] = useReducer(saca2WizardReducer, undefined, createInitialWizardState)
  const [hydrated, setHydrated] = useState(false)
  const [pendingResume, setPendingResume] = useState<PendingResume | null>(null)
  const [saveExitOpen, setSaveExitOpen] = useState(false)

  const stateRef = useRef(state)
  const backoffUntilRef = useRef(0)
  const lastSavedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const headers = useMemo(() => {
    const h: Record<string, string> = {}
    if (actingForPatientId) h["X-Acting-For-Patient"] = actingForPatientId
    return h
  }, [actingForPatientId])

  // ── Hydrate from the server draft (PHI-free) and the encrypted PHI blob ──
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      let draftState: unknown = null
      let resumeId: string | null = null
      let hasServerKey = false

      try {
        const response = await authenticatedFetch(`/api/applications/${encodeURIComponent(applicationId)}/draft`, {
          method: "GET",
          cache: "no-store",
          headers,
        })
        if (response.ok) {
          const payload = (await response.json()) as {
            draftState?: unknown
            record?: { phiDraftResumeId?: string | null; phiDraftKeyEnc?: string | null }
          }
          draftState = payload.draftState ?? null
          resumeId = payload.record?.phiDraftResumeId ?? null
          hasServerKey = Boolean(payload.record?.phiDraftKeyEnc)
        }
      } catch {
        // Fall through to a fresh form; autosave will create the draft.
      }

      let restored: Record<string, unknown> | null = null
      if (resumeId) {
        const base = toRecord(draftState)
        if (hasServerKey) {
          try {
            restored = await restorePhiDraftState({
              applicationId,
              resumeId,
              serverState: base,
              actingForPatientId,
            })
          } catch {
            restored = null
          }
        }
        if (!restored && !cancelled) {
          setPendingResume({ resumeId, hasServerKey, serverState: base })
        }
      }

      if (cancelled) return
      const normalized = normalizeSaca2State(restored ?? draftState)
      if (normalized) {
        dispatch({ type: "hydrate", payload: normalized })
        stateRef.current = normalized
      }
      setHydrated(true)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [applicationId, actingForPatientId, headers])

  // ── Autosave the PHI-free snapshot ──
  const saveDraftNow = useCallback(async (): Promise<boolean> => {
    if (Date.now() < backoffUntilRef.current) return false

    const { safeState } = splitWizardState(buildSaca2Snapshot(stateRef.current))
    const comparable = { ...safeState } as Record<string, unknown>
    delete comparable.persistedAt
    const key = JSON.stringify(comparable)
    if (key === lastSavedKeyRef.current) {
      dispatch({ type: "mark_saved" })
      return true
    }

    try {
      const response = await authenticatedFetch(`/api/applications/${encodeURIComponent(applicationId)}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ applicationType: "saca2", wizardState: safeState }),
      })
      if (!response.ok) {
        if (response.status >= 500 || response.status === 429) {
          backoffUntilRef.current = Date.now() + FAILURE_BACKOFF_MS
        }
        return false
      }
      backoffUntilRef.current = 0
      lastSavedKeyRef.current = key
      dispatch({ type: "mark_saved" })
      return true
    } catch {
      backoffUntilRef.current = Date.now() + FAILURE_BACKOFF_MS
      return false
    }
  }, [applicationId, headers])

  useEffect(() => {
    if (!hydrated || !state.dirty) return
    const timer = window.setTimeout(() => {
      void saveDraftNow()
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [hydrated, state, saveDraftNow])

  // ── Warn before leaving with PHI that has not been secured ──
  useEffect(() => {
    if (!state.phiDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [state.phiDirty])

  // ── Navigation ──
  const stepIds = useMemo(() => getWizardSteps(state.data, new Date()), [state.data])
  const currentIndex = Math.max(0, stepIds.indexOf(state.currentStepId))
  const isLastStep = currentIndex === stepIds.length - 1
  const personIndex = getStepPersonIndex(state.currentStepId)

  const handleNext = useCallback(() => {
    const errors = validateStep(state.currentStepId, state.data, new Date())
    if (Object.keys(errors).length > 0) {
      dispatch({ type: "set_errors", errors })
      return
    }
    dispatch({ type: "mark_complete", stepId: state.currentStepId })
    if (isLastStep) {
      setSaveExitOpen(true)
      return
    }
    dispatch({ type: "set_step", stepId: stepIds[currentIndex + 1] })
  }, [state.currentStepId, state.data, isLastStep, stepIds, currentIndex])

  const handleBack = useCallback(() => {
    if (currentIndex > 0) dispatch({ type: "set_step", stepId: stepIds[currentIndex - 1] })
  }, [currentIndex, stepIds])

  const onResumeRestored = useCallback((merged: Record<string, unknown>) => {
    const normalized = normalizeSaca2State(merged)
    if (normalized) dispatch({ type: "hydrate", payload: normalized })
    setPendingResume(null)
  }, [])

  const layoutSteps = stepIds.map((id, index) => ({
    id,
    title: STEP_TITLES[id],
    completed: state.completedSteps.includes(id),
    current: index === currentIndex,
  }))

  const exitHref = actingForPatientId
    ? `/social-worker/patients/${encodeURIComponent(actingForPatientId)}/applications`
    : "/customer/dashboard"

  if (!hydrated) {
    return <div data-testid="saca2-loading" className="p-6 text-sm text-muted-foreground">Loading your application…</div>
  }

  return (
    <div data-testid="saca2-wizard">
      <WizardLayout
        steps={layoutSteps}
        currentStep={currentIndex + 1}
        title={STEP_TITLES[state.currentStepId]}
        contentClassName="max-w-3xl"
        onSaveAndExit={() => setSaveExitOpen(true)}
      >
        <div className="space-y-6">
          {pendingResume ? (
            <PhiResumePrompt
              applicationId={applicationId}
              resumeId={pendingResume.resumeId}
              hasServerKey={pendingResume.hasServerKey}
              actingForPatientId={actingForPatientId}
              serverState={pendingResume.serverState}
              onRestored={onResumeRestored}
              onSkip={() => setPendingResume(null)}
            />
          ) : null}

          <Saca2StepForm
            stepId={state.currentStepId}
            answers={state.data}
            personIndex={personIndex}
            errors={state.errors}
            onChange={(path, value) => dispatch({ type: "set_answer", path, value })}
          />

          <div className="flex items-center justify-between gap-3">
            {currentIndex > 0 ? (
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setSaveExitOpen(true)}>
                Save &amp; Exit
              </Button>
              <Button type="button" onClick={handleNext}>
                {isLastStep ? "Finish" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </WizardLayout>

      <PhiSaveExitDialog
        open={saveExitOpen}
        applicationId={applicationId}
        wizardState={buildSaca2Snapshot(state)}
        actingForPatientId={actingForPatientId}
        onBeforeSecureSave={() => saveDraftNow()}
        onExit={() => {
          setSaveExitOpen(false)
          dispatch({ type: "mark_phi_secured" })
          router.push(exitHref)
        }}
        onCancel={() => setSaveExitOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Step 5: Run the test, type check, and lint**

Run: `npx vitest run components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint components/application/saca2 components/application/phi-save-exit-dialog.tsx`
Expected: PASS; no type errors; no lint errors. Two things to check if something fails:
- The "Next"/"Finish" label: the Save & Exit test and navigation tests look up a button named `Next`; the intake and person steps are not last, so they render `Next`.
- `WizardLayout` may render its own "Save & Exit" control in the header; the test uses `getAllByRole(...)[0]`, which tolerates one or two.

- [ ] **Step 6: Run the ACA-3 wizard and dialog suites to confirm the prop change broke nothing**

Run: `npx vitest run components/application`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/application/saca2/saca2-wizard.tsx components/application/saca2/__tests__/saca2-wizard.test.tsx components/application/phi-save-exit-dialog.tsx
git commit -m "feat(saca2): add wizard container with PHI-safe autosave, resume, and Save & Exit" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Dispatch from `/application/new`, spec update, and full verification

**Files:**
- Modify: `app/application/new/page.tsx`
- Modify: `app/application/new/__tests__/new-application-page.test.tsx`
- Modify: `docs/superpowers/specs/2026-10-13-saca2-application-design.md`

**Interfaces:**
- Consumes: `useIsSaca2Application` (plan 1), `Saca2UnavailableNotice` (plan 1), `useSaca2Enabled` (Task 8), `Saca2Wizard` (Task 9).
- Produces: for a SACA-2 draft the page renders: nothing while the flag loads; the wizard when the flag is on; the plan-1 notice when it is off or the flag check failed.

- [ ] **Step 1: Write the failing tests**

In `app/application/new/__tests__/new-application-page.test.tsx`:

1. Add two entries to the `vi.hoisted(() => ({ ... }))` object:

```tsx
  useSaca2Enabled: vi.fn(),
  saca2Wizard: vi.fn(() => <div data-testid="saca2-wizard" />),
```

2. After the existing `vi.mock("@/lib/supabase/authenticated-fetch", ...)` block add:

```tsx
vi.mock("@/components/application/saca2/use-saca2-enabled", () => ({
  useSaca2Enabled: mocks.useSaca2Enabled,
}))

vi.mock("@/components/application/saca2/saca2-wizard", () => ({
  Saca2Wizard: mocks.saca2Wizard,
}))
```

3. In the `beforeEach`, after the `authenticatedFetch.mockResolvedValue(...)` call, add:

```tsx
    mocks.useSaca2Enabled.mockReturnValue(false)
```

4. Append inside the `describe`, before its closing `})`:

```tsx
  it("shows the SACA-2 wizard instead of the notice when the flag is on", async () => {
    mocks.useSaca2Enabled.mockReturnValue(true)
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams({ applicationId: "app-saca", patientId: "patient-7" }),
    )

    renderPage((store) =>
      store.dispatch(createApplication({ applicationId: "app-saca", applicationType: "saca2" })),
    )

    expect(await screen.findByTestId("saca2-wizard")).toBeInTheDocument()
    expect(mocks.saca2Wizard.mock.calls.at(-1)?.[0]).toMatchObject({
      applicationId: "app-saca",
      actingForPatientId: "patient-7",
    })
    expect(screen.queryByTestId("saca2-unavailable")).not.toBeInTheDocument()
    expect(mocks.intakeChat).not.toHaveBeenCalled()
    expect(mocks.formWizard).not.toHaveBeenCalled()
  })

  it("shows nothing for a SACA-2 draft while the flag is still loading", async () => {
    mocks.useSaca2Enabled.mockReturnValue(null)
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-saca" }))

    renderPage((store) =>
      store.dispatch(createApplication({ applicationId: "app-saca", applicationType: "saca2" })),
    )

    expect(screen.queryByTestId("saca2-wizard")).not.toBeInTheDocument()
    expect(screen.queryByTestId("saca2-unavailable")).not.toBeInTheDocument()
    expect(mocks.intakeChat).not.toHaveBeenCalled()
  })

  it("only asks for the flag when the draft is a SACA-2", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-aca3" }))

    renderPage((store) =>
      store.dispatch(createApplication({ applicationId: "app-aca3", applicationType: "aca3" })),
    )

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(mocks.useSaca2Enabled).toHaveBeenCalledWith(false)
  })
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run app/application/new`
Expected: the three new tests FAIL (the page does not call `useSaca2Enabled` and never renders the wizard); the existing tests still PASS.

- [ ] **Step 3: Wire the page**

In `app/application/new/page.tsx`:

1. Add imports next to the existing SACA-2 imports:

```tsx
import { Saca2Wizard } from "@/components/application/saca2/saca2-wizard"
import { useSaca2Enabled } from "@/components/application/saca2/use-saca2-enabled"
```

2. Immediately after the line `const saca2Lookup = useIsSaca2Application(...)` add:

```tsx
  const saca2Enabled = useSaca2Enabled(saca2Lookup === "saca2")
```

3. Replace the existing `if (saca2Lookup === "saca2") { ... }` block with:

```tsx
  if (saca2Lookup === "saca2") {
    if (saca2Enabled === null) {
      return <div className="container mx-auto px-4 py-6" />
    }

    if (saca2Enabled) {
      return (
        <Saca2Wizard
          applicationId={queryApplicationId as string}
          actingForPatientId={actingForPatientId}
        />
      )
    }

    return (
      <div className="container mx-auto space-y-4 px-4 py-6">
        <h1 className="text-xl font-semibold text-foreground">SACA-2 Application</h1>
        <Saca2UnavailableNotice />
      </div>
    )
  }
```

`queryApplicationId` is defined whenever `saca2Lookup === "saca2"` (the lookup returns `"other"` without an application id), so the cast is safe; keep the `useSaca2Enabled` call above every early return so hook order is stable.

- [ ] **Step 4: Run the page tests, then the full verification**

Run: `npx vitest run app/application/new`
Expected: PASS (all, including the plan-1 SACA-2 notice tests, which still see the flag mock return `false`).

Run the full suite and checks:

```bash
npx vitest run && npx tsc --noEmit -p tsconfig.json && npx eslint app/application components/application lib/masshealth/saca2 lib/phi-token app/api/config
```

Expected: every test file passes; `tsc` and `eslint` print no errors.

- [ ] **Step 5: Update the spec**

In `docs/superpowers/specs/2026-10-13-saca2-application-design.md`:

1. In §4.7 (Rollout), replace the first sentence about a `saca2_enabled` flag seeded into `public.feature_flags` with: `Rollout flag: runtime env var `SACA2_ENABLED` (off by default), exposed to the client by the public route `GET /api/config/saca2` and the `useSaca2Enabled` hook. The unused `public.feature_flags` table is not used. A failed flag lookup fails closed to the notice.`
2. In §7 (Open items) replace item 2 with: `2. ~~Feature-flag reader~~ — resolved: env var `SACA2_ENABLED` + `GET /api/config/saca2` (plan 2, Task 8). Deploy workflows (`.github/workflows/deploy-staging.yml`, `deploy-prod.yml`) must pass `SACA2_ENABLED` to turn it on; leave it unset or `false` until Phase 1b ships.`
3. In §4.3 (Persistence) append: `Implemented in Phase 1: all answer keys except intake and signature are PHI (SACA2_PHI_KEYS); the server strip and the client split share one list (lib/phi-token/phi-fields.ts). PHI is held in memory only (no localStorage copy, unlike ACA-3) until Save & Exit writes the encrypted blob. The server draft `currentStep` is the furthest step reached, capped at 9, because the draft route accepts only 1–9 and never lowers stored progress.`
4. In §6 (Build order) replace the Phase 1 row with: `| 1 | `Saca2Wizard`, step renderer, question model/validation, flag, PHI-safe save/resume for: intake, Person 1/2, AI/AN, previous bills, who-signs (plan `2026-10-13-saca2-wizard-core.md`). **1b**: remaining question content (assets and other repeaters, transfers, health insurance, HRA, PCA, Step 9, Supplements A–D, ARD, IRS 4506, optional demographics, tax/Health Connector questions, deductions). The flag stays off until 1b ships. |`

Run: `grep -n "SACA2_ENABLED\|furthest step" docs/superpowers/specs/2026-10-13-saca2-application-design.md`
Expected: the new lines appear.

- [ ] **Step 6: Commit**

```bash
git add app/application/new/page.tsx app/application/new/__tests__/new-application-page.test.tsx docs/superpowers/specs/2026-10-13-saca2-application-design.md
git commit -m "feat(saca2): route SACA-2 drafts to the wizard behind SACA2_ENABLED" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Manual check after Task 10 (optional, needs a logged-in dev session)

1. Set `SACA2_ENABLED=true` in `.env.local`, restart the dev server, pick **SACA-2** on `/application/type`, and walk intake → Person 1 → AI/AN → previous bills → who-signs.
2. In the browser network panel confirm the `PUT .../draft` bodies contain only `intake`/`signature` under `data`.
3. Use Save & Exit, reload the page, and confirm the resume prompt (or auto-restore) brings Person 1's answers back.
4. Set `SACA2_ENABLED=false`, restart, reload: the notice returns.

## Deployment note (not part of this plan's tasks)

`SACA2_ENABLED` is read from the server environment. To turn the wizard on in staging or production, add it to the deploy workflows' environment lists (`.github/workflows/deploy-staging.yml` near line 149, `deploy-prod.yml` near line 156) and to the Docker/compose environment. Leave it off until plan 2b ships.
