# Personal Data Presence Implementation Plan

> **Execution:** Implement test-first. The presence check must count only meaningful user-entered content and must never treat an error as an empty account.

**Goal:** Hide the personal-data delete action for empty customer accounts and restore it when profile, application, message, or file data exists.

**Architecture:** A server-only repository function executes indexed `EXISTS` checks across the authoritative user-entered data boundary. Authenticated `GET /api/account/personal-data` exposes only a boolean. The existing dashboard card owns loading, present, empty, and error states and transitions immediately to empty after a verified reset.

**Stack:** Next.js App Router, React, TypeScript, PostgreSQL/Supabase, Vitest, Testing Library.

## Constraints

- Count meaningful profile fields, applications, customer-authored messages/help questions, and uploaded/referenced files.
- Ignore login events, analytics, notifications, rate-limit counters, and other automatic system activity.
- Never accept a target user ID from the browser or return personal values/counts.
- Do not cache one user's presence response for another user.
- Preserve the unrelated existing `test-results.json` worktree change.

---

### Task 1: Define and test the presence query

**Files:**

- Modify: `lib/db/personal-data-reset.ts`
- Modify: `lib/db/__tests__/personal-data-reset.test.ts`

- [ ] Add failing tests for an empty account, meaningful and placeholder-only profiles, application-only data, message/help-only data, and file-only data.
- [ ] Add `hasCustomerPersonalData(userId, database?)` returning one boolean from a bounded query of short-circuiting `EXISTS` clauses.
- [ ] Ensure automatic system records are absent from the counted boundary.
- [ ] Avoid selecting personal values into application memory.
- [ ] Run the focused repository tests.

### Task 2: Add the authenticated presence API

**Files:**

- Modify: `app/api/account/personal-data/route.ts`
- Modify: `app/api/account/personal-data/__tests__/route.test.ts`

**Contract:** `GET /api/account/personal-data` returns `{ "hasPersonalData": boolean }`.

- [ ] Add failing tests for `401`, legacy-customer authorization, staff `403`, true/false results, session-derived identity, and safe `500` handling.
- [ ] Reuse `requireAuthenticatedUser` and `assertCustomerRole`.
- [ ] Mark the response dynamic/private as required by the project conventions.
- [ ] Return no identifiers, personal values, or record counts.
- [ ] Run focused route tests.

### Task 3: Add explicit dashboard presence states

**Files:**

- Modify: `components/dashboard/delete-personal-data-card.tsx`
- Modify: `components/dashboard/__tests__/delete-personal-data-card.test.tsx`

- [ ] Add failing tests for loading, present, empty, error, and retry states.
- [ ] Fetch presence with `authenticatedFetch` when the card mounts.
- [ ] Render the existing destructive card only for `hasPersonalData: true`.
- [ ] Render **No personal data has been entered.** without a delete button for false.
- [ ] Render a generic error and retry control on failure; never show the empty message for an error.
- [ ] After successful deletion, transition immediately to empty before invoking optional external success behavior.
- [ ] Run focused component tests.

### Task 4: Verify integration behavior

**Files:**

- Modify dashboard tests only if existing integration coverage requires it.

- [ ] Verify an already-reset Maria-style legacy customer receives the empty state.
- [ ] Verify starting an application or saving meaningful profile content makes the action appear on the next card load.
- [ ] Verify system-only activity leaves the card empty.
- [ ] Verify the existing typed-confirmation deletion behavior remains unchanged when data is present.

### Task 5: Run regression gates

- [ ] Run focused repository, route, and component tests.
- [ ] Run TypeScript checks and lint for changed files.
- [ ] Run the full test suite in proportion to the change.
- [ ] Run `git diff --check` and confirm only intended files changed.

