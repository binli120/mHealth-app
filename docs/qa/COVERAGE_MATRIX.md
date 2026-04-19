# E2E Coverage Matrix

This matrix tracks browser-level journey coverage by role.

Status meanings:

- `Covered`: a dedicated E2E spec verifies a meaningful user outcome, not just page load
- `Partial`: smoke/demo/navigation coverage exists, but the full business workflow is not proven
- `Missing`: no dedicated E2E coverage yet

Important execution note:

- Protected-role specs currently depend on the auth setup in `e2e/global.setup.ts`.
- In this workspace, [`.env.local:16`](/Users/blee/dev/masshealth-repo/mHealth-app/.env.local#L16) has `NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS=false`, so auth-protected journeys will skip unless cloud E2E accounts are provided.

## Public / Unauthenticated

| Flow | Status | Current evidence | Notes |
|---|---|---|---|
| Landing page loads | Covered | [e2e/tests/01-landing.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/01-landing.spec.ts) | Includes title, hero, nav, and no-console-error checks |
| Landing -> register/login navigation | Covered | [e2e/tests/01-landing.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/01-landing.spec.ts) | Link-level journey only |
| Knowledge center entry | Partial | [e2e/tests/01-landing.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/01-landing.spec.ts) | Entry link covered, knowledge-center workflows not covered |
| Appeal assistant entry from landing | Partial | [e2e/tests/01-landing.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/01-landing.spec.ts) | Entry only |

## Applicant / Customer

| Flow | Status | Current evidence | Notes |
|---|---|---|---|
| Login page, register page, invalid auth handling | Covered | [e2e/tests/02-auth.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/02-auth.spec.ts) | UI and validation covered |
| Login with demo user to dashboard | Partial | [e2e/tests/02-auth.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/02-auth.spec.ts) | Real login path exists, but currently blocked by auth-helper config |
| Dashboard load and navigation | Partial | [e2e/tests/04-dashboard.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/04-dashboard.spec.ts) | Smoke/navigation, not a business workflow |
| Prescreener happy path | Covered | [e2e/tests/03-prescreener.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/03-prescreener.spec.ts) | Includes happy path and result visibility |
| Prescreener -> start application handoff | Covered | [e2e/tests/03-prescreener.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/03-prescreener.spec.ts) | Public screener now hands off into authenticated draft creation and status visibility |
| Benefit stack happy path | Covered | [e2e/tests/05-benefit-stack.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/05-benefit-stack.spec.ts) | Best current example of a true applicant journey |
| New application draft creation | Covered | [e2e/tests/06-application.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/06-application.spec.ts) | Draft creation via type selection is now asserted |
| New application via chat entry mode | Partial | [e2e/tests/06-application.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/06-application.spec.ts) | Entry and draft continuity covered; not full intake completion |
| New application via form wizard entry mode | Partial | [e2e/tests/06-application.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/06-application.spec.ts) | Entry and draft continuity covered; not full submission |
| Wizard autosave + refresh recovery | Covered | [e2e/tests/06-application.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/06-application.spec.ts) | Real applicant edit survives reload |
| Review PDF preview + download | Covered | [e2e/tests/06-application.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/06-application.spec.ts) | Current terminal applicant outcome before MassHealth API submission exists |
| Full application submission | Missing | None | Not a current product boundary until MassHealth API integration exists |
| Document upload during application | Covered | [e2e/tests/06-application.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/06-application.spec.ts) | Step 9 income evidence checklist now accepts a real applicant upload and returns queued extraction state |
| Income verification evidence workflow | Partial | [e2e/tests/06-application.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/06-application.spec.ts) | Checklist generation and document upload are covered; downstream OCR/manual-review decisioning is still environment-dependent |
| Application status tracking | Partial | [e2e/tests/06-application.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/06-application.spec.ts), [e2e/tests/04-dashboard.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/04-dashboard.spec.ts) | Draft visibility covered, no backend submission lifecycle yet |
| Profile tabs/settings/notifications | Partial | [e2e/tests/08-profile.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/08-profile.spec.ts) | Page and tab switching covered, persistence not |
| Appeal assistant generation | Partial | [e2e/tests/07-appeal-assistant.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/07-appeal-assistant.spec.ts) | True AI flow exists, but depends on local Ollama |
| Notifications inbox/read flows | Missing | None | No dedicated E2E yet |

## Reviewer / Staff Reviewer

| Flow | Status | Current evidence | Notes |
|---|---|---|---|
| Reviewer dashboard/cases/audit accessibility | Partial | [e2e/tests/09-reviewer.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/09-reviewer.spec.ts) | Page load and no-500 checks only |
| Reviewer acts on a submitted application | Missing | None | No approve/deny/RFI end-to-end flow |
| Reviewer sees applicant-submitted case created by applicant journey | Missing | None | Cross-role handoff not covered |

## Social Worker

| Flow | Status | Current evidence | Notes |
|---|---|---|---|
| Social worker dashboard/patients/sessions/messages visibility | Partial | [e2e/tests/demo-social-worker-role.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/demo-social-worker-role.spec.ts) | Demo smoke only |
| Social worker -> patient application collaboration | Missing | None | No dedicated journey |
| Session invite / accept / live session | Missing | None | README has manual instructions, no real E2E |
| Screen-share continuity across workflow | Missing | None | High-complexity flow, currently manual |
| Direct messaging workflow | Missing | None | No dedicated E2E |

## Admin

| Flow | Status | Current evidence | Notes |
|---|---|---|---|
| Admin dashboard/users/companies/social-workers visibility | Partial | [e2e/tests/demo-admin-role.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/demo-admin-role.spec.ts) | Demo smoke only |
| Invite user / approve social worker / manage roles | Missing | None | No dedicated admin workflow tests |
| Admin analytics/reports/export | Missing | None | No E2E coverage |

## Cross-Role / System Journeys

| Flow | Status | Current evidence | Notes |
|---|---|---|---|
| Applicant submits -> reviewer sees case | Missing | None | Deferred until backend submission integration exists |
| Applicant grants social worker access -> SW assists | Missing | None | No end-to-end coverage |
| Notification/event side effects across roles | Missing | None | No E2E coverage |
| AI failure fallback behavior in browser | Partial | [e2e/tests/07-appeal-assistant.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/07-appeal-assistant.spec.ts), [e2e/tests/06-application.spec.ts](/Users/blee/dev/masshealth-repo/mHealth-app/e2e/tests/06-application.spec.ts) | Some conditional skips and smoke checks exist, not systematic |

## Priority Order To Close Gaps

1. Stable PDF review/download across more applicant variants
2. Deterministic income verification beyond upload-queued state
3. Full applicant submission flow after backend integration
4. Applicant submission -> reviewer decision flow
5. Social worker collaboration/session flow
6. Admin invite/approval workflow

## Recommended Rule

Do not call a flow `Covered` unless the test proves the business outcome.

Examples:

- A page load is not the same as “reviewer can process a case”
- Opening `/application/new` is not the same as “applicant completed the current PDF-ready outcome”
- Visiting `/social-worker/sessions` is not the same as “screen-share workflow works”
