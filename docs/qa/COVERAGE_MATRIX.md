# E2E Coverage Matrix

This matrix tracks browser-level journey coverage by role.

Status meanings:

- `Covered`: a dedicated E2E spec verifies a meaningful user outcome, not just page load
- `Partial`: smoke/demo/navigation coverage exists, but the full business workflow is not proven
- `Missing`: no dedicated E2E coverage yet

Important execution note:

- Protected-role specs currently depend on the auth setup in `e2e/global.setup.ts`.
- In this workspace, [`.env.local:16`](../../.env.local#L16) has `NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS=false`, so auth-protected journeys will skip unless cloud E2E accounts are provided.

## Public / Unauthenticated

| Flow | Status | Current evidence | Notes |
|---|---|---|---|
| Landing page loads | Covered | [e2e/tests/01-landing.spec.ts](../../e2e/tests/01-landing.spec.ts) | Includes title, hero, nav, and no-console-error checks |
| Landing -> register/login navigation | Covered | [e2e/tests/01-landing.spec.ts](../../e2e/tests/01-landing.spec.ts) | Link-level journey only |
| Knowledge center entry | Partial | [e2e/tests/01-landing.spec.ts](../../e2e/tests/01-landing.spec.ts) | Entry link covered, knowledge-center workflows not covered |
| Appeal assistant entry from landing | Partial | [e2e/tests/01-landing.spec.ts](../../e2e/tests/01-landing.spec.ts) | Entry only |

## Applicant / Customer

| Flow | Status | Current evidence | Notes |
|---|---|---|---|
| Login page, register page, invalid auth handling | Covered | [e2e/tests/02-auth.spec.ts](../../e2e/tests/02-auth.spec.ts) | UI and validation covered |
| Login with demo user to dashboard | Partial | [e2e/tests/02-auth.spec.ts](../../e2e/tests/02-auth.spec.ts) | Real login path exists, but currently blocked by auth-helper config |
| Dashboard load and navigation | Partial | [e2e/tests/04-dashboard.spec.ts](../../e2e/tests/04-dashboard.spec.ts) | Smoke/navigation, not a business workflow |
| Prescreener happy path | Covered | [e2e/tests/03-prescreener.spec.ts](../../e2e/tests/03-prescreener.spec.ts) | Includes happy path and result visibility |
| Prescreener -> start application handoff | Covered | [e2e/tests/03-prescreener.spec.ts](../../e2e/tests/03-prescreener.spec.ts) | Public screener hands off into authenticated draft creation and status visibility |
| Benefit stack happy path | Covered | [e2e/tests/05-benefit-stack.spec.ts](../../e2e/tests/05-benefit-stack.spec.ts) | Best current example of a true applicant journey |
| New application draft creation | Covered | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts) | Draft creation via type selection is now asserted |
| New application via chat entry mode | Partial | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts) | Entry and draft continuity covered; not full intake completion |
| New application via form wizard entry mode | Partial | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts) | Entry and draft continuity covered; not full submission |
| Wizard autosave + refresh recovery | Covered | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts) | Real applicant edit survives reload |
| Wizard required field validation error | Covered | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts) | Empty required name triggers visible validation error before advance |
| Review PDF preview + download | Covered | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts) | Current terminal applicant outcome before MassHealth API submission exists |
| Full application submission | Missing | None | Not a current product boundary until MassHealth API integration exists |
| Document upload during application | Covered | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts) | Step 9 income evidence checklist accepts a real applicant upload and returns queued extraction state |
| Multi-person household income checklist | Covered | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts) | Two-person household seed produces two employment income sections in the checklist |
| Non-citizen applicant path | Covered | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts) | Non-citizen seed at step 4 surfaces immigration status fields |
| Applicant with disability / accommodation needs | Covered | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts) | Disability + accommodation seed at step 4 surfaces accommodation section |
| Income verification evidence workflow | Partial | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts) | Checklist generation and document upload are covered; downstream OCR/manual-review decisioning is environment-dependent |
| Application status tracking | Partial | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts), [e2e/tests/04-dashboard.spec.ts](../../e2e/tests/04-dashboard.spec.ts) | Draft visibility covered, no backend submission lifecycle yet |
| Expired session redirect to login | Covered | [e2e/tests/06-application.spec.ts](../../e2e/tests/06-application.spec.ts) | Clearing Supabase auth tokens and reloading verifies redirect to login route |
| Profile tabs/settings/notifications preferences | Partial | [e2e/tests/08-profile.spec.ts](../../e2e/tests/08-profile.spec.ts) | Tab switching covered; preference persistence not verified |
| Notifications inbox page | Partial | [e2e/tests/08-profile.spec.ts](../../e2e/tests/08-profile.spec.ts) | Accessible via profile tab and nav bell only — no standalone `/customer/notifications` route exists yet |
| Appeal assistant generation | Partial | [e2e/tests/07-appeal-assistant.spec.ts](../../e2e/tests/07-appeal-assistant.spec.ts) | True AI flow exists, but depends on local Ollama |
| Appeal assistant model-unavailable fallback | Covered | [e2e/tests/07-appeal-assistant.spec.ts](../../e2e/tests/07-appeal-assistant.spec.ts) | When Ollama is absent, verifies UI shows a graceful error instead of a silent blank state |

