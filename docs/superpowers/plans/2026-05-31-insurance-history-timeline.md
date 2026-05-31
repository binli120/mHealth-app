# Insurance History Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a vertical insurance history timeline that shows users why their coverage changed year-over-year, surfacing data from platform applications, self-reported entries, and uploaded documents.

**Architecture:** Server Component page at `/customer/insurance-history` fetches all coverage records and generates/serves cached hybrid (rules + LLM) transition explanations. A summary card on the dashboard links to it. API routes handle self-reported CRUD; document extraction reuses the existing `document-analysis-client`.

**Tech Stack:** Next.js 14 App Router (Server Components), PostgreSQL via `getDbPool()`, Supabase auth via `requireAuthenticatedUser`, Vitest unit tests, Playwright E2E with page objects, shadcn/ui Card + Sheet, Lucide icons.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260531000001_insurance_history.sql` | Create | DB tables: `insurance_coverage_records`, `insurance_explanations` |
| `lib/db/insurance-history.ts` | Create | All DB queries for both tables |
| `lib/insurance-history/explanation-engine.ts` | Create | Rules engine + LLM fallback for transition explanations |
| `lib/insurance-history/__tests__/explanation-engine.test.ts` | Create | Unit tests for explanation engine |
| `lib/insurance-history/types.ts` | Create | Shared TypeScript types |
| `app/api/insurance-history/records/route.ts` | Create | POST (create), GET (list) |
| `app/api/insurance-history/records/[id]/route.ts` | Create | PUT (update), DELETE |
| `app/api/insurance-history/explain/route.ts` | Create | POST — on-demand explanation for a new record pair |
| `components/insurance-history/insurance-summary-card.tsx` | Create | Dashboard card: current plan + teaser + link |
| `components/insurance-history/insurance-timeline.tsx` | Create | Vertical timeline wrapper |
| `components/insurance-history/timeline-entry.tsx` | Create | Single year node |
| `components/insurance-history/coverage-form.tsx` | Create | Drawer for add/edit self-reported record |
| `app/customer/insurance-history/page.tsx` | Create | Server Component — fetches + passes data |
| `app/customer/insurance-history/loading.tsx` | Create | Skeleton state |
| `app/customer/dashboard/page.tsx` | Modify | Add `<InsuranceSummaryCard>` |
| `lib/db/application-drafts.ts` | Modify | Call `autoPopulateCoverageRecord` after status → `decided` |
| `e2e/pages/insurance-history.page.ts` | Create | Page object for E2E |
| `e2e/tests/17-insurance-history.spec.ts` | Create | E2E tests |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260531000001_insurance_history.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260531000001_insurance_history.sql

CREATE TABLE IF NOT EXISTS public.insurance_coverage_records (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coverage_year    INT           NOT NULL CHECK (coverage_year >= 1990 AND coverage_year <= 2100),
  plan_name        TEXT          NOT NULL,
  program_code     TEXT,
  premium_monthly  NUMERIC(10,2) CHECK (premium_monthly IS NULL OR premium_monthly >= 0),
  household_size   INT           CHECK (household_size IS NULL OR household_size >= 1),
  annual_income    NUMERIC(12,2) CHECK (annual_income IS NULL OR annual_income >= 0),
  fpl_percent      NUMERIC(6,2)  CHECK (fpl_percent IS NULL OR fpl_percent >= 0),
  source           TEXT          NOT NULL DEFAULT 'self_reported'
                   CHECK (source IN ('platform', 'self_reported', 'document_extracted')),
  application_id   UUID          REFERENCES public.applications(id) ON DELETE SET NULL,
  document_id      UUID          REFERENCES public.documents(id) ON DELETE SET NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT insurance_coverage_records_user_year_key UNIQUE (user_id, coverage_year)
);

CREATE TABLE IF NOT EXISTS public.insurance_explanations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coverage_record_id  UUID        NOT NULL REFERENCES public.insurance_coverage_records(id) ON DELETE CASCADE,
  prior_record_id     UUID        REFERENCES public.insurance_coverage_records(id) ON DELETE SET NULL,
  change_factors      JSONB       NOT NULL DEFAULT '{}',
  explanation_text    TEXT        NOT NULL,
  generated_by        TEXT        NOT NULL CHECK (generated_by IN ('rules', 'llm')),
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT insurance_explanations_coverage_record_id_key UNIQUE (coverage_record_id)
);

-- RLS
ALTER TABLE public.insurance_coverage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_coverage_records"
  ON public.insurance_coverage_records
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_explanations"
  ON public.insurance_explanations
  FOR ALL USING (
    coverage_record_id IN (
      SELECT id FROM public.insurance_coverage_records WHERE user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply migration locally**

```bash
supabase db push
```

Expected: migration applies with no errors. Verify tables exist:
```bash
supabase db diff
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260531000001_insurance_history.sql
git commit -m "feat: add insurance_coverage_records and insurance_explanations tables"
```

---

## Task 2: Shared Types

**Files:**
- Create: `lib/insurance-history/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
// lib/insurance-history/types.ts

export type CoverageSource = 'platform' | 'self_reported' | 'document_extracted'
export type ExplanationGeneratedBy = 'rules' | 'llm'

export interface CoverageRecord {
  id: string
  userId: string
  coverageYear: number
  planName: string
  programCode: string | null
  premiumMonthly: number | null
  householdSize: number | null
  annualIncome: number | null
  fplPercent: number | null
  source: CoverageSource
  applicationId: string | null
  documentId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface InsuranceExplanation {
  id: string
  coverageRecordId: string
  priorRecordId: string | null
  changeFactors: ChangeFactor
  explanationText: string
  generatedBy: ExplanationGeneratedBy
  generatedAt: string
}

export interface ChangeFactor {
  incomeDelta: number | null        // annual income change in dollars
  householdDelta: number | null     // household size change
  fplDelta: number | null           // FPL percent change
  programChange: { from: string | null; to: string | null } | null
  gainedEmployer: boolean
  lostEmployer: boolean
  pregnancy: boolean
  medicare: boolean
}

export interface CoverageRecordWithExplanation {
  record: CoverageRecord
  explanation: InsuranceExplanation | null
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/insurance-history/types.ts
git commit -m "feat: add insurance history shared types"
```

---

## Task 3: DB Layer

**Files:**
- Create: `lib/db/insurance-history.ts`

- [ ] **Step 1: Write the DB layer**

```typescript
// lib/db/insurance-history.ts
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import type {
  CoverageRecord,
  InsuranceExplanation,
  CoverageSource,
  ExplanationGeneratedBy,
  ChangeFactor,
} from "@/lib/insurance-history/types"

function rowToCoverageRecord(row: Record<string, unknown>): CoverageRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    coverageYear: row.coverage_year as number,
    planName: row.plan_name as string,
    programCode: row.program_code as string | null,
    premiumMonthly: row.premium_monthly != null ? Number(row.premium_monthly) : null,
    householdSize: row.household_size as number | null,
    annualIncome: row.annual_income != null ? Number(row.annual_income) : null,
    fplPercent: row.fpl_percent != null ? Number(row.fpl_percent) : null,
    source: row.source as CoverageSource,
    applicationId: row.application_id as string | null,
    documentId: row.document_id as string | null,
    notes: row.notes as string | null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  }
}

