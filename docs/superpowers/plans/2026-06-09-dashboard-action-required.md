# Dashboard Action Required Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-item "Action Required" card on the customer dashboard with a prioritized list showing deadline alerts, RFI requests, SW-modified confirmation items, stale drafts, and security placeholders.

**Architecture:** DB migration adds two columns to `applications`; `lib/applications/types.ts` and `lib/db/application-drafts.ts` expose them; a new `ActionRequiredCard` component computes and renders the prioritized list; the status detail page gains a SW-review confirmation banner; the SW draft-save path sets the new flags.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (PostgreSQL), Tailwind CSS, shadcn/ui, Lucide icons, Vitest

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `supabase/migrations/20260609000001_action_required_columns.sql` | Add `needs_customer_review` + `sw_last_modified_at` to `applications` |
| Modify | `lib/applications/types.ts` | Add `needsCustomerReview` + `swLastModifiedAt` to `ApplicationListRecord` |
| Modify | `lib/db/application-drafts.ts` | Select + expose new columns; add `confirmCustomerReview()` helper; set flags in SW save path |
| Create | `lib/masshealth/deadlines.ts` | Static list of MassHealth enrollment deadlines |
| Create | `components/dashboard/ActionRequiredCard.tsx` | Computes + renders the prioritized action item list |
| Create | `components/dashboard/__tests__/ActionRequiredCard.test.tsx` | Unit tests for action item computation |
| Modify | `app/customer/dashboard/page.tsx` | Replace inline Action Required card with `<ActionRequiredCard>` |
| Modify | `app/customer/status/[id]/page.tsx` | Add SW-review confirmation banner + confirm button |
| Create | `app/api/applications/[applicationId]/confirm-review/route.ts` | PATCH endpoint: clear `needs_customer_review` |

---

## Task 1: DB migration — add action-required columns

**Files:**
- Create: `supabase/migrations/20260609000001_action_required_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: add SW-modified tracking columns to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS needs_customer_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sw_last_modified_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_applications_needs_review
  ON public.applications(applicant_id)
  WHERE needs_customer_review = true;

COMMENT ON COLUMN public.applications.needs_customer_review IS
  'Set true when a social worker modifies draft data. Cleared when the customer confirms.';
COMMENT ON COLUMN public.applications.sw_last_modified_at IS
  'Timestamp of the last social-worker-initiated save on this application.';
```

- [ ] **Step 2: Apply the migration**

```bash
supabase db push
```

Expected: migration applies without errors. Verify:

```bash
supabase db diff --schema public | grep needs_customer_review
```

Expected output includes `needs_customer_review boolean`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260609000001_action_required_columns.sql
git commit -m "feat(db): add needs_customer_review and sw_last_modified_at to applications"
```

---

## Task 2: Type — expose new fields on `ApplicationListRecord`

**Files:**
- Modify: `lib/applications/types.ts`

- [ ] **Step 1: Add fields to `ApplicationListRecord`**

Open `lib/applications/types.ts`. After the `phiDraftLocked` field add:

```ts
  /** True when a social worker has modified this application and the customer has not yet confirmed. */
  needsCustomerReview: boolean
  /** ISO timestamp of the last SW-made save, or null if none. */
  swLastModifiedAt: string | null