## Reviewer / Staff Reviewer

| Flow | Status | Current evidence | Notes |
|---|---|---|---|
| Reviewer dashboard/cases/audit accessibility (customer account) | Partial | [e2e/tests/09-reviewer.spec.ts](../../e2e/tests/09-reviewer.spec.ts) | Page load and no-500 checks with demo customer user |
| Reviewer portal with reviewer role account | Covered | [e2e/tests/09-reviewer.spec.ts](../../e2e/tests/09-reviewer.spec.ts) | Dedicated reviewer.json auth; dashboard stats, no-500, and page structure verified |
| Reviewer case detail navigation | Partial | [e2e/tests/09-reviewer.spec.ts](../../e2e/tests/09-reviewer.spec.ts) | Clicks first case if present, or asserts empty state — no submitted cases without backend integration |
| Reviewer audit trail | Covered | [e2e/tests/09-reviewer.spec.ts](../../e2e/tests/09-reviewer.spec.ts) | Asserts timestamped events or a clear empty state |
| Reviewer acts on a submitted application | Missing | None | No approve/deny/RFI flow — deferred until MassHealth API integration |
| Reviewer sees applicant-submitted case (cross-role) | Missing | None | Cross-role handoff not covered — deferred until backend submission integration |

## Social Worker

| Flow | Status | Current evidence | Notes |
|---|---|---|---|
| Social worker dashboard/patients/sessions/messages visibility | Partial | [e2e/tests/demo-social-worker-role.spec.ts](../../e2e/tests/demo-social-worker-role.spec.ts) | Demo smoke only |
| Social worker -> patient application collaboration | Missing | None | No dedicated journey |
| Session invite / accept / live session | Missing | None | README has manual instructions, no real E2E |
| Screen-share continuity across workflow | Missing | None | High-complexity flow, currently manual |
| Direct messaging workflow | Missing | None | No dedicated E2E |

## Admin

| Flow | Status | Current evidence | Notes |
|---|---|---|---|
| Admin dashboard/users/companies/social-workers visibility | Partial | [e2e/tests/demo-admin-role.spec.ts](../../e2e/tests/demo-admin-role.spec.ts) | Demo smoke only |
| Invite user / approve social worker / manage roles | Missing | None | No dedicated admin workflow tests |
| Admin analytics/reports/export | Missing | None | No E2E coverage |

## Cross-Role / System Journeys

| Flow | Status | Current evidence | Notes |
|---|---|---|---|
| Applicant submits -> reviewer sees case | Missing | None | Deferred until backend submission integration exists |
| Applicant grants social worker access -> SW assists | Missing | None | No end-to-end coverage |
| Notification/event side effects across roles | Missing | None | No E2E coverage |
| AI failure fallback behavior in browser | Covered | [e2e/tests/07-appeal-assistant.spec.ts](../../e2e/tests/07-appeal-assistant.spec.ts) | Model-unavailable path now verified to produce a user-facing error, not a silent blank |

## Priority Order To Close Remaining Gaps

1. Deterministic income verification beyond upload-queued state (OCR + manual-review outcomes)
2. Full applicant submission flow after backend API integration
3. Applicant submission -> reviewer decision flow (approve / deny / RFI)
4. Social worker collaboration/session flow
5. Admin invite/approval workflow

## Recommended Rule

Do not call a flow `Covered` unless the test proves the business outcome.

Examples:

- A page load is not the same as "reviewer can process a case"
- Opening `/application/new` is not the same as "applicant completed the current PDF-ready outcome"
- Visiting `/social-worker/sessions` is not the same as "screen-share workflow works"