function rowToExplanation(row: Record<string, unknown>): InsuranceExplanation {
  return {
    id: row.id as string,
    coverageRecordId: row.coverage_record_id as string,
    priorRecordId: row.prior_record_id as string | null,
    changeFactors: row.change_factors as ChangeFactor,
    explanationText: row.explanation_text as string,
    generatedBy: row.generated_by as ExplanationGeneratedBy,
    generatedAt: (row.generated_at as Date).toISOString(),
  }
}

export async function listCoverageRecords(userId: string): Promise<CoverageRecord[]> {
  const pool = getDbPool()
  const result = await pool.query(
    `SELECT * FROM public.insurance_coverage_records
     WHERE user_id = $1
     ORDER BY coverage_year DESC`,
    [userId],
  )
  return result.rows.map(rowToCoverageRecord)
}

export async function getCoverageRecord(id: string, userId: string): Promise<CoverageRecord | null> {
  const pool = getDbPool()
  const result = await pool.query(
    `SELECT * FROM public.insurance_coverage_records WHERE id = $1 AND user_id = $2`,
    [id, userId],
  )
  return result.rows[0] ? rowToCoverageRecord(result.rows[0]) : null
}

export interface CreateCoverageRecordInput {
  userId: string
  coverageYear: number
  planName: string
  programCode?: string | null
  premiumMonthly?: number | null
  householdSize?: number | null
  annualIncome?: number | null
  fplPercent?: number | null
  source: CoverageSource
  applicationId?: string | null
  documentId?: string | null
  notes?: string | null
}

export async function createCoverageRecord(input: CreateCoverageRecordInput): Promise<CoverageRecord> {
  const pool = getDbPool()
  const result = await pool.query(
    `INSERT INTO public.insurance_coverage_records
       (user_id, coverage_year, plan_name, program_code, premium_monthly,
        household_size, annual_income, fpl_percent, source, application_id, document_id, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      input.userId,
      input.coverageYear,
      input.planName,
      input.programCode ?? null,
      input.premiumMonthly ?? null,
      input.householdSize ?? null,
      input.annualIncome ?? null,
      input.fplPercent ?? null,
      input.source,
      input.applicationId ?? null,
      input.documentId ?? null,
      input.notes ?? null,
    ],
  )
  return rowToCoverageRecord(result.rows[0])
}

export interface UpdateCoverageRecordInput {
  planName?: string
  programCode?: string | null
  premiumMonthly?: number | null
  householdSize?: number | null
  annualIncome?: number | null
  fplPercent?: number | null
  notes?: string | null
}

export async function updateCoverageRecord(
  id: string,
  userId: string,
  input: UpdateCoverageRecordInput,
): Promise<CoverageRecord | null> {
  const pool = getDbPool()
  const result = await pool.query(
    `UPDATE public.insurance_coverage_records
     SET plan_name = COALESCE($3, plan_name),
         program_code = COALESCE($4, program_code),
         premium_monthly = COALESCE($5, premium_monthly),
         household_size = COALESCE($6, household_size),
         annual_income = COALESCE($7, annual_income),
         fpl_percent = COALESCE($8, fpl_percent),
         notes = COALESCE($9, notes),
         updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, input.planName, input.programCode, input.premiumMonthly,
     input.householdSize, input.annualIncome, input.fplPercent, input.notes],
  )
  return result.rows[0] ? rowToCoverageRecord(result.rows[0]) : null
}

export async function deleteCoverageRecord(id: string, userId: string): Promise<boolean> {
  const pool = getDbPool()
  const result = await pool.query(
    `DELETE FROM public.insurance_coverage_records WHERE id = $1 AND user_id = $2`,
    [id, userId],
  )
  return (result.rowCount ?? 0) > 0
}

export async function getExplanation(coverageRecordId: string): Promise<InsuranceExplanation | null> {
  const pool = getDbPool()
  const result = await pool.query(
    `SELECT * FROM public.insurance_explanations WHERE coverage_record_id = $1`,
    [coverageRecordId],
  )
  return result.rows[0] ? rowToExplanation(result.rows[0]) : null
}

export interface SaveExplanationInput {
  coverageRecordId: string
  priorRecordId: string | null
  changeFactors: ChangeFactor
  explanationText: string
  generatedBy: ExplanationGeneratedBy
}

export async function saveExplanation(input: SaveExplanationInput): Promise<InsuranceExplanation> {
  const pool = getDbPool()
  const result = await pool.query(
    `INSERT INTO public.insurance_explanations
       (coverage_record_id, prior_record_id, change_factors, explanation_text, generated_by)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (coverage_record_id) DO UPDATE
       SET change_factors = EXCLUDED.change_factors,
           explanation_text = EXCLUDED.explanation_text,
           generated_by = EXCLUDED.generated_by,
           generated_at = now()
     RETURNING *`,
    [
      input.coverageRecordId,
      input.priorRecordId,
      JSON.stringify(input.changeFactors),
      input.explanationText,
      input.generatedBy,
    ],
  )
  return rowToExplanation(result.rows[0])
}

