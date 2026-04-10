# HealthCompass MA — Test Plan

> **Goal:** Every push to `main` must pass unit tests with ≥ 90 % coverage (lines · functions · branches · statements) before deployment.
> **Runner:** Vitest 3 (unit) · Playwright (E2E)
> **CI:** `.github/workflows/ci.yml` — fails the deploy gate and auto-creates GitHub Issues on any failure.

---

## 1. Testing Layers

| Layer | Tool | When to run | What it covers |
|-------|------|-------------|----------------|
| Unit / integration | Vitest + Testing Library | Every push | API route handlers, business logic, utilities |
| E2E (happy paths) | Playwright | Pre-release / manual | Full user journeys in a real browser |
| Type safety | `tsc --noEmit` | Every push | All TypeScript across the repo |
| Lint | ESLint | Every push | Code style + Next.js rules |

---

## 2. Unit Test Coverage Targets

Coverage is enforced by `vitest.config.ts` at **90 %** on all four axes.
Run locally: `pnpm test:coverage` → open `coverage/index.html`.

### 2.1 API Routes (`app/api/**`)

| Route group | File | Status | Priority |
|-------------|------|--------|----------|
| `GET/POST /api/notifications` | `__tests__/routes.test.ts` | ✅ exists | — |
| `GET /api/notifications/unread-count` | same | ✅ exists | — |
| `POST /api/notifications/[id]/read` | same | ✅ exists | — |
| `POST /api/notifications/read-all` | same | ✅ exists | — |
| `GET /api/health/db` | `__tests__/route.test.ts` | ✅ exists | — |
| `POST /api/address/validate` | `__tests__/route.test.ts` | ✅ exists | — |
| Admin: users, companies, social-workers, stats | `admin/__tests__/*.test.ts` | ✅ exists | — |
| `POST /api/admin/users/invite` | `__tests__/invite.test.ts` | ✅ exists | — |
| `GET/POST /api/applications/[id]/documents` | `__tests__/route.test.ts` | ✅ exists | — |
| `GET /api/auth/invite/[token]` | `__tests__/route.test.ts` | ✅ exists | — |
| `GET/POST /api/sessions` | `__tests__/route.test.ts` | ✅ exists | — |
| `* /api/sessions/[sessionId]` | `__tests__/route.test.ts` | ✅ exists | — |
| `POST /api/pdf/generate` | `__tests__/route.test.ts` | ✅ exists | — |
| `POST /api/pdf/extract` | `__tests__/route.test.ts` | ✅ exists | — |
| `POST /api/forms/aca-3-0325/fill` | `__tests__/route.test.ts` | ✅ exists | — |
| `POST /api/chat/masshealth` | ❌ **missing** | **P1** |
| `POST /api/chat/transcribe` | ❌ **missing** | **P1** |
| `POST /api/chat/translate` | ❌ **missing** | **P1** |
| `POST /api/rag/ingest` | ❌ **missing** | **P1** |
| `GET  /api/rag/search` | ❌ **missing** | **P1** |
| `POST /api/applications` | ❌ **missing** | **P1** |
| `GET  /api/applications/[id]` | ❌ **missing** | **P1** |
| `PATCH /api/applications/[id]/draft` | ❌ **missing** | **P2** |
| Benefit orchestration: profile + evaluate | ❌ **missing** | **P1** |
| Identity verification routes | ❌ **missing** | **P2** |
| Appeals routes | ❌ **missing** | **P2** |

### 2.2 Business Logic (`lib/**`)

| Module | File | Status | Priority |
|--------|------|--------|----------|
| `lib/eligibility-engine.ts` | ❌ **missing** | **P1** |
| `lib/benefit-orchestration/orchestrator.ts` | ❌ **missing** | **P1** |
| `lib/benefit-orchestration/programs/*.ts` (9 evaluators) | ❌ **missing** | **P1** |
| `lib/benefit-orchestration/fpl-utils.ts` | ❌ **missing** | **P1** |
| `lib/notifications/` | ❌ **missing** | **P2** |
| `lib/pdf/generate.ts` | ❌ **missing** | **P2** |
| `lib/pdf/extract.ts` | ❌ **missing** | **P2** |
| `lib/rag/ingest.ts` | ❌ **missing** | **P2** |
| `lib/rag/search.ts` | ❌ **missing** | **P2** |
| `lib/auth/require-auth.ts` | ❌ **missing** | **P1** |
| `lib/utils/format.ts` | ❌ **missing** | **P2** |
| `lib/__tests__/utils.test.ts` | ✅ partial | **P2** |

### 2.3 Component Tests (`components/**`)

Component tests use React Testing Library. They are **excluded from coverage thresholds** today but should be added for critical interactive components.

| Component | Priority | Test type |
|-----------|----------|-----------|
| `FamilyProfileWizard` | P1 | Render + user interaction |
| `BenefitStackView` | P1 | Render + conditional display |
| `PrescreenerChat` | P1 | Message flow rendering |
| `NotificationBell` / `NotificationDropdown` | P2 | Badge count, click handlers |
| `ApplicationForm` | P2 | Field validation, step navigation |
| `AppealAssistant` | P3 | Chat message rendering |

---

## 3. E2E Happy-Path Tests (Playwright)

All specs live in `e2e/tests/`. Run: `pnpm test:e2e`.

