# E2E Journey Pack

This project should run end-to-end QA by journey, not by page.

The goal is to verify a user can complete a real job across routing, auth, persistence, and backend calls. When a journey breaks, treat it as a product bug, not just a flaky test, until proven otherwise.

Use [COVERAGE_MATRIX.md](COVERAGE_MATRIX.md) for the current by-role status of `covered / partial / missing`.

## Running the suite

| Command | What it runs |
|---|---|
| `pnpm test:e2e` | Full suite — every spec in `e2e/tests/` |
| `pnpm test:e2e:journeys` | Curated UAT pack — all critical-path specs (see below) |
| `pnpm test:e2e:application` | Application flow + edge cases only |
| `pnpm test:e2e:edge-cases` | Application edge cases only (non-citizen, disability, multi-person, validation, session) |
| `pnpm test:e2e:reviewer` | Reviewer portal — both user-auth and reviewer-auth blocks |
| `pnpm test:e2e:appeal` | Appeal assistant — happy path + Ollama-unavailable fallback |
| `pnpm test:e2e:profile` | Profile + notifications |
| `pnpm test:e2e:ui` | Interactive Playwright UI for debugging |

Protected journeys require one of:

- local auth helpers enabled (`NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS=true`), or
- cloud E2E accounts supplied via `E2E_*` env vars (used by `e2e/global.setup.ts`)

If local auth helpers are disabled, `/api/auth/dev-register` returns `404` by design and auth-protected specs skip gracefully.

## Current journey pack (`pnpm test:e2e:journeys`)

Spec files included:

| Spec | Role | Journeys covered |
|---|---|---|
| `03-prescreener.spec.ts` | Public / Applicant | Public prescreener happy path; result → application type handoff; authenticated draft creation from prescreener |
| `05-benefit-stack.spec.ts` | Applicant | Benefit stack evaluation wizard end-to-end |
| `06-application.spec.ts` | Applicant | Draft creation; chat entry; wizard entry; autosave + refresh; PDF preview + download; income evidence upload; 500-error smoke; **edge cases**: validation gate, multi-person checklist, non-citizen coverage step, disability accommodation step, expired session |
| `07-appeal-assistant.spec.ts` | Applicant | Appeal form loads; denial form present; happy path with Ollama; no-500 check; **model-unavailable fallback** (graceful error when Ollama absent) |
| `08-profile.spec.ts` | Applicant | Profile page and tabs; settings tab; notifications tab preferences; notification bell entry point; no-500 check |
| `09-reviewer.spec.ts` | Reviewer | Portal page loads (customer auth); cases/audit/dashboard pages; **reviewer-role auth**: cases list structure, case detail navigation or panel open, audit trail timestamped events, dashboard stats, no-500 check |

## Journey design principles

Each journey answers four questions:

1. Can the user enter the flow?
2. Does the system persist the right state?
3. Can the user continue after navigation or refresh?
4. Do we avoid silent 500s or broken transitions?

## What is covered now

**Applicant happy paths**
- Prescreener → application type handoff → authenticated ACA-3 draft created
- Chat-first entry mode opens for draft
- Form wizard entry mode opens for draft
- Wizard autosave survives page reload
- Wizard PDF preview renders and download triggers
- Income evidence checklist loads and accepts document upload

**Applicant edge cases**
- Required name field gates Next button (disabled, not skippable)
- Two-person household produces two employment income sections in checklist
- Non-citizen applicant: coverage step shows citizenship/naturalized fields
- Disability + accommodation applicant: accommodation section visible on coverage step
- Expired session: app shows inline auth-required message (not a silent blank)

**Appeal assistant**
- Full generation flow when Ollama is running
- Graceful error message when model is unavailable (not a silent blank state)

**Reviewer portal**
- All three portal pages load without 500s
- Cases list shows case entries with reviewer-role account
- Case detail navigation or side-panel opens on row click
- Audit trail shows timestamped events or clear empty state

## Intentionally deferred

- Full wizard submission to MassHealth (pending backend API integration)
- AI-assisted intake with deterministic field extraction
- Reviewer approve / deny / RFI decision flow (pending submitted-case integration)
- Cross-role: applicant submits → reviewer sees case
- Social worker collaboration and session flows
- Admin invite / role management

## Bug loop

When a journey fails, classify it before fixing:

| Bucket | Examples | Action |
|---|---|---|
| Product bug | wrong route, missing state, broken transition | fix code + add regression test |
| Test gap | selector too weak, missing seed data, setup race | harden the test harness |
| Environment issue | missing Supabase auth, model unavailable, bad env vars | fix env or add graceful skip |
| Design issue | UX flow is impossible to complete reliably | treat as product bug |

Record per failure: journey name, exact step, expected vs observed, code/test/environment classification, regression plan.

## Next gaps to close (priority order)

1. Income verification: deterministic OCR + manual-review outcome after upload
2. Full submission flow after MassHealth API integration
3. Reviewer decision flow (approve / deny / RFI) after submission integration
4. Social worker collaboration and session flow
5. Admin invite / approval workflow