/** Called automatically when an application is approved. Upserts a platform-derived record. */
export async function autoPopulateCoverageRecord(params: {
  userId: string
  coverageYear: number
  planName: string
  programCode: string
  householdSize: number | null
  annualIncome: number | null
  fplPercent: number | null
  applicationId: string
}): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `INSERT INTO public.insurance_coverage_records
       (user_id, coverage_year, plan_name, program_code, household_size,
        annual_income, fpl_percent, source, application_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'platform',$8)
     ON CONFLICT (user_id, coverage_year) DO NOTHING`,
    [
      params.userId,
      params.coverageYear,
      params.planName,
      params.programCode,
      params.householdSize,
      params.annualIncome,
      params.fplPercent,
      params.applicationId,
    ],
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/db/insurance-history.ts
git commit -m "feat: add insurance history DB layer"
```

---

## Task 4: Explanation Engine + Unit Tests (TDD)

**Files:**
- Create: `lib/insurance-history/explanation-engine.ts`
- Create: `lib/insurance-history/__tests__/explanation-engine.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// lib/insurance-history/__tests__/explanation-engine.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  computeChangeFactor,
  applyRulesTemplate,
  FALLBACK_EXPLANATION,
} from "@/lib/insurance-history/explanation-engine"
import type { CoverageRecord } from "@/lib/insurance-history/types"

