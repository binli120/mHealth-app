# HealthCompass MA — QA Playbook

This project does not need a separate QA repo. Keep quality gates in the main application repo, close to the feature code, test data, and deploy workflow.

Use this document as the operator playbook for release readiness, UAT, and regression coverage. Keep [`TEST_PLAN.md`](../TEST_PLAN.md) as the deeper inventory of test targets and coverage gaps.

For the current journey-based browser suite and how to treat failures as bugs, use [`docs/qa/E2E_JOURNEYS.md`](./qa/E2E_JOURNEYS.md).
For the current by-role browser coverage map, use [`docs/qa/COVERAGE_MATRIX.md`](./qa/COVERAGE_MATRIX.md).

## Principles

- Test the workflows that would block applicants, social workers, reviewers, or admins.
- Prefer small, stable automated coverage on critical paths over broad brittle UI automation.
- Treat UAT as a product acceptance gate, not an exploratory clicking session.
- Add one regression test for every escaped bug that was expensive or risky.

## QA Layers

| Layer | Tooling | Scope | Release gate |
|---|---|---|---|
| Static checks | TypeScript, ESLint | type safety, invalid imports, basic correctness | Every PR |
| Unit / integration | Vitest + Testing Library | API handlers, MassHealth logic, utilities, focused UI logic | Every PR |
| End-to-end | Playwright | applicant, staff, reviewer, and admin critical journeys | Before release, plus smoke in CI when stable |
| Manual UAT | staging + seeded accounts | changed feature, role boundary, recovery path | Every feature release |
| Production verification | OpenObserve, app logs, health checks | escaped errors and silent breakage | Immediately after deploy |

## Repo Structure

Keep the existing layout and make it explicit:

```text
app/
  **/__tests__/          # Route handlers and page-level logic tests
lib/
  **/__tests__/          # Business logic, policies, transforms, helpers
e2e/
  fixtures/              # Shared seed data for browser flows
  pages/                 # Playwright page objects
  tests/                 # Critical end-to-end journeys
  global.setup.ts        # Auth/bootstrap setup
docs/
  QA.md                  # Solo-engineer QA workflow and release gate
  qa/
    UAT_TEMPLATE.md      # Acceptance test template for new features
TEST_PLAN.md             # Coverage targets and test backlog
```

Recommended conventions:

- Keep Vitest tests colocated with the code they protect.
- Keep Playwright focused on cross-page workflows and role transitions.
- Use `demo-*.spec.ts` only for demo flows; keep release-critical checks in numbered specs.

## Minimum Release Gate

Every merge-ready change should satisfy this gate:

1. `pnpm lint`
2. `pnpm test`
3. `pnpm exec tsc --noEmit`
4. Critical Playwright smoke coverage for the changed workflow
5. Manual UAT on staging with the affected role(s)
6. Post-deploy check of logs and health endpoints

For low-risk copy or style changes, steps 4-6 can be reduced to a targeted smoke pass. For workflow, auth, data, AI, or document changes, run the full gate.

## What To Automate First

Prioritize automation by business risk:

| Priority | Flows |
|---|---|
| P0 | login, registration, applicant intake, PDF generation/download, reviewer decision after backend integration, admin invite/approval |
| P1 | benefit stack evaluation, appeal assistant, notifications, document upload, social worker workflow |
| P2 | profile polish, secondary dashboards, lower-traffic admin pages |

Current repo-aligned smoke set:

- `e2e/tests/02-auth.spec.ts`
- `e2e/tests/03-prescreener.spec.ts`
- `e2e/tests/05-benefit-stack.spec.ts`
- `e2e/tests/06-application.spec.ts`
- `e2e/tests/07-appeal-assistant.spec.ts`
- `e2e/tests/09-reviewer.spec.ts`

If release time is tight, run those first.

## UAT Workflow

Write UAT cases before implementation starts or at least before final review. A useful UAT case answers:

- who is the actor?
- what job are they trying to complete?
- what state are they starting from?
- what outcome proves the feature worked?
- what failure would be unacceptable?

For every feature, define at least:

- one happy path
- one invalid-input or missing-data path
- one role or permission boundary
- one recovery path after refresh, retry, or interruption

Use [`docs/qa/UAT_TEMPLATE.md`](./qa/UAT_TEMPLATE.md) for new scenarios.

## Feature Definition Of Done

A feature is not done until:

- acceptance criteria exist in product language
- the highest-risk behavior has automated coverage
- server and client errors are handled intentionally
- logs or telemetry exist for the core success/failure event
- manual UAT passed in a realistic environment
- rollback or mitigation is obvious if the release misbehaves

## PR Checklist

Use this checklist in the PR description or review notes:

```text
- [ ] Acceptance criteria updated
- [ ] Risk level identified (low / medium / high)
- [ ] Vitest coverage added or updated for changed logic
- [ ] Playwright coverage added or exercised for changed workflow
- [ ] Manual UAT completed on staging
- [ ] Logs / analytics / audit events verified
- [ ] Known edge cases documented
```

## Manual Release Checklist

Run this before production deployment:

```text
- [ ] Applicant can sign in and reach the expected landing page
- [ ] Primary changed workflow completes end to the current product boundary
- [ ] Invalid input shows correct error handling
- [ ] Correct role restrictions are enforced
- [ ] Expected DB-side or API-side state is persisted
- [ ] No new console errors on the affected pages
- [ ] No server exceptions for the exercised flow
- [ ] PDFs or other user-deliverable artifacts are generated when applicable
- [ ] Mobile viewport is usable for user-facing changes
- [ ] Feature flags and environment configuration are correct
```

## Test Data And Environments

Use seeded, stable accounts for UAT and smoke testing. Keep account setup, role notes, and local URLs in [`README.md`](../README.md). Do not depend on ad hoc local data for acceptance checks.

Environment expectations:

- local: fast developer feedback, mocked or safe local integrations
- staging: production-like config and realistic seeded data
- production: monitored rollout with health and error checks

## AI And High-Risk Workflow Notes

For agent, RAG, or document-processing changes, expand the gate:

- verify prompt contract changes explicitly
- test fallback behavior when model output is malformed or unavailable
- test a representative bad-document or low-confidence path
- track latency, failure rate, and cost-sensitive paths in logs

Acceptance for AI features should include:

- prompt goal
- retrieval source or policy source
- expected observable output
- guardrail or fallback behavior

## Commands

```bash
pnpm lint
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm test:e2e:ui
pnpm exec tsc --noEmit
```

## Operating Cadence

Use this weekly rhythm:

1. define acceptance criteria before building
2. add or update the highest-value automated checks during implementation
3. run manual UAT on staging before release
4. watch production logs and health after deploy
5. convert the most painful escaped bug into a permanent regression test

That cadence is enough for one engineer to ship reliably without creating a separate QA function.
