# E2E Journey Pack

This project should run end-to-end QA by journey, not by page.

The goal is to verify a user can complete a real job across routing, auth, persistence, and backend calls. When a journey breaks, treat it as a product bug, not just a flaky test, until proven otherwise.

Use [`docs/qa/COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md) for the current by-role status of `covered / partial / missing`.

## Current Journey Pack

Run the current applicant-focused journey pack with:

```bash
pnpm test:e2e:journeys
```

Protected journeys require one of these setups:

- local auth helpers enabled with `NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS=true`, or
- pre-existing cloud E2E accounts supplied to Playwright through the `E2E_*` credential env vars used by `e2e/global.setup.ts`

If local auth helpers are disabled, the setup route `/api/auth/dev-register` returns `404 Not found` by design and auth-protected specs will skip.

This currently covers:

1. public prescreener flow
2. prescreener result -> application type handoff
3. new application draft creation
4. chat-first application entry path
5. form-wizard application entry path
6. application PDF preview + download handoff
7. application income evidence upload to queued extraction state
8. benefit stack evaluation

Run the application-focused suite only with:

```bash
pnpm test:e2e:application
```

## Journey Design

Each end-to-end journey should answer four questions:

1. can the user enter the flow?
2. does the system persist the right state?
3. can the user continue after navigation or refresh?
4. do we avoid silent 500s or broken transitions?

For this app, define journeys around user jobs:

- applicant starts a new ACA-3 application via chat
- applicant starts a new ACA-3 application via form wizard
- applicant reaches Review PDF and downloads the generated ACA-3 PDF
- applicant runs benefit stack and sees cross-program output
- applicant uses the prescreener and transitions into application flow
- reviewer opens and acts on a submitted case once backend submission exists

## Current Scope Vs Follow-Up

### Implemented now

- selecting an application type creates a draft and yields an `applicationId`
- the AI assistant entry mode opens for that draft
- the user can choose to start fresh in chat without needing model success
- the form wizard entry mode opens for the same draft
- the public prescreener can hand off into authenticated application draft creation
- a valid wizard draft can open Review PDF, generate a preview, and expose `Download PDF`
- a valid wizard draft can build the income evidence checklist and accept a real document upload
- the draft remains visible in `/customer/status`
- wizard autosave survives refresh for applicant-entered data
- journey pages are checked for server-side 500 responses

### Intentionally deferred

- full wizard submission to MassHealth
- full AI-assisted intake completion with deterministic extracted fields
- deterministic OCR/reviewer completion of income verification

Those are valid next bugs or enhancement tasks if the current QA pass shows gaps.

## Bug Loop

When a journey fails, capture the failure in one of these buckets:

| Bucket | Examples | Expected action |
|---|---|---|
| Product bug | wrong route, missing state, broken transition, invalid status | fix code and add regression coverage |
| Test gap | selector too weak, missing seeded data, setup race | harden test harness |
| Environment issue | missing Supabase auth, model unavailable, bad env vars | fix env or add graceful skip/fallback |
| Design issue | the UX flow is confusing or impossible to complete reliably | treat as product bug, not test noise |

Record for each failure:

- journey name
- exact step that failed
- expected result
- observed result
- whether the failure is code, test, or environment
- follow-up owner and regression test plan

## Suggested Expansion Order

Add the next end-to-end checks in this order:

1. applicant review step reaches stable PDF preview/download across more data variants
2. deterministic income verification after upload, including OCR/manual-review outcomes
3. reviewer sees and acts on a submitted application after backend integration exists
4. full submission handoff after MassHealth API integration

This order keeps the suite aligned to user value and avoids spending time on low-signal UI coverage first.