function makeRecord(overrides: Partial<CoverageRecord> = {}): CoverageRecord {
  return {
    id: "test-id",
    userId: "user-1",
    coverageYear: 2026,
    planName: "CarePlus",
    programCode: "careplus",
    premiumMonthly: 0,
    householdSize: 1,
    annualIncome: 20000,
    fplPercent: 125,
    source: "platform",
    applicationId: null,
    documentId: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("computeChangeFactor", () => {
  it("detects income drop below 138% FPL (connectorcare → careplus)", () => {
    const current = makeRecord({ fplPercent: 125, programCode: "careplus" })
    const prior = makeRecord({ fplPercent: 210, programCode: "connectorcare", coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.fplDelta).toBe(-85)
    expect(cf.programChange).toEqual({ from: "connectorcare", to: "careplus" })
  })

  it("detects income rise above 138% FPL (careplus → connectorcare)", () => {
    const current = makeRecord({ fplPercent: 210, programCode: "connectorcare" })
    const prior = makeRecord({ fplPercent: 125, programCode: "careplus", coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.fplDelta).toBe(85)
  })

  it("detects household size increase", () => {
    const current = makeRecord({ householdSize: 3 })
    const prior = makeRecord({ householdSize: 1, coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.householdDelta).toBe(2)
  })

  it("detects household size decrease", () => {
    const current = makeRecord({ householdSize: 1 })
    const prior = makeRecord({ householdSize: 3, coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.householdDelta).toBe(-2)
  })

  it("detects gained employer coverage", () => {
    const current = makeRecord({ programCode: "employer_sponsored_insurance" })
    const prior = makeRecord({ programCode: "connectorcare", coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.gainedEmployer).toBe(true)
  })

  it("detects lost employer coverage", () => {
    const current = makeRecord({ programCode: "connectorcare" })
    const prior = makeRecord({ programCode: "employer_sponsored_insurance", coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.lostEmployer).toBe(true)
  })

  it("detects pregnancy plan", () => {
    const current = makeRecord({ programCode: "pregnancy_standard" })
    const prior = makeRecord({ programCode: "connectorcare", coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.pregnancy).toBe(true)
  })

  it("detects Medicare transition", () => {
    const current = makeRecord({ programCode: "medicare_savings_program_senior" })
    const prior = makeRecord({ programCode: "careplus", coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.medicare).toBe(true)
  })

  it("returns all nulls/false for no prior record", () => {
    const current = makeRecord()
    const cf = computeChangeFactor(current, null)
    expect(cf.fplDelta).toBeNull()
    expect(cf.incomeDelta).toBeNull()
    expect(cf.householdDelta).toBeNull()
    expect(cf.programChange).toBeNull()
    expect(cf.gainedEmployer).toBe(false)
    expect(cf.lostEmployer).toBe(false)
    expect(cf.pregnancy).toBe(false)
    expect(cf.medicare).toBe(false)
  })
})

describe("applyRulesTemplate", () => {
  it("returns oldest-record message when no prior", () => {
    const current = makeRecord({ fplPercent: 125, programCode: "careplus" })
    const result = applyRulesTemplate(current, null)
    expect(result).toBe("This is the earliest coverage record on file.")
  })

  it("matches income-dropped-below-138 template", () => {
    const current = makeRecord({ fplPercent: 125, programCode: "careplus" })
    const prior = makeRecord({ fplPercent: 210, programCode: "connectorcare", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toContain("138%")
    expect(result).toContain("CarePlus")
  })

  it("matches income-rose-above-138 template", () => {
    const current = makeRecord({ fplPercent: 210, programCode: "connectorcare" })
    const prior = makeRecord({ fplPercent: 125, programCode: "careplus", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toContain("138%")
  })

  it("matches income-above-300 template (connectorcare → federal_tax_credits)", () => {
    const current = makeRecord({ fplPercent: 350, programCode: "federal_tax_credits" })
    const prior = makeRecord({ fplPercent: 210, programCode: "connectorcare", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toContain("300%")
  })

  it("matches income-above-400 template", () => {
    const current = makeRecord({ fplPercent: 420, programCode: "employer_or_connector" })
    const prior = makeRecord({ fplPercent: 350, programCode: "federal_tax_credits", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toContain("400%")
  })

  it("matches household-increased template", () => {
    const current = makeRecord({ householdSize: 3, fplPercent: 125 })
    const prior = makeRecord({ householdSize: 1, fplPercent: 125, coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toMatch(/household grew|household size/i)
  })

  it("matches household-decreased template", () => {
    const current = makeRecord({ householdSize: 1, fplPercent: 125 })
    const prior = makeRecord({ householdSize: 3, fplPercent: 125, coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toMatch(/household size/i)
  })

  it("matches gained-employer template", () => {
    const current = makeRecord({ programCode: "employer_sponsored_insurance" })
    const prior = makeRecord({ programCode: "connectorcare", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toMatch(/employer/i)
  })

  it("matches lost-employer template", () => {
    const current = makeRecord({ programCode: "connectorcare" })
    const prior = makeRecord({ programCode: "employer_sponsored_insurance", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toMatch(/lost.*employer|employer.*insurance/i)
  })

  it("matches pregnancy template", () => {
    const current = makeRecord({ programCode: "pregnancy_standard" })
    const prior = makeRecord({ programCode: "connectorcare", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toMatch(/pregnan/i)
  })

  it("matches medicare template", () => {
    const current = makeRecord({ programCode: "medicare_savings_program_senior" })
    const prior = makeRecord({ programCode: "careplus", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toMatch(/medicare/i)
  })

  it("returns null for unmatched multi-factor change (triggers LLM fallback)", () => {
    // simultaneous income + household change with uncommon program pair
    const current = makeRecord({ fplPercent: 200, householdSize: 3, programCode: "connectorcare" })
    const prior = makeRecord({ fplPercent: 350, householdSize: 1, programCode: "federal_tax_credits", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    // multi-factor — no single template wins, returns null
    expect(result).toBeNull()
  })

  it("FPL boundary: exactly 138% is treated as below threshold for careplus", () => {
    const current = makeRecord({ fplPercent: 138, programCode: "careplus" })
    const prior = makeRecord({ fplPercent: 139, programCode: "connectorcare", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toContain("138%")
  })

  it("FPL boundary: exactly 300% is treated as above for connectorcare exit", () => {
    const current = makeRecord({ fplPercent: 300, programCode: "federal_tax_credits" })
    const prior = makeRecord({ fplPercent: 299, programCode: "connectorcare", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toContain("300%")
  })
})

describe("FALLBACK_EXPLANATION", () => {
  it("is a non-empty string", () => {
    expect(typeof FALLBACK_EXPLANATION).toBe("string")
    expect(FALLBACK_EXPLANATION.length).toBeGreaterThan(10)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/insurance-history/__tests__/explanation-engine.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the explanation engine**

```typescript
// lib/insurance-history/explanation-engine.ts
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { CoverageRecord, ChangeFactor, InsuranceExplanation } from "@/lib/insurance-history/types"
import { getIncomeAsFPLPercent } from "@/lib/eligibility-engine"

const EMPLOYER_CODES = new Set([
  "employer_sponsored_insurance",
  "employer_or_connector",
])

const MEDICARE_CODES = new Set([
  "medicare_savings_program_adult",
  "medicare_savings_program_senior",
  "medigap_plans",
  "dual_eligible_standard",
])

export const FALLBACK_EXPLANATION =
  "Your coverage changed between these two years. Add or complete your income and household details to get a personalized explanation."

export function computeChangeFactor(
  current: CoverageRecord,
  prior: CoverageRecord | null,
): ChangeFactor {
  if (!prior) {
    return {
      incomeDelta: null,
      householdDelta: null,
      fplDelta: null,
      programChange: null,
      gainedEmployer: false,
      lostEmployer: false,
      pregnancy: current.programCode === "pregnancy_standard",
      medicare: MEDICARE_CODES.has(current.programCode ?? ""),
    }
  }

  const incomeDelta =
    current.annualIncome != null && prior.annualIncome != null
      ? current.annualIncome - prior.annualIncome
      : null

  const householdDelta =
    current.householdSize != null && prior.householdSize != null
      ? current.householdSize - prior.householdSize
      : null

  const fplDelta =
    current.fplPercent != null && prior.fplPercent != null
      ? Math.round(current.fplPercent - prior.fplPercent)
      : null

  const gainedEmployer =
    EMPLOYER_CODES.has(current.programCode ?? "") &&
    !EMPLOYER_CODES.has(prior.programCode ?? "")

  const lostEmployer =
    !EMPLOYER_CODES.has(current.programCode ?? "") &&
    EMPLOYER_CODES.has(prior.programCode ?? "")

  return {
    incomeDelta,
    householdDelta,
    fplDelta,
    programChange:
      current.programCode !== prior.programCode
        ? { from: prior.programCode, to: current.programCode }
        : null,
    gainedEmployer,
    lostEmployer,
    pregnancy: current.programCode === "pregnancy_standard",
    medicare: MEDICARE_CODES.has(current.programCode ?? ""),
  }
}

/**
 * Returns a single-factor explanation template string, or null if multiple
 * significant factors changed (caller should use LLM fallback).
 */
export function applyRulesTemplate(
  current: CoverageRecord,
  prior: CoverageRecord | null,
): string | null {
  if (!prior) return "This is the earliest coverage record on file."

  const cf = computeChangeFactor(current, prior)

  // Count significant factors for multi-factor detection
  const significantFactors = [
    cf.pregnancy,
    cf.medicare,
    cf.gainedEmployer,
    cf.lostEmployer,
    cf.fplDelta != null && Math.abs(cf.fplDelta) >= 10 && !cf.gainedEmployer && !cf.lostEmployer && !cf.pregnancy && !cf.medicare,
    cf.householdDelta != null && cf.householdDelta !== 0 && !cf.pregnancy,
  ].filter(Boolean).length

  if (significantFactors > 1) return null

  if (cf.pregnancy) {
    return "Pregnancy qualifies you for MassHealth Standard regardless of income."
  }

  if (cf.medicare) {
    return "You became eligible for Medicare, transitioning from state coverage to a Medicare savings program."
  }

  if (cf.gainedEmployer) {
    return "You gained access to affordable employer-sponsored insurance, making you ineligible for subsidized marketplace plans."
  }

  if (cf.lostEmployer) {
    return "You lost access to employer-sponsored insurance, opening eligibility for subsidized coverage."
  }

  if (cf.fplDelta != null && Math.abs(cf.fplDelta) >= 10) {
    const curFpl = current.fplPercent ?? 0
    const priorFpl = prior.fplPercent ?? 0

    if (priorFpl > 138 && curFpl <= 138) {
      return `Your income fell below 138% of the Federal Poverty Level, making you eligible for free MassHealth CarePlus.`
    }
    if (priorFpl <= 138 && curFpl > 138) {
      return `Your income rose above 138% FPL, making you ineligible for free Medicaid. You moved to a subsidized ConnectorCare plan.`
    }
    if (priorFpl < 300 && curFpl >= 300) {
      return `Your income exceeded 300% FPL, moving you out of ConnectorCare into a marketplace plan with federal tax credits.`
    }
    if (priorFpl < 400 && curFpl >= 400) {
      return `Your income exceeded 400% FPL, making you ineligible for premium subsidies. You may qualify for unsubsidized marketplace coverage.`
    }
    if (cf.fplDelta < 0) {
      return `Your income decreased, lowering your Federal Poverty Level percentage from ${Math.round(priorFpl)}% to ${Math.round(curFpl)}%, which changed your plan eligibility.`
    }
    return `Your income increased, raising your Federal Poverty Level percentage from ${Math.round(priorFpl)}% to ${Math.round(curFpl)}%, which changed your plan eligibility.`
  }

  if (cf.householdDelta != null && cf.householdDelta !== 0) {
    if (cf.householdDelta > 0) {
      return "Your household grew, which adjusted your Federal Poverty Level calculation and changed your eligibility."
    }
    return "A change in your household size adjusted your FPL calculation and affected your plan eligibility."
  }

  return null
}

/** Builds the LLM prompt for multi-factor or unmatched transitions. */
export function buildLlmPrompt(
  current: CoverageRecord,
  prior: CoverageRecord,
  cf: ChangeFactor,
): string {
  return `You are a plain-language health insurance assistant for Massachusetts residents. Explain in 2-3 sentences why this person's health insurance changed between ${prior.coverageYear} and ${current.coverageYear}. Be specific about the numbers. Do not use jargon. Do not mention MassHealth by name unless relevant.

Previous coverage (${prior.coverageYear}): ${prior.planName}, FPL: ${prior.fplPercent ?? "unknown"}%, income: $${prior.annualIncome ?? "unknown"}/year, household: ${prior.householdSize ?? "unknown"}
Current coverage (${current.coverageYear}): ${current.planName}, FPL: ${current.fplPercent ?? "unknown"}%, income: $${current.annualIncome ?? "unknown"}/year, household: ${current.householdSize ?? "unknown"}
Change factors: income delta $${cf.incomeDelta ?? "unknown"}, FPL delta ${cf.fplDelta ?? "unknown"}%, household delta ${cf.householdDelta ?? 0}`
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/insurance-history/__tests__/explanation-engine.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/insurance-history/explanation-engine.ts lib/insurance-history/__tests__/explanation-engine.test.ts
git commit -m "feat: add insurance explanation engine with rules templates and unit tests"
```

---

## Task 5: API Routes

**Files:**
- Create: `app/api/insurance-history/records/route.ts`
- Create: `app/api/insurance-history/records/[id]/route.ts`
- Create: `app/api/insurance-history/explain/route.ts`

- [ ] **Step 1: Write GET/POST records route**

```typescript
// app/api/insurance-history/records/route.ts
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { createCoverageRecord, listCoverageRecords } from "@/lib/db/insurance-history"

export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const records = await listCoverageRecords(authResult.userId)
    return NextResponse.json({ ok: true, records })
  } catch (err) {
    console.error("[insurance-history/records GET]", err)
    return NextResponse.json({ ok: false, error: "Failed to load records" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = await request.json().catch(() => null)
    if (!body || typeof body.coverageYear !== "number" || !body.planName) {
      return NextResponse.json({ ok: false, error: "coverageYear and planName are required" }, { status: 400 })
    }

    const record = await createCoverageRecord({
      userId: authResult.userId,
      coverageYear: body.coverageYear,
      planName: body.planName,
      programCode: body.programCode ?? null,
      premiumMonthly: body.premiumMonthly ?? null,
      householdSize: body.householdSize ?? null,
      annualIncome: body.annualIncome ?? null,
      fplPercent: body.fplPercent ?? null,
      source: "self_reported",
      documentId: body.documentId ?? null,
      notes: body.notes ?? null,
    })
    return NextResponse.json({ ok: true, record }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique constraint")) {
      return NextResponse.json({ ok: false, error: "A record for this year already exists" }, { status: 409 })
    }
    console.error("[insurance-history/records POST]", err)
    return NextResponse.json({ ok: false, error: "Failed to create record" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Write PUT/DELETE [id] route**

```typescript
// app/api/insurance-history/records/[id]/route.ts
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { deleteCoverageRecord, getCoverageRecord, updateCoverageRecord } from "@/lib/db/insurance-history"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 })
    }
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const record = await getCoverageRecord(params.id, authResult.userId)
    if (!record) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    if (record.source === "platform") {
      return NextResponse.json({ ok: false, error: "Platform records cannot be edited" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const updated = await updateCoverageRecord(params.id, authResult.userId, {
      planName: body.planName,
      programCode: body.programCode,
      premiumMonthly: body.premiumMonthly,
      householdSize: body.householdSize,
      annualIncome: body.annualIncome,
      fplPercent: body.fplPercent,
      notes: body.notes,
    })
    return NextResponse.json({ ok: true, record: updated })
  } catch (err) {
    console.error("[insurance-history/records PUT]", err)
    return NextResponse.json({ ok: false, error: "Failed to update record" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 })
    }
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const record = await getCoverageRecord(params.id, authResult.userId)
    if (!record) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    if (record.source === "platform") {
      return NextResponse.json({ ok: false, error: "Platform records cannot be deleted" }, { status: 403 })
    }

    await deleteCoverageRecord(params.id, authResult.userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[insurance-history/records DELETE]", err)
    return NextResponse.json({ ok: false, error: "Failed to delete record" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Write the explain route**

```typescript
// app/api/insurance-history/explain/route.ts
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getCoverageRecord, saveExplanation } from "@/lib/db/insurance-history"
import {
  applyRulesTemplate,
  buildLlmPrompt,
  computeChangeFactor,
  FALLBACK_EXPLANATION,
} from "@/lib/insurance-history/explanation-engine"

const anthropic = new Anthropic()

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = await request.json().catch(() => null)
    if (!body?.coverageRecordId) {
      return NextResponse.json({ ok: false, error: "coverageRecordId is required" }, { status: 400 })
    }

    const current = await getCoverageRecord(body.coverageRecordId, authResult.userId)
    if (!current) return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 })

    const prior = body.priorRecordId
      ? await getCoverageRecord(body.priorRecordId, authResult.userId)
      : null

    const cf = computeChangeFactor(current, prior)
    const rulesText = applyRulesTemplate(current, prior)

    let explanationText: string
    let generatedBy: "rules" | "llm" = "rules"

    if (rulesText !== null) {
      explanationText = rulesText
    } else if (prior) {
      // Multi-factor: try LLM
      try {
        const prompt = buildLlmPrompt(current, prior, cf)
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          messages: [{ role: "user", content: prompt }],
        })
        const content = msg.content[0]
        explanationText = content.type === "text" ? content.text.trim() : FALLBACK_EXPLANATION
        generatedBy = "llm"
      } catch {
        explanationText = FALLBACK_EXPLANATION
      }
    } else {
      explanationText = FALLBACK_EXPLANATION
    }

    const explanation = await saveExplanation({
      coverageRecordId: current.id,
      priorRecordId: prior?.id ?? null,
      changeFactors: cf,
      explanationText,
      generatedBy,
    })

    return NextResponse.json({ ok: true, explanation })
  } catch (err) {
    console.error("[insurance-history/explain POST]", err)
    return NextResponse.json({ ok: false, error: "Failed to generate explanation" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/insurance-history/
git commit -m "feat: add insurance history API routes (records CRUD + explain)"
```

---

## Task 6: Components

**Files:**
- Create: `components/insurance-history/insurance-summary-card.tsx`
- Create: `components/insurance-history/timeline-entry.tsx`
- Create: `components/insurance-history/insurance-timeline.tsx`
- Create: `components/insurance-history/coverage-form.tsx`

- [ ] **Step 1: Write `insurance-summary-card.tsx`**

```typescript
// components/insurance-history/insurance-summary-card.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import Link from "next/link"
import { ChevronRight, History } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

interface InsuranceSummaryCardProps {
  latest: CoverageRecordWithExplanation | null
}

export function InsuranceSummaryCard({ latest }: InsuranceSummaryCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="w-4 h-4 text-blue-600" />
          Insurance History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {latest ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{latest.record.planName}</span>
              <Badge variant="outline" className="text-xs">
                {latest.record.coverageYear}
              </Badge>
            </div>
            {latest.record.premiumMonthly != null && (
              <p className="text-xs text-muted-foreground">
                ${latest.record.premiumMonthly.toFixed(0)}/mo premium
              </p>
            )}
            {latest.explanation && (
              <p className="text-xs text-blue-700 dark:text-blue-400 line-clamp-2">
                {latest.explanation.explanationText.split(".")[0]}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No coverage history on file yet.</p>
        )}
        <Link
          href="/customer/insurance-history"
          className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
        >
          View full history <ChevronRight className="w-3 h-3" />
        </Link>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Write `timeline-entry.tsx`**

```typescript
// components/insurance-history/timeline-entry.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import { Pencil, ChevronDown, ChevronUp, FileText, UserCheck, Bot } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

const PROGRAM_COLORS: Record<string, string> = {
  careplus: "bg-blue-600",
  connectorcare: "bg-emerald-600",
  employer_sponsored_insurance: "bg-violet-600",
  employer_or_connector: "bg-violet-600",
  federal_tax_credits: "bg-orange-500",
  pregnancy_standard: "bg-pink-500",
  child_standard: "bg-sky-500",
  medicare_savings_program_senior: "bg-teal-600",
  dual_eligible_standard: "bg-teal-600",
}

function bubbleColor(programCode: string | null): string {
  return PROGRAM_COLORS[programCode ?? ""] ?? "bg-gray-400"
}

const SOURCE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  platform: { label: "From your application", icon: <FileText className="w-3 h-3" /> },
  self_reported: { label: "You added this", icon: <UserCheck className="w-3 h-3" /> },
  document_extracted: { label: "Extracted from document", icon: <Bot className="w-3 h-3" /> },
}

interface TimelineEntryProps {
  item: CoverageRecordWithExplanation
  isFirst: boolean
  isLast: boolean
  onEdit: (id: string) => void
}

export function TimelineEntry({ item, isFirst, isLast, onEdit }: TimelineEntryProps) {
  const [expanded, setExpanded] = useState(isFirst)
  const { record, explanation } = item
  const color = bubbleColor(record.programCode)
  const sourceInfo = SOURCE_LABELS[record.source]

  return (
    <div className="flex items-start gap-4">
      {/* Left: year bubble + connector line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center text-xs font-bold shadow`}
        >
          {record.coverageYear}
        </div>
        {!isLast && <div className="w-0.5 flex-1 min-h-8 bg-border mt-1" />}
      </div>

      {/* Right: card */}
      <div className="flex-1 pb-6">
        <div className="border rounded-lg bg-card shadow-sm p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{record.planName}</p>
              {record.premiumMonthly != null && (
                <p className="text-xs text-muted-foreground">
                  ${record.premiumMonthly.toFixed(0)}/mo premium
                  {record.fplPercent != null && ` · ${Math.round(record.fplPercent)}% FPL`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                {sourceInfo.icon}
                {sourceInfo.label}
              </Badge>
              {record.source !== "platform" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onEdit(record.id)}
                  aria-label="Edit record"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Why this plan */}
          {explanation && (
            <div>
              <button
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                onClick={() => setExpanded((v) => !v)}
              >
                Why this plan?
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {expanded && (
                <p className="mt-1 text-xs leading-relaxed text-blue-900 dark:text-blue-200 bg-blue-50 dark:bg-blue-950 rounded p-2">
                  {explanation.explanationText}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `insurance-timeline.tsx`**

```typescript
// components/insurance-history/insurance-timeline.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimelineEntry } from "./timeline-entry"
import { CoverageForm } from "./coverage-form"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

interface InsuranceTimelineProps {
  items: CoverageRecordWithExplanation[]
}

export function InsuranceTimeline({ items }: InsuranceTimelineProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)

  const editRecord = editingId ? items.find((i) => i.record.id === editingId)?.record : null

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Coverage Timeline</h2>
        <Button size="sm" variant="outline" onClick={() => setAddingNew(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add past coverage
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No coverage records yet. Add your first one to get started.
        </div>
      ) : (
        items.map((item, index) => (
          <TimelineEntry
            key={item.record.id}
            item={item}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            onEdit={setEditingId}
          />
        ))
      )}

      {(addingNew || editRecord) && (
        <CoverageForm
          record={editRecord ?? null}
          onClose={() => {
            setAddingNew(false)
            setEditingId(null)
          }}
          onSaved={() => {
            setAddingNew(false)
            setEditingId(null)
            // Server Component will revalidate on next navigation; client refresh:
            window.location.reload()
          }}
          existingYears={items.map((i) => i.record.coverageYear)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write `coverage-form.tsx`**

```typescript
// components/insurance-history/coverage-form.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { CoverageRecord } from "@/lib/insurance-history/types"

interface CoverageFormProps {
  record: CoverageRecord | null  // null = new record
  existingYears: number[]
  onClose: () => void
  onSaved: () => void
}

interface FormState {
  coverageYear: string
  planName: string
  premiumMonthly: string
  householdSize: string
  annualIncome: string
  notes: string
}

export function CoverageForm({ record, existingYears, onClose, onSaved }: CoverageFormProps) {
  const isEditing = record !== null
  const currentYear = new Date().getFullYear()

  const [form, setForm] = useState<FormState>({
    coverageYear: record ? String(record.coverageYear) : String(currentYear),
    planName: record?.planName ?? "",
    premiumMonthly: record?.premiumMonthly != null ? String(record.premiumMonthly) : "",
    householdSize: record?.householdSize != null ? String(record.householdSize) : "",
    annualIncome: record?.annualIncome != null ? String(record.annualIncome) : "",
    notes: record?.notes ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const year = parseInt(form.coverageYear, 10)
    if (!isEditing && existingYears.includes(year)) {
      setError(`A record for ${year} already exists. Use the edit button on that entry instead.`)
      return
    }
    if (!form.planName.trim()) {
      setError("Plan name is required.")
      return
    }

    setSaving(true)
    try {
      const body = {
        coverageYear: year,
        planName: form.planName.trim(),
        premiumMonthly: form.premiumMonthly ? parseFloat(form.premiumMonthly) : null,
        householdSize: form.householdSize ? parseInt(form.householdSize, 10) : null,
        annualIncome: form.annualIncome ? parseFloat(form.annualIncome) : null,
        notes: form.notes || null,
      }

      const url = isEditing
        ? `/api/insurance-history/records/${record!.id}`
        : "/api/insurance-history/records"
      const method = isEditing ? "PUT" : "POST"

      const res = await authenticatedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? "Failed to save record.")
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit coverage record" : "Add past coverage"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="coverage-year">Coverage year *</Label>
            <Input
              id="coverage-year"
              type="number"
              min="1990"
              max={currentYear}
              value={form.coverageYear}
              onChange={set("coverageYear")}
              disabled={isEditing}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="plan-name">Plan name *</Label>
            <Input
              id="plan-name"
              placeholder="e.g. MassHealth CarePlus, ConnectorCare Plan 2"
              value={form.planName}
              onChange={set("planName")}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="premium">Monthly premium ($)</Label>
            <Input
              id="premium"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.premiumMonthly}
              onChange={set("premiumMonthly")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="household">Household size</Label>
            <Input
              id="household"
              type="number"
              min="1"
              placeholder="1"
              value={form.householdSize}
              onChange={set("householdSize")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="income">Annual income ($)</Label>
            <Input
              id="income"
              type="number"
              min="0"
              placeholder="0"
              value={form.annualIncome}
              onChange={set("annualIncome")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="Any additional details"
              value={form.notes}
              onChange={set("notes")}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEditing ? "Save changes" : "Add record"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/insurance-history/
git commit -m "feat: add insurance history components (summary card, timeline, entry, form)"
```

---

## Task 7: Insurance History Page (Server Component)

**Files:**
- Create: `app/customer/insurance-history/page.tsx`
- Create: `app/customer/insurance-history/loading.tsx`

- [ ] **Step 1: Write the Server Component page**

```typescript
// app/customer/insurance-history/page.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { redirect } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import {
  listCoverageRecords,
  getExplanation,
  saveExplanation,
} from "@/lib/db/insurance-history"
import {
  applyRulesTemplate,
  buildLlmPrompt,
  computeChangeFactor,
  FALLBACK_EXPLANATION,
} from "@/lib/insurance-history/explanation-engine"
import { InsuranceTimeline } from "@/components/insurance-history/insurance-timeline"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

export default async function InsuranceHistoryPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const records = await listCoverageRecords(user.id)

  // Build items with cached or freshly-generated explanations
  const items: CoverageRecordWithExplanation[] = await Promise.all(
    records.map(async (record, index) => {
      const prior = records[index + 1] ?? null

      let explanation = await getExplanation(record.id)

      if (!explanation) {
        const cf = computeChangeFactor(record, prior)
        const rulesText = applyRulesTemplate(record, prior)

        let explanationText: string
        let generatedBy: "rules" | "llm" = "rules"

        if (rulesText !== null) {
          explanationText = rulesText
        } else if (prior) {
          try {
            const prompt = buildLlmPrompt(record, prior, cf)
            const msg = await anthropic.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 256,
              messages: [{ role: "user", content: prompt }],
            })
            const content = msg.content[0]
            explanationText = content.type === "text" ? content.text.trim() : FALLBACK_EXPLANATION
            generatedBy = "llm"
          } catch {
            explanationText = FALLBACK_EXPLANATION
          }
        } else {
          explanationText = FALLBACK_EXPLANATION
        }

        explanation = await saveExplanation({
          coverageRecordId: record.id,
          priorRecordId: prior?.id ?? null,
          changeFactors: cf,
          explanationText,
          generatedBy,
        })
      }

      return { record, explanation }
    }),
  )

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Insurance History</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your coverage history and why it changed each year.
        </p>
      </div>
      <InsuranceTimeline items={items} />
    </main>
  )
}
```

- [ ] **Step 2: Write loading skeleton**

```typescript
// app/customer/insurance-history/loading.tsx

export default function InsuranceHistoryLoading() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="h-7 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-72 bg-muted rounded animate-pulse mt-2" />
      </div>
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 border rounded-lg p-4 space-y-2">
              <div className="h-4 w-40 bg-muted rounded animate-pulse" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              <div className="h-3 w-64 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/customer/insurance-history/
git commit -m "feat: add insurance history page (Server Component with explanation generation)"
```

---

## Task 8: Dashboard Integration

**Files:**
- Modify: `app/customer/dashboard/page.tsx`

- [ ] **Step 1: Find where to add the card**

Open `app/customer/dashboard/page.tsx`. Search for the section that renders the grid of cards (look for `<Card` near the benefit stack or quick-actions area — around the area with `BookOpenText`, `Scale`, etc.).

- [ ] **Step 2: Add the InsuranceSummaryCard**

Add this import at the top of `app/customer/dashboard/page.tsx` (with other component imports):

```typescript
import { InsuranceSummaryCard } from "@/components/insurance-history/insurance-summary-card"
```

Then find the dashboard cards grid (a `<div className="grid ...">` block containing other feature cards) and add `<InsuranceSummaryCard latest={null} />` as the last card in that grid. The `null` prop is safe — the card handles the empty state. A follow-up iteration can wire it to real data via a server fetch or API call.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/customer/dashboard/page.tsx
git commit -m "feat: add insurance summary card to customer dashboard"
```

---

## Task 9: Auto-Populate on Application Approval

**Files:**
- Modify: `lib/db/application-drafts.ts` (or wherever application status transitions are triggered)

- [ ] **Step 1: Find the status transition**

```bash
grep -rn "decided\|status.*approved\|approve" /Users/blee/dev/masshealth-repo/mHealth-app/app/api/ --include="*.ts" -l
```

Open the file that sets application status to `decided`. Look for the `status` update query.

- [ ] **Step 2: Add auto-population call after the `decided` status write**

After the query that sets `status = 'decided'` and the application is approved, add:

```typescript
import { autoPopulateCoverageRecord } from "@/lib/db/insurance-history"
import { getIncomeAsFPLPercent } from "@/lib/eligibility-engine"

// After setting status = 'decided' with an approved result:
if (newStatus === 'decided' && approvedProgramCode) {
  const coverageYear = new Date().getFullYear()
  const fplPercent = annualIncome && householdSize
    ? getIncomeAsFPLPercent(annualIncome, householdSize)
    : null

  await autoPopulateCoverageRecord({
    userId,
    coverageYear,
    planName: approvedProgramName,  // the human-readable program name
    programCode: approvedProgramCode,
    householdSize: householdSize ?? null,
    annualIncome: annualIncome ?? null,
    fplPercent,
    applicationId,
  }).catch((err) => {
    // Non-blocking: log but don't fail the approval
    console.error("[autoPopulateCoverageRecord]", err)
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add -p  # stage only the relevant change
git commit -m "feat: auto-populate insurance coverage record on application approval"
```

---

## Task 10: E2E Tests

**Files:**
- Create: `e2e/pages/insurance-history.page.ts`
- Create: `e2e/tests/17-insurance-history.spec.ts`

- [ ] **Step 1: Write the page object**

```typescript
// e2e/pages/insurance-history.page.ts
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { Page, expect } from "@playwright/test"

export class InsuranceHistoryPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/customer/insurance-history")
  }

  async assertLoaded() {
    await expect(this.page).toHaveURL(/\/customer\/insurance-history/)
    await expect(this.page.getByRole("heading", { name: /insurance history/i })).toBeVisible({
      timeout: 15_000,
    })
  }

  async clickAddPastCoverage() {
    await this.page.getByRole("button", { name: /add past coverage/i }).click()
  }

  async assertDrawerOpen() {
    await expect(this.page.getByRole("heading", { name: /add past coverage/i })).toBeVisible()
  }

  async fillCoverageForm(params: {
    year: number
    planName: string
    premium?: number
  }) {
    await this.page.getByLabel(/coverage year/i).fill(String(params.year))
    await this.page.getByLabel(/plan name/i).fill(params.planName)
    if (params.premium != null) {
      await this.page.getByLabel(/monthly premium/i).fill(String(params.premium))
    }
  }

  async submitForm() {
    await this.page.getByRole("button", { name: /add record/i }).click()
  }

  async assertEntryVisible(year: number, planName: string) {
    await expect(this.page.getByText(planName)).toBeVisible({ timeout: 10_000 })
    await expect(this.page.getByText(String(year)).first()).toBeVisible()
  }

  async assertDuplicateYearError(year: number) {
    await expect(
      this.page.getByText(new RegExp(`${year}.*already exists`, "i")),
    ).toBeVisible()
  }
}
```

- [ ] **Step 2: Write the E2E spec**

```typescript
// e2e/tests/17-insurance-history.spec.ts
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { test, expect } from "@playwright/test"
import { DashboardPage } from "../pages/dashboard.page"
import { InsuranceHistoryPage } from "../pages/insurance-history.page"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"

test.use({ storageState: path.join(__dirname, "../.auth/user.json") })

const AUTH_FILE = path.join(__dirname, "../.auth/user.json")

test.describe("Insurance History", () => {
  test.beforeEach(async () => {
    test.skip(!hasSupabaseAuthState(AUTH_FILE), "No auth session — create a test user to run these tests")
  })

  test("dashboard shows insurance history card with link", async ({ page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()
    await dashboard.assertLoaded()
    await expect(page.getByText(/insurance history/i).first()).toBeVisible({ timeout: 10_000 })
    const link = page.getByRole("link", { name: /view full history/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute("href", "/customer/insurance-history")
  })

  test("insurance history page loads", async ({ page }) => {
    const historyPage = new InsuranceHistoryPage(page)
    await historyPage.goto()
    await historyPage.assertLoaded()
  })

  test("add self-reported coverage record end-to-end", async ({ page }) => {
    const historyPage = new InsuranceHistoryPage(page)
    await historyPage.goto()
    await historyPage.assertLoaded()

    await historyPage.clickAddPastCoverage()
    await historyPage.assertDrawerOpen()

    const testYear = 2020
    await historyPage.fillCoverageForm({
      year: testYear,
      planName: "Test Plan E2E",
      premium: 150,
    })
    await historyPage.submitForm()

    await historyPage.assertEntryVisible(testYear, "Test Plan E2E")
  })

  test("timeline renders records in descending year order", async ({ page }) => {
    const historyPage = new InsuranceHistoryPage(page)
    await historyPage.goto()
    await historyPage.assertLoaded()

    // Get all year bubble texts and verify descending order
    const yearBubbles = await page
      .locator("[class*='rounded-full']")
      .allTextContents()
    const years = yearBubbles
      .map((t) => parseInt(t.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 1990)
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i]).toBeGreaterThanOrEqual(years[i + 1])
    }
  })

  test("add coverage form blocks duplicate year", async ({ page }) => {
    const historyPage = new InsuranceHistoryPage(page)
    await historyPage.goto()
    await historyPage.assertLoaded()

    // Add a record for 2019
    await historyPage.clickAddPastCoverage()
    await historyPage.assertDrawerOpen()
    await historyPage.fillCoverageForm({ year: 2019, planName: "Unique Plan 2019" })
    await historyPage.submitForm()

    // Try to add a duplicate
    await historyPage.clickAddPastCoverage()
    await historyPage.assertDrawerOpen()
    await historyPage.fillCoverageForm({ year: 2019, planName: "Another Plan 2019" })
    await historyPage.submitForm()
    await historyPage.assertDuplicateYearError(2019)
  })
})
```

- [ ] **Step 3: Run E2E tests (skips if no auth)**

```bash
npx playwright test e2e/tests/17-insurance-history.spec.ts --reporter=list
```

Expected: tests either pass or skip cleanly with "No auth session" message. No unexpected failures.

- [ ] **Step 4: Commit**

```bash
git add e2e/pages/insurance-history.page.ts e2e/tests/17-insurance-history.spec.ts
git commit -m "test: add insurance history E2E tests and page object"
```

---

## Task 11: Full Test Run + Final Cleanup

- [ ] **Step 1: Run all unit tests**

```bash
npx vitest run
```

Expected: all existing tests pass, new explanation engine tests pass.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run E2E suite**

```bash
npx playwright test --reporter=list
```

Expected: existing tests unaffected, new tests pass or skip cleanly.

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -p
git commit -m "chore: insurance history cleanup and type fixes"
```
