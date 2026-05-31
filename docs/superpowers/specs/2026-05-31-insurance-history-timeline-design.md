# Insurance History Timeline — Design Spec

**Date:** 2026-05-31  
**Branch:** MH-insurance-mgt  
**Author:** Bin Lee

---

## Problem

Users' health insurance changes every year, but they rarely understand why. They currently have to call their insurance provider or discover gaps when visiting a care provider. This platform already determines eligibility — it should also explain the user's coverage history in plain language, acting as a personal health insurance assistant rather than a one-time eligibility tool.

---

## Goals

- Show a user's full insurance coverage history as a vertical timeline
- Explain in plain language why their coverage changed from year to year (income shift, household change, program rule, etc.)
- Surface coverage history from three sources: platform-derived (existing applications), self-reported (user entry), and document-extracted (AI from uploaded EOBs / coverage notices)
- Increase retention by making the platform feel like a long-term insurance companion

---

## Navigation

- **Dashboard card** (`/customer/dashboard`): A summary card showing the user's current plan, monthly premium, and a one-line "why it changed" teaser. Clicking opens the full history page.
- **Full page** (`/customer/insurance-history`): Vertical timeline of all coverage years. Linked from the dashboard card.

---

## Data Model

### Table: `insurance_coverage_records`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → auth.users | |
| `coverage_year` | INT | e.g. 2026 |
| `plan_name` | TEXT | |
| `program_code` | TEXT | Maps to `EligibilityResultCode` from eligibility engine |
| `premium_monthly` | NUMERIC(10,2) | |
| `household_size` | INT | |
| `annual_income` | NUMERIC(12,2) | |
| `fpl_percent` | NUMERIC(6,2) | |
| `source` | TEXT | `'platform' \| 'self_reported' \| 'document_extracted'` |
| `application_id` | UUID FK → applications | Nullable; set for platform-derived records |
| `document_id` | UUID FK → documents | Nullable; set for document-extracted records |
| `notes` | TEXT | User free-text |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

Unique constraint: `(user_id, coverage_year)` — one record per user per year.

### Table: `insurance_explanations`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `coverage_record_id` | UUID FK → insurance_coverage_records | The "current" year |
| `prior_record_id` | UUID FK → insurance_coverage_records | Nullable — null for the oldest entry |
| `change_factors` | JSONB | Structured diff: `income_delta`, `household_delta`, `fpl_delta`, `program_change` |
| `explanation_text` | TEXT | Final human-readable narrative |
| `generated_by` | TEXT | `'rules' \| 'llm'` |
| `generated_at` | TIMESTAMPTZ | |

---

## Components & File Structure

```
app/customer/insurance-history/
  page.tsx                        Server Component — fetches records + explanations
  loading.tsx                     Skeleton timeline

components/insurance-history/
  insurance-timeline.tsx          Vertical timeline; receives pre-fetched data as props
  timeline-entry.tsx              Single year node: plan badge, premium, explanation box
  coverage-form.tsx               Drawer to add/edit a self-reported record
  document-upload-trigger.tsx     Reuses existing upload infra; tags doc as coverage source
  insurance-summary-card.tsx      Dashboard card: current plan + teaser + "View history" link

app/customer/dashboard/page.tsx   Add <InsuranceSummaryCard> import
```

### Timeline Entry (visual design)
- Year bubble colored by program type: blue (Medicaid/CarePlus), green (ConnectorCare), purple (employer), gray (unknown/self-reported)
- Plan name + monthly premium
- "Why this plan" explanation box — expanded on most recent entry, collapsed on older ones
- Source badge: "From your application" / "You added this" / "Extracted from document"
- Edit button for self-reported and document-extracted records

### Dashboard Summary Card
- Current plan name and premium
- One-line explanation teaser (first sentence of the most recent explanation)
- "View full history →" link

### Add Coverage Drawer (`<CoverageForm>`)
- Fields: coverage year, plan name, premium, household size, annual income
- Optional document upload to auto-extract fields (user confirms before saving)
- Prevents duplicate year entry — shows edit instead if year already exists

---

## Data Flow

### Page render (`/customer/insurance-history`)

1. Server Component fetches all `insurance_coverage_records` for `user_id`, ordered `coverage_year DESC`
2. For each adjacent pair, checks `insurance_explanations` — serves cached if exists
3. For missing explanations, calls `generateTransitionExplanation(current, prior)` (see Explanation Engine)
4. Persists new explanations to `insurance_explanations` before returning to client
5. Passes all records + explanations as props to `<InsuranceTimeline>`

### Platform auto-population

