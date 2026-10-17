# SACA-2 Pre-Flag Gate (Phase 1c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the items the earlier final reviews said must be done before `SACA2_ENABLED` can be switched on: stop ACA-3 code from overwriting a SACA-2 draft, make autosave and Save & Exit trustworthy and visible, make the resume prompt blocking, replace `AbortSignal.timeout` for old Safari, and fix four small content defects (asset account types, closed-account balance, minor signer, spouse PCA help).

**Architecture:** One server-side guard in the draft upsert protects every ACA-3 client at once; two small client changes (a notice on the social-worker page, a refusal when creating a mobile hand-off) keep users from landing in the wrong wizard; the SACA-2 wizard gets a save-status state machine and a blocking resume step; the rest are local content or doc fixes. No new tables or migrations. The flag stays **off** until this plan is merged and the rollout checklist (Task 7) is done by the owner.

**Tech Stack:** TypeScript, Next.js App Router, node-postgres, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-13-saca2-application-design.md` (§4.3 persistence, §4.7 flag). Builds on plans `2026-10-13-saca2-foundation.md`, `2026-10-13-saca2-wizard-core.md`, `2026-10-14-saca2-remaining-steps.md`, `2026-10-14-saca2-supplements.md`, `2026-10-16-saca2-person-details.md` (all merged on `dev`).

## Scope and sequence

| Plan | Content | Status |
|---|---|---|
| 1, 2, 2b-1, 2b-2, 2b-3 | foundation through the full question content | merged |
| **2c (this file)** | pre-flag gate | ready |
| 3, 4, 5 | PDF fill; eligibility engine; i18n, chat, touchpoints, e2e, rollout | after 2c |

## Decisions made here (easy to change)

1. **Guard on the server, not in each client.** `upsertApplicationDraft` refuses (new `ApplicationDraftTypeConflictError`, HTTP 409, code `DRAFT_TYPE_CONFLICT`) a write when the stored row is a SACA-2 row and the incoming write is not. A row is SACA-2 when its `application_type` is `saca2` **or** its stored `draft_state` carries a `schemaVersion`. An incoming write is SACA-2 when it carries a `schemaVersion`. SACA-2 writes are never refused (the existing schemaVersion-aware overwrite of a leftover ACA-3 draft under a SACA-2 row stays). ACA-3 writes to ACA-3 rows are untouched.
2. **Clients stay dumb.** The ACA-3 clients are not changed to understand the 409 (they back off and show their existing failure state). The two entry points that can open an ACA-3 UI on a SACA-2 application — the social-worker "edit existing draft" page and the mobile hand-off — are blocked up front with a clear message so the 409 is a safety net, not the user experience.
3. **Save & Exit is never blocked by the PHI-free autosave.** The encrypted PHI blob holds the full state, so Save & Exit first makes one *forced* save attempt (ignoring the 15-second backoff); a non-retryable 4xx (400/403/409/413/422) is reported but does not stop the secure save; a network error, 5xx, or 429 on that forced attempt still stops it with a retry message.
4. **Autosave status is visible.** The wizard shows "Saving…", "All changes saved", or "Couldn't save — Retry" (a button) in an `aria-live="polite"` region; the retry bypasses the backoff.
5. **The resume prompt is blocking.** While a resume prompt is pending the step form and navigation are replaced by the prompt (restore or skip), so a restore can never overwrite typing the user did meanwhile.
6. **Old-Safari timeout:** a small `abortAfter(ms)` helper uses `AbortSignal.timeout` when it exists and an `AbortController` + `setTimeout` otherwise; the two SACA-2 hooks use it.
7. **Content fixes follow the form:** retirement-account types (IRA, Keogh, pension) join the account-type list; a closed account's *current* balance is not required (only the balance when it was closed); a non-emancipated minor cannot keep "The applicant" as the signer; the spouse PCA help text is third person.
8. **Deploy workflows are owner-owned.** This plan does not edit `.github/workflows/*`; Task 7 writes the flag-on checklist (including the `SACA2_ENABLED` variable for staging and prod) for the owner to run.

## Global Constraints

- Run commands from `/Users/blee/dev/masshealth-repo/mHealth-app` with Node 22: `export PATH=/Users/blee/.nvm/versions/node/v22.23.0/bin:$PATH` (the shell default, Node 18, cannot run vitest).
- PHI never in the server `draft_state` (unchanged). The guard must not log or return draft contents.
- Repo style: 2-space indent, no semicolons, double quotes, `@author: Bin Lee` / `@email: blee@comura.ai` header on every new file, tests in `__tests__/` next to the module, `@/` imports.
- ACA-3 behaviour must not change for ACA-3 applications; ACA-3, mobile, and social-worker tests stay green.
- Every test for a "hidden / not applied" behaviour must be non-vacuous: set up the state that would trigger the behaviour, and (for guards) confirm the test fails with the guard removed. Tests that pin SQL text (there is no real-Postgres harness) must pin the guard clause, not just any `WHERE`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The server guard cannot lock out a legitimate SACA-2 write** (including the first PUT of a brand-new SACA-2 application, a SACA-2 write over a leftover ACA-3-shaped draft, and a social-worker acting for a patient) and **does block** an ACA-3 PUT with and without `applicationType`. → Task 1.
2. **Access errors stay access errors**: a user who does not own the row still gets 403, not 409; a non-existent row still behaves as today. → Task 1.
3. **Save & Exit can always complete the secure save** except on network/5xx/429 after a forced retry; backoff never traps the user. → Task 3.
4. **No double save / out-of-order save** is introduced by the forced retry and the status machine (the serialized chain must still hold). → Task 3.
5. **Resume prompt blocks edits** and both "restore" and "skip" return the user to the form with the right state; a failed restore does not lose the prompt. → Task 4.
6. **Timeout helper** aborts after the delay, clears its timer, and does not leak when the request finishes first. → Task 5.
7. **Content fixes don't change fixtures' validity** (all three complete fixtures still validate; the rich-household fixture stays valid). → Task 6.

---

### Task 1: Server guard — ACA-3 writes can no longer overwrite a SACA-2 draft

**Files:**
- Modify: `lib/db/application-drafts.ts` (add the error class and the guard in `upsertApplicationDraft`)
- Modify: `app/api/applications/[applicationId]/draft/route.ts` (map the new error to HTTP 409)
- Modify: `app/api/applications/[applicationId]/draft/constants.ts` (new `STATUS_CONFLICT = 409`, `ERROR_DRAFT_TYPE_CONFLICT`)
- Test: `lib/db/__tests__/application-drafts-saca2-guard.test.ts` (create), `app/api/applications/[applicationId]/draft/__tests__/route.test.ts` (extend or create, following the existing test style next to the route if one exists; otherwise create)

**Interfaces:**
- Produces: `ApplicationDraftTypeConflictError` (exported, `name === "ApplicationDraftTypeConflictError"`); `upsertApplicationDraft` throws it instead of `ApplicationDraftAccessError` when the row exists, is owned by the applicant, and the guard blocked the write.

- [ ] **Step 1: Read the code and write failing tests.** Read `upsertApplicationDraft` (the `INSERT … ON CONFLICT (id) DO UPDATE … WHERE public.applications.applicant_id = $2::uuid RETURNING …` statement, ~line 495-565) and how the existing tests in `lib/db/__tests__/` mock `getDbPool` to capture SQL and params (for example the schemaVersion-aware upsert test added in plan 2). Write `application-drafts-saca2-guard.test.ts` with these cases (mock the pool; the SQL is pinned as text because there is no real-Postgres harness):
  1. The upsert SQL contains the guard predicate on the stored row: a `NOT (…)` clause that references both the stored `application_type`/`draft_state->>'schemaVersion'` and the incoming `($5::jsonb->>'schemaVersion')`/`$4`. Assert with `toContain` on stable fragments you choose when writing the SQL (for example `public.applications.application_type = 'saca2'` and `$5::jsonb ? 'schemaVersion'`).
  2. When the guarded UPDATE returns zero rows, the function re-reads the row (`getApplicationDraft`-style `SELECT`) and: if the row exists and belongs to the applicant it throws `ApplicationDraftTypeConflictError`; if the row does not exist or is not owned by the applicant it throws `ApplicationDraftAccessError` as today. (Mock the second query's rows to drive each branch.)
  3. A normal successful upsert (one row returned) returns the record and issues exactly one query (no extra read on the happy path).
  4. The incoming SACA-2 shape (a `wizardState` with `schemaVersion`) passes the same params as before (pin params order `[id, applicantId, status, applicationType, JSON, step, actingFor]` unchanged).

  In the route test, mock `upsertApplicationDraft` to throw `ApplicationDraftTypeConflictError` and expect `409` with `{ ok: false, error: ERROR_DRAFT_TYPE_CONFLICT }`; keep one case proving `ApplicationDraftAccessError` still maps to `403`.

- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run lib/db/__tests__/application-drafts-saca2-guard.test.ts app/api/applications`. Expected: FAIL (no guard, no error class).

- [ ] **Step 3: Implement.**
  - In `upsertApplicationDraft`'s `DO UPDATE` add to the final `WHERE` (after the `applicant_id` check):

```sql
        AND NOT (
          (
            public.applications.application_type = 'saca2'
            OR (public.applications.draft_state ? 'schemaVersion')
          )
          AND NOT ($5::jsonb ? 'schemaVersion')
        )
```

    (`?` here is the Postgres jsonb key-exists operator; node-postgres only treats `$n` as placeholders, so it is safe. If the project's SQL linter or the pool wrapper rejects `?`, use `jsonb_exists(public.applications.draft_state, 'schemaVersion')` and `jsonb_exists($5::jsonb, 'schemaVersion')` instead and pin those fragments in test 1.)
  - After the query, when `rows.length === 0`, run one more query selecting `id` for `id = $1 AND applicant_id = $2`; if a row comes back throw `new ApplicationDraftTypeConflictError()`, else throw `ApplicationDraftAccessError` as before. Add the class next to `ApplicationDraftAccessError` (same shape, default message "This application is a SACA-2 application and cannot be changed by this form.").
  - In the route add `isApplicationDraftTypeConflictError` (same name-based check as `isApplicationDraftAccessError`, because the class can be duplicated across bundles) and map it to `STATUS_CONFLICT`.

- [ ] **Step 4: Run tests, type check, lint.** `npx vitest run lib/db app/api/applications && npx tsc --noEmit -p tsconfig.json && npx eslint lib/db app/api/applications`. Expected: PASS. Mutation check: remove the guard fragment from the SQL — test 1 must fail; restore.

- [ ] **Step 5: Commit** — `fix(saca2): refuse ACA-3 writes to a SACA-2 application draft`.

---

### Task 2: Keep ACA-3 UIs away from SACA-2 applications

**Files:**
- Modify: `app/social-worker/patients/[patientId]/applications/[applicationId]/page.tsx`
- Modify: `app/api/handoff/route.ts`
- Test: `app/social-worker/patients/[patientId]/applications/[applicationId]/__tests__/page.test.tsx` (create), `app/api/handoff/__tests__/route.test.ts` (extend)

**Interfaces:**
- Consumes: `useIsSaca2Application(applicationId, reduxApplicationType, actingForPatientId)` and `Saca2UnavailableNotice` from `components/application/saca2/`; `getApplicationDraft`.
- Produces: the social-worker edit page renders a SACA-2 notice (not the ACA-3 chat/wizard) when the application is SACA-2 or the lookup fails; `POST /api/handoff` with `contextType: "intake_chat"` and an `applicationId` that is a SACA-2 application returns 400 `{ ok: false, error: "SACA-2 applications cannot be continued on a phone yet." }` and creates no session.

- [ ] **Step 1: Write failing tests.**
  - Page: render `SWEditApplicationPage` with `useParams` mocked and `useIsSaca2Application` mocked to `"saca2"` → the `saca2-unavailable` notice is shown, `FormWizard` and `IntakeChat` (mock both as `data-testid` stubs) are **not** rendered. Mocked `"error"` → also the notice (fail closed, same as `app/application/new/page.tsx`). Mocked `"other"` → the existing tabs render. Mocked `"unknown"` → a loading state (no wizard yet).
  - Handoff route: with `getApplicationDraft`/the lookup mocked to return `applicationType: "saca2"` for the payload's `applicationId`, a POST for `intake_chat` returns 400 and `createHandoffSession` is not called; for an ACA-3 type it proceeds as today; for other context types (`mh_chat`, `voice_message`) it never looks up the application.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.** Page: call the hook before any early return (hooks order), pass `""` as the redux type, and render the notice for `"saca2"`/`"error"`, a loading line for `"unknown"`, the existing UI for `"other"`. Handoff route: when `contextType === "intake_chat"` and `contextPayload.applicationId` is a string, look up the application's type with the existing DB helper for the authenticated user (use `getApplicationDraft(auth.userId, applicationId)`; the hand-off is created by the applicant, not a social worker) and refuse when `applicationType === "saca2"`; a missing row falls through to the existing validation.

- [ ] **Step 4: Run tests, type check, lint** (`app/social-worker app/api/handoff components/application/saca2`).

- [ ] **Step 5: Commit** — `fix(saca2): block the social-worker edit page and mobile hand-off for SACA-2 applications`.

---

### Task 3: Autosave status, retry, and a Save & Exit that cannot be trapped

**Files:**
- Modify: `components/application/saca2/saca2-wizard.tsx`
- Create: `components/application/saca2/saca2-save-status.tsx`
- Test: `components/application/saca2/__tests__/saca2-wizard-save.test.tsx` (create), `components/application/saca2/__tests__/saca2-save-status.test.tsx` (create)

**Interfaces:**
- Produces: `Saca2SaveStatus` (props `{ status: "idle" | "saving" | "saved" | "error"; onRetry: () => void }`) rendering a `role="status"` `aria-live="polite"` line: "Saving…", "All changes saved", or "Couldn't save your changes" with a "Retry" button; `idle` renders nothing. In the wizard, `doSave(options?: { force?: boolean }): Promise<SaveResult>` where `SaveResult = "saved" | "retryable" | "fatal"`; `saveDraftNow` and the Save & Exit hook use it as described below.

- [ ] **Step 1: Write failing tests** (mock `authenticatedFetch`, `splitWizardState` is real; use fake timers where needed):
  1. **Status line**: after an edit the line reads "Saving…" while the PUT is pending and "All changes saved" once it resolves OK; on a 500 it reads "Couldn't save your changes" with a Retry button; clicking Retry sends a PUT immediately **even inside the 15 s backoff window** and, on success, shows "All changes saved".
  2. **Backoff still applies to autosave**: after a 500 a second edit within 15 s does not send a PUT (call count unchanged) but the status stays "Couldn't save…".
  3. **Save & Exit forced attempt**: with backoff active, opening Save & Exit and confirming sends one PUT despite the backoff (assert the call count increases by one) and then proceeds to the secure save (`onBeforeSecureSave` resolves `true`).
  4. **Non-retryable 4xx doesn't trap**: when that forced PUT returns 409 (and separately 413), `onBeforeSecureSave` resolves `true` so the secure save proceeds, and the status line shows the error state.
  5. **Retryable failures still block**: forced PUT returns 500 / 429 / throws → `onBeforeSecureSave` resolves `false` (the dialog shows its existing error).
  6. **No overlap**: two rapid edits plus a Retry never have two PUTs in flight (track concurrent calls with a counter in the mock; the maximum must be 1).
  7. A 400/403 during autosave sets the error state **without** starting the 15 s backoff (the user can retry at once), while 5xx/429/network start the backoff — pin both.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.**
  - Add `saveStatus` state (`idle|saving|saved|error`). `doSave` sets `saving` when the PUT starts, `saved` on success only if the state key is still current (otherwise `idle`→ the next autosave will run), and `error` on any failure.
  - `doSave({ force })`: skip the backoff check when `force`; map outcomes: `response.ok` → `"saved"`; status 400/403/409/413/422 → `"fatal"` (no backoff); 429/5xx/throw → `"retryable"` (backoff set unless `force`… set it regardless so autosave pauses, but `force` ignores it when reading).
  - `saveDraftNow(options)` keeps the serialized chain and returns the `SaveResult`; autosave calls it without `force`; the Retry button calls it with `force: true`.
  - `onBeforeSecureSave` passed to `PhiSaveExitDialog`: `async () => { const r = await saveDraftNow({ force: true }); return r !== "retryable" }`.
  - Render `<Saca2SaveStatus status={saveStatus} onRetry={…} />` above the Back/Next row.

- [ ] **Step 4: Run tests, type check, lint** (`components/application/saca2`). Existing wizard tests must stay green; where one asserts `onBeforeSecureSave` returned `false` after any failure, update it to the 5xx case (justified; nothing loosened).

- [ ] **Step 5: Commit** — `feat(saca2): show autosave status with retry and never trap Save & Exit behind the backoff`.

---

### Task 4: Blocking resume prompt

**Files:**
- Modify: `components/application/saca2/saca2-wizard.tsx` (render the prompt instead of the form while pending)
- Test: `components/application/saca2/__tests__/saca2-wizard-resume.test.tsx` (create)

**Interfaces:**
- Consumes: `PhiResumePrompt` (unchanged API: `onRestored(merged)`, `onSkip()`).
- Produces: while `pendingResume` is set, the wizard renders the `PhiResumePrompt` (plus the existing restore-error line) **in place of** the step form, the Back/Save & Exit/Next row, and the autosave status; the step list sidebar stays. After restore the normal form returns with the restored state; after skip it returns with the server (PHI-free) state.

- [ ] **Step 1: Write failing tests:** (a) with a hydrating draft that has `phiDraftResumeId` and no server key, the form (`data-testid` for the step form) is **not** in the document and the prompt is; (b) typing cannot happen (no inputs from the step form exist); (c) calling the mocked `PhiResumePrompt`'s `onRestored` with a valid merged state shows the form with the restored values; (d) `onSkip` shows the form with the server state; (e) `onRestored` with an invalid payload keeps the prompt and shows the restore-error alert (existing behaviour, now with the form still hidden); (f) no autosave PUT is sent while the prompt is pending (dirty cannot be true, but assert call count 0 after waiting past the autosave delay).

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** by wrapping the existing step form + button row in `pendingResume ? <prompt/> : <form…/>`; leave hydration unchanged.

- [ ] **Step 4: Run tests, type check, lint.**

- [ ] **Step 5: Commit** — `fix(saca2): make the resume prompt blocking so a restore cannot overwrite new edits`.

---

### Task 5: Safe abort-timeout helper for old Safari

**Files:**
- Create: `lib/utils/abort-after.ts`
- Modify: `components/application/saca2/use-saca2-enabled.ts`, `components/application/saca2/use-is-saca2-application.ts`
- Test: `lib/utils/__tests__/abort-after.test.ts` (create); extend the two hooks' existing tests only if they stub `AbortSignal.timeout`

**Interfaces:**
- Produces: `abortAfter(ms: number): { signal: AbortSignal; cancel: () => void }`. Uses `AbortSignal.timeout(ms)` when it exists (then `cancel` is a no-op), otherwise an `AbortController` aborted by `setTimeout`, with `cancel` clearing the timer.

- [ ] **Step 1: Write failing tests** (fake timers): with `AbortSignal.timeout` present the signal aborts after `ms`; with it deleted (`vi.stubGlobal` on a copy of `AbortSignal` without `timeout`) the fallback signal aborts after `ms`, `reason`/`aborted` is set, and `cancel()` before `ms` prevents the abort and clears the timer (assert `vi.getTimerCount() === 0`); `ms <= 0` aborts on the next tick; calling `cancel()` twice is safe.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** the helper; in both hooks replace `AbortSignal.timeout(6_000)` with `const { signal, cancel } = abortAfter(6_000)` and call `cancel()` in the promise's `finally` (and in the effect cleanup) so the fallback timer never leaks. Keep each hook's result semantics unchanged (timeouts still map to `"error"` / fail-closed).
- [ ] **Step 4: Run tests, type check, lint** (`lib/utils components/application/saca2 app/application`).
- [ ] **Step 5: Commit** — `fix(saca2): use a timeout helper that works on Safari 15 and older`.

---

### Task 6: Content defects found in the earlier reviews

**Files:**
- Modify: `lib/masshealth/saca2/questions/assets.ts`, `lib/masshealth/saca2/questions/root-steps.ts`, `lib/masshealth/saca2/questions/coverage.ts`
- Test: extend `lib/masshealth/saca2/__tests__/questions-assets.test.ts`, `questions-signing.test.ts`, `questions-coverage.test.ts`; fixtures only if a test shows a regression

**Interfaces / rules:**
1. **Retirement account types.** `ACCOUNT_TYPES` (assets.ts ~line 48) gains `["ira","Individual retirement account (IRA)"]`, `["keogh","Keogh plan"]`, `["pension","Pension fund"]`, placed before `other`. Form check: re-read the SACA-2 Step 5 account list (`pdftotext -layout` on the assets pages) and make the labels match the form; add any other type the form lists that is missing.
2. **Closed accounts.** In the bank-account row, `currentBalance` is required only while the account is open (`ctx.item?.open !== false`) and hidden when `open === false`; `balanceWhenClosed` stays required for closed accounts. A closed account with a stale `currentBalance` produces no error; an open account without one still does.
3. **Minor signer.** In `SIGNATURE_STEP_CONTENT`, add a `validateStep` check (the file already has a step-level hook at ~line 45 for another step — add one for this content object) returning `{ "signature.signedBy": "A responsible party must sign for an applicant who is younger than 18 and not an emancipated minor." }` when `applicantIsMinor` and `signing.emancipatedMinor === "no"` and `signature.signedBy === "applicant"`. An emancipated minor (`"yes"`) may sign as the applicant; an adult is unaffected; `signedBy` null still gets the ordinary required error, not this one.
4. **Spouse PCA help.** The `willContactPcmAgency` help (coverage.ts ~line 62) is a fixed second-person string for both people. Make it a function of the person: Person 1 keeps the current text; the spouse version reads "Your spouse must contact the PCM agency within 90 days of the date MassHealth decides they are eligible, or they will not be able to benefit from the special PCA rules. If both of you answered Yes to all parts of Question 3, each of you completes your own Supplement C." Pin both strings.

- [ ] **Step 1: Write failing tests** for each rule above (assets: type list contains the new values in order and an IRA row validates; closed account without a current balance validates and with `open: true` and no balance fails; signing: the four cases in rule 3 with exact error objects; coverage: both help strings).
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.** Use `rowIsOpen = (ctx) => ctx.item?.open !== false` for rule 2.
- [ ] **Step 4: Run** `npx vitest run lib/masshealth/saca2 components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2`. All three complete fixtures and the rich household must still validate; if one fails, the fixture is wrong (fix it realistically), never the rule.
- [ ] **Step 5: Commit** — `fix(saca2): add retirement account types, relax closed-account balance, require a responsible party for non-emancipated minors, and word the spouse PCA help`.

---

### Task 7: Spec line, flag-on checklist, and final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-10-13-saca2-application-design.md` (§4.3 and §6)
- Create: `docs/superpowers/saca2-flag-on-checklist.md`

- [ ] **Step 1: Fix the stale §4.3 text.** It says the PHI keys must be added to `lib/phi-token/phi-fields.ts` **and** a mirrored `SERVER_PHI_DATA_KEYS` in `lib/db/application-drafts.ts` with a test asserting equality, lists only `assets`, `transfers`, `supplements`, and shows `application_type = "saca2"`. The code now has **one** shared list (`PHI_DATA_KEYS` in `lib/phi-token/phi-fields.ts`, imported by the client split and the server strip) containing `screening, persons, aian, previousMedicalBills, assets, transfers, health, pca, supplements, signing, attachments`; only `intake` and `signature` reach the server. Rewrite the bullet accordingly and add a sentence describing the new draft-type guard (Task 1).
- [ ] **Step 2: Update the §6 Phase 1 row** to name this plan (`2026-10-17-saca2-flag-gate.md`) as the "gate before the flag", "— done once merged".
- [ ] **Step 3: Write `docs/superpowers/saca2-flag-on-checklist.md`** — a short checklist for the owner, each item a checkbox with the exact place to do it: set `SACA2_ENABLED=true` in `.env.local` for local testing; add the variable to the staging and production environments (`.github/workflows/deploy-staging.yml`, `deploy-prod.yml`, `deploy.yml` env/secrets block — **owner edits these**); smoke test with a real draft on staging (create → autosave → Save & Exit → resume with a restore code → finish); verify that opening the same application from the social-worker page shows the SACA-2 notice and that a mobile hand-off is refused; confirm `GET /api/config/saca2` returns `{ enabled: true }`; note that the PDF fill (plan 3) is not yet available, so turning the flag on exposes data collection only.
- [ ] **Step 4: Full verification.** `npx vitest run && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2 lib/db lib/utils components/application app/application app/api app/social-worker`. Expected: everything passes (re-run load-sensitive unrelated files alone if they time out, and report).
- [ ] **Step 5: Commit** — `docs(saca2): correct the persistence section and add the flag-on checklist`.

---

## What comes next (not part of this plan)

- **Plan 3:** PDF field map and fill route using these answers. It must fill only what is visible at both step and question level (stale answers persist after gates flip), and gate income-row fields by `kind`.
- **Deferred minors still open:** Supplement A is sticky once an intro question is answered Yes; caregiver-children list sits far from its gate; old `rental` income rows load as "Choose one"; cross-field step errors clear only on Next; terse year error; due-date sanity check.