```

The full interface becomes:

```ts
export interface ApplicationListRecord {
  id: string
  status: ApplicationStatus
  applicationType: string | null
  draftStep: number | null
  lastSavedAt: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
  applicantName: string | null
  householdSize: number | null
  /** True when an encrypted PHI blob + server-stored key exist for this draft. */
  phiDraftLocked: boolean
  /** True when a social worker has modified this application and the customer has not yet confirmed. */
  needsCustomerReview: boolean
  /** ISO timestamp of the last SW-made save, or null if none. */
  swLastModifiedAt: string | null
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `ApplicationListRecord`.

- [ ] **Step 3: Commit**

```bash
git add lib/applications/types.ts
git commit -m "feat(types): add needsCustomerReview and swLastModifiedAt to ApplicationListRecord"
```

---

## Task 3: DB layer — select new columns, add confirm helper, set flags on SW save

**Files:**
- Modify: `lib/db/application-drafts.ts`

- [ ] **Step 1: Add new columns to the `listApplicationDrafts` SELECT**

Find the `SELECT` block inside `listApplicationDrafts` (around line 362). It currently selects `phi_draft_locked`. Add the two new columns after it:

```sql
        needs_customer_review,
        sw_last_modified_at,
```

- [ ] **Step 2: Map new columns in the `listApplicationDrafts` return objects**

Find where the row is mapped to a JS object (around line 223 area, look for `phiDraftLocked: Boolean(row.phi_draft_locked)`). Add after it:

```ts
        needsCustomerReview: Boolean(row.needs_customer_review),
        swLastModifiedAt: (row.sw_last_modified_at as string | null) ?? null,
```

Do this for every SELECT block in the file that maps to an `ApplicationListRecord` (search for `phiDraftLocked:` — there may be 2–3 such blocks).

- [ ] **Step 3: Add `confirmCustomerReview` export**

At the end of `lib/db/application-drafts.ts`, add:

```ts
/**
 * Clear the needs_customer_review flag after the customer confirms SW-made changes.
 * Only clears if the application belongs to the given patient.
 */
export async function confirmCustomerReview(
  applicationId: string,
  patientUserId: string,
): Promise<void> {
  const { db } = await import("@/lib/db/client")
  await db.query(
    `UPDATE public.applications
        SET needs_customer_review = false
      WHERE id = $1::uuid
        AND applicant_id = (
          SELECT id FROM public.applicants WHERE user_id = $2::uuid LIMIT 1
        )`,
    [applicationId, patientUserId],
  )
}
```

> Note: use whatever db import pattern the file already uses — look at the top of the file for `import { db }` or `import { getDb }` and match it.

- [ ] **Step 4: Set flags when a social worker saves**

Search in `lib/db/application-drafts.ts` for the `upsertApplicationDraft` function signature. It accepts an `actingForUserId` parameter. Find the SQL `UPDATE` statement in that function path. After `last_saved_at = now()`, add:

```sql
        needs_customer_review = CASE WHEN $actingFor_param IS NOT NULL THEN true ELSE needs_customer_review END,
        sw_last_modified_at   = CASE WHEN $actingFor_param IS NOT NULL THEN now() ELSE sw_last_modified_at END,
```

Replace `$actingFor_param` with the actual positional parameter that carries `actingForUserId` in that query.

- [ ] **Step 5: Verify no TypeScript errors**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/db/application-drafts.ts
git commit -m "feat(db): expose needs_customer_review, add confirmCustomerReview, set flags on SW save"
```

---

## Task 4: MassHealth deadlines constant

**Files:**
- Create: `lib/masshealth/deadlines.ts`

- [ ] **Step 1: Create the file**

```ts
export interface MassHealthDeadline {
  label: string
  /** ISO 8601 date string, e.g. "2026-12-31" */
  isoDate: string
}

/**
 * Known MassHealth enrollment and renewal deadlines.
 * Add entries here as new deadlines are announced.
 * Entries more than 30 days in the past are ignored by the dashboard.
 */
export const MASSHEALTH_DEADLINES: MassHealthDeadline[] = [
  { label: "Annual renewal window closes", isoDate: "2026-12-31" },
]

/**
 * Returns deadlines whose date is between now and `windowDays` days from now (inclusive).
 */
export function getUpcomingDeadlines(
  now: Date,
  windowDays = 30,
): MassHealthDeadline[] {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() + windowDays)
  return MASSHEALTH_DEADLINES.filter((d) => {
    const deadline = new Date(d.isoDate)
    return deadline >= now && deadline <= cutoff
  })
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add lib/masshealth/deadlines.ts
git commit -m "feat(masshealth): add deadlines constant and getUpcomingDeadlines helper"
```

---

## Task 5: `ActionRequiredCard` component — tests first

**Files:**
- Create: `components/dashboard/__tests__/ActionRequiredCard.test.tsx`
- Create: `components/dashboard/ActionRequiredCard.tsx`

- [ ] **Step 1: Write the failing tests**

Create `components/dashboard/__tests__/ActionRequiredCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { ActionRequiredCard } from "../ActionRequiredCard"
import type { ApplicationListRecord } from "@/lib/applications/types"

// Freeze time so deadline/stale tests are deterministic
const NOW = new Date("2026-06-09T10:00:00Z")
beforeEach(() => { vi.setSystemTime(NOW) })
afterEach(() => { vi.useRealTimers() })
beforeAll(() => { vi.useFakeTimers() })

function makeApp(overrides: Partial<ApplicationListRecord> = {}): ApplicationListRecord {
  return {
    id: "app-1",
    status: "draft",
    applicationType: "aca3",
    draftStep: 2,
    lastSavedAt: new Date(NOW.getTime() - 10 * 86400_000).toISOString(), // 10 days ago
    submittedAt: null,
    createdAt: new Date(NOW.getTime() - 10 * 86400_000).toISOString(),
    updatedAt: new Date(NOW.getTime() - 10 * 86400_000).toISOString(),
    applicantName: "Test User",
    householdSize: null,
    phiDraftLocked: false,
    needsCustomerReview: false,
    swLastModifiedAt: null,
    ...overrides,
  }
}

describe("ActionRequiredCard", () => {
  it("shows no-action message when list is empty and no deadlines", () => {
    render(<ActionRequiredCard applications={[]} now={NOW} language="en" />)
    expect(screen.getByText(/no actions required/i)).toBeInTheDocument()
  })

  it("shows RFI item for rfi_requested application", () => {
    render(
      <ActionRequiredCard
        applications={[makeApp({ status: "rfi_requested" })]}
        now={NOW}
        language="en"
      />,
    )
    expect(screen.getByText(/information requested/i)).toBeInTheDocument()
  })

  it("shows SW-review item when needsCustomerReview is true", () => {
    render(
      <ActionRequiredCard
        applications={[makeApp({ needsCustomerReview: true, swLastModifiedAt: NOW.toISOString() })]}
        now={NOW}
        language="en"
      />,
    )
    expect(screen.getByText(/social worker updated/i)).toBeInTheDocument()
  })

  it("shows stale-draft item when draft not touched in 14+ days", () => {
    const fifteenDaysAgo = new Date(NOW.getTime() - 15 * 86400_000).toISOString()
    render(
      <ActionRequiredCard
        applications={[makeApp({ lastSavedAt: fifteenDaysAgo, createdAt: fifteenDaysAgo })]}
        now={NOW}
        language="en"
      />,
    )
    expect(screen.getByText(/application started/i)).toBeInTheDocument()
  })

  it("does NOT show stale-draft item when draft touched 10 days ago (under threshold)", () => {
    render(<ActionRequiredCard applications={[makeApp()]} now={NOW} language="en" />)
    expect(screen.queryByText(/application started/i)).not.toBeInTheDocument()
  })

  it("always shows security placeholder rows", () => {
    render(<ActionRequiredCard applications={[]} now={NOW} language="en" />)
    expect(screen.getByText(/review active login sessions/i)).toBeInTheDocument()
    expect(screen.getByText(/verify recovery options/i)).toBeInTheDocument()
  })

  it("renders multiple items in priority order: RFI before SW-review before stale", () => {
    const fifteenDaysAgo = new Date(NOW.getTime() - 15 * 86400_000).toISOString()
    render(
      <ActionRequiredCard
        applications={[
          makeApp({ id: "a1", status: "rfi_requested" }),
          makeApp({ id: "a2", needsCustomerReview: true }),
          makeApp({ id: "a3", lastSavedAt: fifteenDaysAgo, createdAt: fifteenDaysAgo }),
        ]}
        now={NOW}
        language="en"
      />,
    )
    const items = screen.getAllByRole("listitem")
    // First non-security item = RFI; second = SW-review; third = stale
    expect(items[0]).toHaveTextContent(/information requested/i)
    expect(items[1]).toHaveTextContent(/social worker updated/i)
    expect(items[2]).toHaveTextContent(/application started/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run components/dashboard/__tests__/ActionRequiredCard.test.tsx 2>&1 | tail -20
```

Expected: FAIL — `ActionRequiredCard` module not found.

- [ ] **Step 3: Implement `ActionRequiredCard`**

Create `components/dashboard/ActionRequiredCard.tsx`:

```tsx
"use client"

import Link from "next/link"
import { AlertCircle, Clock, Shield, Lock, UserCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { buildApplicationContinueHref } from "@/lib/applications/navigation"
import { getApplicationTypeLabel } from "@/lib/masshealth/application-types"
import { getUpcomingDeadlines } from "@/lib/masshealth/deadlines"
import { formatDate } from "@/lib/utils/format"
import type { ApplicationListRecord } from "@/lib/applications/types"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import { getMessage } from "@/lib/i18n/messages"

const STALE_DRAFT_DAYS = 14

interface ActionItem {
  key: string
  priority: number
  borderColor: string
  icon: React.ElementType
  label: string
  sublabel: string
  href?: string
  ctaLabel?: string
  isPlaceholder?: boolean
}

function computeActionItems(
  applications: ApplicationListRecord[],
  now: Date,
): ActionItem[] {
  const items: ActionItem[] = []

  // Priority 1: MassHealth deadlines
  const deadlines = getUpcomingDeadlines(now, 30)
  for (const d of deadlines) {
    const daysLeft = Math.ceil(
      (new Date(d.isoDate).getTime() - now.getTime()) / 86400_000,
    )
    items.push({
      key: `deadline-${d.isoDate}`,
      priority: 1,
      borderColor: "border-l-destructive",
      icon: AlertCircle,
      label: `Deadline in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      sublabel: d.label,
      href: "/customer/status",
      ctaLabel: "Review applications",
    })
  }

  // Priority 2: RFI requested
  for (const app of applications.filter((a) => a.status === "rfi_requested")) {
    items.push({
      key: `rfi-${app.id}`,
      priority: 2,
      borderColor: "border-l-destructive",
      icon: AlertCircle,
      label: "Information requested",
      sublabel: `${getApplicationTypeLabel(app.applicationType)} · ${app.id.slice(0, 8)}`,
      href: `/customer/status/${app.id}`,
      ctaLabel: "Review request",
    })
  }

  // Priority 3: SW-modified pending confirmation
  for (const app of applications.filter((a) => a.needsCustomerReview)) {
    items.push({
      key: `sw-review-${app.id}`,
      priority: 3,
      borderColor: "border-l-amber-500",
      icon: UserCheck,
      label: "Social worker updated your application",
      sublabel: app.swLastModifiedAt
        ? `Updated ${formatDate(app.swLastModifiedAt)} · ${app.id.slice(0, 8)}`
        : app.id.slice(0, 8),
      href: `/customer/status/${app.id}`,
      ctaLabel: "Review changes",
    })
  }

  // Priority 4: Stale drafts (not touched in 14+ days)
  const staleMs = STALE_DRAFT_DAYS * 86400_000
  for (const app of applications.filter((a) => a.status === "draft")) {
    const lastTouched = new Date(
      app.lastSavedAt ?? app.updatedAt ?? app.createdAt,
    ).getTime()
    if (now.getTime() - lastTouched >= staleMs) {
      const daysOld = Math.floor((now.getTime() - lastTouched) / 86400_000)
      items.push({
        key: `stale-${app.id}`,
        priority: 4,
        borderColor: "border-l-muted-foreground",
        icon: Clock,
        label: `Application started ${daysOld} day${daysOld === 1 ? "" : "s"} ago`,
        sublabel: `${getApplicationTypeLabel(app.applicationType)} · pick up where you left off`,
        href: buildApplicationContinueHref(app.id),
        ctaLabel: "Continue",
      })
    }
  }

  // Priority 5: Security placeholders (always shown, de-emphasized)
  items.push(
    {
      key: "security-sessions",
      priority: 5,
      borderColor: "border-l-border",
      icon: Shield,
      label: "Review active login sessions",
      sublabel: "Manage where your account is signed in",
      isPlaceholder: true,
    },
    {
      key: "security-recovery",
      priority: 5,
      borderColor: "border-l-border",
      icon: Lock,
      label: "Verify recovery options",
      sublabel: "Ensure your email and backup codes are up to date",
      isPlaceholder: true,
    },
  )

  return items.sort((a, b) => a.priority - b.priority)
}

interface Props {
  applications: ApplicationListRecord[]
  now?: Date
  language: SupportedLanguage
}

export function ActionRequiredCard({ applications, now = new Date(), language }: Props) {
  const items = computeActionItems(applications, now)
  const activeItems = items.filter((i) => !i.isPlaceholder)
  const placeholderItems = items.filter((i) => i.isPlaceholder)

  return (
    <Card className="border-warning/50 bg-warning/5" data-tour="dashboard-action-required">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
          <AlertCircle className="h-5 w-5 text-warning" />
          {getMessage(language, "dashboardActionRequired")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeItems.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            {getMessage(language, "dashboardNoActionRequired")}
          </p>
        ) : (
          <ul className="mb-4 space-y-2">
            {activeItems.map((item) => (
              <ActionItem key={item.key} item={item} />
            ))}
          </ul>
        )}

        {placeholderItems.length > 0 && (
          <div className="space-y-2 opacity-50">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Coming soon
            </p>
            <ul className="space-y-2">
              {placeholderItems.map((item) => (
                <ActionItem key={item.key} item={item} />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ActionItem({ item }: { item: ActionItem }) {
  const Icon = item.icon
  const row = (
    <li
      className={`flex items-center gap-3 rounded-lg border border-l-4 bg-card px-3 py-2 ${item.borderColor} border-border`}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.label}</p>
        <p className="truncate text-xs text-muted-foreground">{item.sublabel}</p>
      </div>
      {item.ctaLabel && item.href && (
        <Button asChild size="sm" variant="outline" className="shrink-0 text-xs">
          <Link href={item.href}>{item.ctaLabel}</Link>
        </Button>
      )}
    </li>
  )
  return row
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run components/dashboard/__tests__/ActionRequiredCard.test.tsx 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ActionRequiredCard.tsx components/dashboard/__tests__/ActionRequiredCard.test.tsx
git commit -m "feat(dashboard): add ActionRequiredCard with prioritized action items"
```

---

## Task 6: Wire `ActionRequiredCard` into the customer dashboard

**Files:**
- Modify: `app/customer/dashboard/page.tsx`

- [ ] **Step 1: Add import**

At the top of `app/customer/dashboard/page.tsx`, add the import after the existing dashboard component imports:

```ts
import { ActionRequiredCard } from "@/components/dashboard/ActionRequiredCard"
```

- [ ] **Step 2: Replace inline card**

Find the inline Action Required `<Card>` block (currently lines ~676–706, starting with `<Card className="border-warning/50 bg-warning/5" data-tour="dashboard-action-required">`). Replace everything from that opening `<Card>` tag through its closing `</Card>` tag with:

```tsx
<ActionRequiredCard
  applications={applications}
  language={language}
/>
```

Keep the surrounding `<DashboardWidgetTooltip>` wrapper unchanged.

- [ ] **Step 3: Remove `needsActionApp` useMemo** (it is now computed inside `ActionRequiredCard`)

Delete the `needsActionApp` `useMemo` block (around lines 309–312):

```ts
// DELETE this entire block:
const needsActionApp = useMemo(
  () => applications.find((item) => item.status === "rfi_requested"),
  [applications],
)
```

- [ ] **Step 4: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/customer/dashboard/page.tsx
git commit -m "feat(dashboard): replace inline action-required card with ActionRequiredCard component"
```

---

## Task 7: Confirm-review API endpoint

**Files:**
- Create: `app/api/applications/[applicationId]/confirm-review/route.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/applications/[applicationId]/confirm-review/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockConfirmCustomerReview = vi.fn()
vi.mock("@/lib/db/application-drafts", () => ({
  confirmCustomerReview: mockConfirmCustomerReview,
}))

const mockRequireAuth = vi.fn()
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: mockRequireAuth,
}))

const { PATCH } = await import("../route")

describe("PATCH /api/applications/[applicationId]/confirm-review", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    })
    const res = await PATCH(new Request("http://test/api/applications/app-1/confirm-review"), {
      params: Promise.resolve({ applicationId: "app-1" }),
    })
    expect(res.status).toBe(401)
  })

  it("calls confirmCustomerReview and returns ok:true on success", async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, userId: "user-1" })
    mockConfirmCustomerReview.mockResolvedValue(undefined)
    const res = await PATCH(new Request("http://test/api/applications/app-1/confirm-review"), {
      params: Promise.resolve({ applicationId: "app-1" }),
    })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockConfirmCustomerReview).toHaveBeenCalledWith("app-1", "user-1")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run "app/api/applications/\[applicationId\]/confirm-review/__tests__/route.test.ts" 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `app/api/applications/[applicationId]/confirm-review/route.ts`:

```ts
import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { confirmCustomerReview } from "@/lib/db/application-drafts"

interface RouteContext {
  params: Promise<{ applicationId: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const { applicationId } = await params

  try {
    await confirmCustomerReview(applicationId, authResult.userId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to confirm review." }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run "app/api/applications/\[applicationId\]/confirm-review/__tests__/route.test.ts" 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/applications/[applicationId]/confirm-review/route.ts" "app/api/applications/[applicationId]/confirm-review/__tests__/route.test.ts"
git commit -m "feat(api): add confirm-review PATCH endpoint to clear SW-review flag"
```

---

## Task 8: SW-review confirmation banner on the status detail page

**Files:**
- Modify: `app/customer/status/[id]/page.tsx`

- [ ] **Step 1: Add `needsCustomerReview` + `swLastModifiedAt` to `ApplicationDraftRecord`**

Open `app/customer/status/[id]/page.types.ts`. Find the `ApplicationDraftRecord` interface and add:

```ts
  needsCustomerReview: boolean
  swLastModifiedAt: string | null
```

- [ ] **Step 2: Add the SW-review banner to the status detail page**

Open `app/customer/status/[id]/page.tsx`. Add the following state near the top of the component (after other `useState` declarations):

```ts
const [confirmingReview, setConfirmingReview] = useState(false)
const [reviewConfirmed, setReviewConfirmed] = useState(false)
```

Then add this import at the top:

```ts
import { UserCheck } from "lucide-react"
```

Then, inside the page JSX, right after the loading/error guards and before the main content card, add:

```tsx
{record && record.needsCustomerReview && !reviewConfirmed && (
  <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950">
    <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
    <div className="flex-1">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
        A social worker updated information in this application
        {record.swLastModifiedAt ? ` on ${formatDate(record.swLastModifiedAt)}` : ""}.
        Please review the details below and confirm everything is correct.
      </p>
    </div>
    <Button
      size="sm"
      variant="outline"
      disabled={confirmingReview}
      className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200"
      onClick={async () => {
        setConfirmingReview(true)
        try {
          await authenticatedFetch(`/api/applications/${id}/confirm-review`, { method: "PATCH" })
          setReviewConfirmed(true)
        } finally {
          setConfirmingReview(false)
        }
      }}
    >
      {confirmingReview ? "Confirming…" : "Looks correct"}
    </Button>
  </div>
)}
```

- [ ] **Step 3: Ensure the API response maps `needsCustomerReview` / `swLastModifiedAt`**

The existing `GET /api/applications/[applicationId]/draft` route reads from `getApplicationDraft` in `lib/db/application-drafts.ts`. That function also maps rows — verify `needsCustomerReview` and `swLastModifiedAt` are included in the returned object (you added them in Task 3). If `getApplicationDraft` has its own separate SELECT, add the two new columns there too following the same pattern used in Task 3 Step 1–2.

- [ ] **Step 4: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/customer/status/[id]/page.tsx app/customer/status/[id]/page.types.ts
git commit -m "feat(status): add SW-review confirmation banner to application detail page"
```

---

## Task 9: Full test run

- [ ] **Step 1: Run unit tests**

```bash
pnpm vitest run 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 2: Run type check**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Run linter**

```bash
pnpm lint 2>&1 | tail -20
```

Expected: no new lint errors.

- [ ] **Step 4: Final commit if anything was touched**

```bash
git status
# only commit if there are unstaged changes from the above checks
```