| # | Spec file | Happy path | Status |
|---|-----------|------------|--------|
| 01 | `01-landing.spec.ts` | Landing page loads, CTA visible | ✅ |
| 02 | `02-auth.spec.ts` | Sign up → email confirm → login | ✅ |
| 03 | `03-prescreener.spec.ts` | MA resident → age → income → result | ✅ |
| 04 | `04-dashboard.spec.ts` | Dashboard loads with all cards | ✅ |
| 05 | `05-benefit-stack.spec.ts` | Enter family profile → see stacked benefits | ✅ |
| 06 | `06-application.spec.ts` | Start application → fill fields → submit | ✅ |
| 07 | `07-appeal-assistant.spec.ts` | Enter denial → AI generates appeal | ✅ |
| 08 | `08-profile.spec.ts` | View & update user profile | ✅ |
| 09 | `09-reviewer.spec.ts` | Social worker reviews application | ✅ |
| 10 | `demo-full-tour.spec.ts` | End-to-end tour across all features | ✅ |

**E2E gaps to add:**

| Scenario | Priority |
|----------|----------|
| Google OAuth login | P1 |
| Document upload during application | P2 |
| Real-time collaborative session | P2 |
| Notification bell → inbox → mark all read | P2 |
| Admin user management (invite, disable) | P3 |

---

## 4. Writing Tests — Patterns & Conventions

### Unit test (API route)
Follow the pattern in `app/api/notifications/__tests__/routes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// 1. Mock all external dependencies before importing route handlers
vi.mock("@/lib/db/some-module", () => ({ fn: vi.fn() }))
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

// 2. Import handlers after mocks
import { GET, POST } from "@/app/api/some-route/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"

// 3. Auth helpers
const mockAuth  = () => vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: "u1" } as never)
const mockNoAuth = () => {
  const res = new Response(JSON.stringify({ ok: false }), { status: 401 })
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: false, response: res } as never)
}

beforeEach(() => vi.clearAllMocks())

describe("GET /api/some-route", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoAuth()
    const res = await GET(new Request("http://localhost/api/some-route"))
    expect(res.status).toBe(401)
  })
  // ... happy path, error cases
})
```

### Unit test (pure function / business logic)
```ts
import { describe, it, expect } from "vitest"
import { getAnnualFPL, getIncomeAsFPLPercent } from "@/lib/eligibility-engine"

describe("getAnnualFPL", () => {
  it("returns base amount for household of 1", () => {
    expect(getAnnualFPL(1)).toBe(15_060)
  })
  it("adds $5,380 per additional person", () => {
    expect(getAnnualFPL(4)).toBe(15_060 + 3 * 5_380)
  })
})
```

### Component test
```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BenefitProgramCard } from "@/components/benefit-orchestration/BenefitProgramCard"

it("shows eligible badge when result is eligible", () => {
  render(<BenefitProgramCard result={{ program: "MassHealth", eligible: true, reason: "Income below 138% FPL" }} />)
  expect(screen.getByText(/eligible/i)).toBeInTheDocument()
})
```

---

## 5. Automation — How Everything Fits Together

```
git push main
     │
     ▼
.github/workflows/deploy.yml
     │
     └─► calls ci.yml (must pass before deploy)
              │
              ├── job: unit        pnpm test:ci
              │     ├── vitest run + @vitest/coverage-v8
              │     ├── threshold check (90% all axes)
              │     ├── upload coverage artifact (14 days)
              │     └── on failure → node scripts/create-ci-issues.mjs
              │                      → GitHub Issue per failing suite
              │                      → GitHub Issue if coverage < 90%
              │
              ├── job: lint        pnpm lint
              └── job: typecheck   pnpm tsc --noEmit

     (all three jobs pass)
     │
     ▼
deploy job: SSH → VPS → docker compose up → curl health check
```

**Local commands:**

```bash
pnpm test             # fast: run all unit tests once (no coverage)
pnpm test:watch       # TDD: re-run on file save
pnpm test:coverage    # full coverage report → open coverage/index.html
pnpm test:ci          # exactly what CI runs (JSON output + coverage)
pnpm test:e2e         # Playwright against http://localhost:3000
pnpm test:e2e:ui      # Playwright UI mode for debugging
```

---

## 6. Coverage Ramp-Up Plan

The 90 % threshold is enforced immediately. If the current baseline is below 90 %, CI will fail and a GitHub Issue will be created. Work through this ordered backlog:

| Sprint | Target modules | Expected coverage lift |
|--------|---------------|----------------------|
| 1 | `lib/eligibility-engine.ts`, `lib/benefit-orchestration/fpl-utils.ts` | +5 % |
| 2 | `lib/benefit-orchestration/programs/` (9 evaluators) | +15 % |
| 3 | `lib/benefit-orchestration/orchestrator.ts`, chat API routes | +10 % |
| 4 | `lib/auth/require-auth.ts`, RAG routes, application routes | +10 % |
| 5 | Component tests for Wizard, BenefitStackView, PrescreenerChat | +5 % |

> After each sprint run `pnpm test:coverage` and verify the threshold bar in the terminal summary.

---

## 7. Triage — Auto-Created GitHub Issues

When CI fails on `main`, `scripts/create-ci-issues.mjs` opens a GitHub Issue automatically with:
- Label `bug` + `test-failure` or `test-coverage` + `ci-failure`
- Link to the CI run artifacts
- Exact failing test names and error messages
- Copy-pasteable repro command

**Triage workflow:**
1. Check open issues with label `ci-failure`
2. Click the CI run link in the issue body → download `coverage-report` artifact
3. Fix the failing test or add missing coverage
4. Close the issue when the next CI run goes green