When an application transitions to `decided` status with an approved eligibility result, a server action creates an `insurance_coverage_records` row using:
- `household_size`, `total_monthly_income` from the application
- `estimated_program` from the linked `eligibility_screenings` row
- `coverage_year` derived from `decided_at`
- `source = 'platform'`

### Document extraction flow

1. User clicks "Upload document" in `<CoverageForm>`
2. Reuses `document-analysis-client.ts` with a new prompt variant targeting insurance EOB / coverage notice fields (plan name, effective date, premium amount)
3. Extracted fields pre-fill the form
4. User reviews and confirms before saving
5. Record saved with `source = 'document_extracted'`, `document_id` set

### API routes

```
POST   /api/insurance-history/records          Create self-reported record
PUT    /api/insurance-history/records/[id]     Edit self-reported or document-extracted record
DELETE /api/insurance-history/records/[id]     Delete self-reported or document-extracted record
POST   /api/insurance-history/explain          On-demand explanation for a new record pair
```

---

## Explanation Engine

Location: `lib/insurance-history/explanation-engine.ts`

### Hybrid approach

**Step 1 — Rules engine** computes a structured diff between adjacent records:
- `fpl_delta`: change in FPL percentage
- `income_delta`: change in annual income
- `household_delta`: change in household size
- `program_change`: from program code A to program code B

Maps the diff to one of ~12 pre-written explanation templates:

| Condition | Template |
|---|---|
| FPL crossed below 138% | "Your income fell below 138% of the Federal Poverty Level, making you eligible for free MassHealth CarePlus." |
| FPL crossed above 138% | "Your income rose above 138% FPL, making you ineligible for free Medicaid. You moved to a subsidized ConnectorCare plan." |
| FPL crossed above 300% | "Your income exceeded 300% FPL, moving you out of ConnectorCare into a marketplace plan with federal tax credits." |
| FPL crossed above 400% | "Your income exceeded 400% FPL, making you ineligible for premium subsidies. You may qualify for unsubsidized marketplace coverage." |
| Household size increased | "Your household grew, which adjusted your Federal Poverty Level calculation and changed your eligibility." |
| Household size decreased | "A change in your household size adjusted your FPL calculation and affected your plan eligibility." |
| Gained employer coverage | "You gained access to affordable employer-sponsored insurance, making you ineligible for subsidized marketplace plans." |
| Lost employer coverage | "You lost access to employer-sponsored insurance, opening eligibility for subsidized coverage." |
| Pregnancy | "Pregnancy qualifies you for MassHealth Standard regardless of income." |
| Age 65 / Medicare | "You became eligible for Medicare at age 65, transitioning from state coverage." |
| No prior record | "This is the earliest coverage record on file." |
| Multiple factors | → LLM fallback |

**Step 2 — LLM fallback** (model: `claude-haiku-4-5`)  
Triggered when multiple significant factors changed simultaneously or no template matches. Sends the structured diff + the 12 templates as reference context. Returns a 2–3 sentence narrative. Result stored with `generated_by = 'llm'`.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| LLM call fails | Falls back to best-matching rules template; if none matches, shows neutral fallback text |
| No explanation available | "Your coverage changed between [Year A] and [Year B]. Add more details to get a personalized explanation." |
| Document extraction fails | Form fields stay blank; inline error shown in drawer; user fills manually |
| Duplicate coverage year | UI blocks submission; shows "Edit existing record for [year]" instead |
| Self-reported record without income/household | Explanation engine skips diff computation; shows partial explanation or prompts user to complete the record |

Timeline always renders — explanation failure never blocks the page.

---

## Testing

### Unit tests (`lib/insurance-history/__tests__/`)
- Rules engine: all 12 template cases
- Rules engine: FPL boundary conditions (exactly at 138%, 300%, 400%)
- Rules engine: household size changes, employer affordability threshold
- Auto-population: given an approved application, assert correct `insurance_coverage_records` fields

### Component tests
- `<TimelineEntry>`: renders explanation box, source badge, edit button per record source
- `<InsuranceSummaryCard>`: renders plan name, teaser, link
- `<CoverageForm>`: blocks duplicate year, shows document upload option

### E2E tests (`e2e/`)
- Dashboard card appears and links to `/customer/insurance-history`
- Add self-reported record end-to-end (form → save → appears on timeline)
- Timeline renders records in correct descending year order
- Explanation teaser appears on dashboard card after record exists
- Document upload pre-fills form fields (mocked extraction response)

---

## Out of Scope

- Real-time MassHealth API data pull (not available)
- Coverage gap detection / alerts (future feature)
- Multi-member household coverage (tracks primary applicant only for now)
- PDF export of history report
