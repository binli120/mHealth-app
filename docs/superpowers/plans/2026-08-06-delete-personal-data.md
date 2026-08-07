# Delete Personal Data Implementation Plan

> **Execution:** Implement task-by-task with tests first. Do not broaden this into account deletion; preserve authentication and customer authorization.

**Goal:** Add a customer-dashboard action that permanently removes all customer personal data, applications, histories, and stored files while leaving the account able to log in as a new user.

**Architecture:** A focused dashboard client component calls one authenticated API endpoint. A server-only coordinator inventories storage paths, removes objects in bounded batches, invokes one PostgreSQL transaction for the database reset, and verifies the absence of residual customer data. The target user is always derived from the authenticated session. Both storage and database operations are idempotent so partial failures can be retried safely.

**Stack:** Next.js App Router, React, TypeScript, PostgreSQL/Supabase, Supabase Storage, Radix AlertDialog, Tailwind, Vitest, Testing Library.

## Global Constraints

- Preserve `auth.users`, the minimum `public.users` row, `is_active`, and customer role assignments.
- Clear optional personal fields retained on `public.users`, including `avatar_url`.
- Never accept a target user ID from the browser.
- Require the exact server-validated phrase `DELETE ALL DATA`.
- Do not report success until storage cleanup, database deletion, and residual-data verification all succeed.
- Never log deleted values, filenames, object paths, confirmation text, or record payloads.
- Keep the operation retryable after storage or database failure.
- Preserve the unrelated existing `test-results.json` worktree change.

---

### Task 1: Define and test the deletion contract

**Files:**

- Create: `lib/account/personal-data-contract.ts`
- Create: `lib/account/__tests__/personal-data-contract.test.ts`

**Interfaces:**

- `PERSONAL_DATA_CONFIRMATION_PHRASE`
- `PRESERVED_USER_TABLES`
- `CUSTOMER_OWNED_TABLES`
- `APPLICATION_OWNED_TABLES`
- `assertPersonalDataTableInventory(discoveredTables: string[]): void`

- [ ] Write failing tests that require an explicit `delete`, `preserve`, or `shared` classification for every application table in the current migration inventory.
- [ ] Classify every current table, including post-baseline tables such as insurance history, user-agent memory, mobile handoff/upload sessions, help data, passkeys, appeals, login events, and rate-limit data.
- [ ] Keep the classification independent of SQL delete order; it is the auditable product contract used by tests and the reset implementation.
- [ ] Verify the focused test passes.

---

### Task 2: Add recursive, bounded storage inventory and deletion primitives

**Files:**

- Modify: `lib/supabase/storage.ts`
- Create: `lib/supabase/__tests__/storage-delete-prefix.test.ts`

**Interfaces:**

- `listStoragePrefix({ folderPath, pageSize }): Promise<string[]>`
- `deleteStoragePathsInBatches({ storagePaths, batchSize }): Promise<void>`

- [ ] Write failing tests for nested folders, pagination, empty prefixes, deduplication, missing objects, and bounded delete batches.
- [ ] Implement recursive traversal of Supabase Storage folders. Do not treat folder placeholders as files.
- [ ] Implement deterministic deduplication and batch deletion using the existing admin client.
- [ ] Ensure provider errors retain only safe operational context and never expose paths through API responses.
- [ ] Verify the focused storage tests pass.

---

### Task 3: Inventory all customer storage objects before database deletion

**Files:**

- Create: `lib/db/personal-data-reset.ts`
- Create: `lib/db/__tests__/personal-data-reset-storage.test.ts`

**Interfaces:**

- `getPersonalDataResetContext(userId: string): Promise<PersonalDataResetContext>`
- `PersonalDataResetContext`: internal user/applicant/application identifiers plus a deduplicated storage-path set; it must never cross the API boundary.

- [ ] Write failing tests for the customer root prefix, avatar paths, application documents and derivatives, income-document storage keys, encrypted PHI drafts, message media, identity files, and temporary upload artifacts.
- [ ] Resolve the `public.users`, applicant, and application identities from the authenticated user ID.
- [ ] Read explicit paths before deleting their rows and combine them with recursive customer-prefix inventory.
- [ ] Include non-user-root layouts such as `phi-drafts/{applicationId}/...`.
- [ ] Treat an already-reset customer as a valid empty context.
- [ ] Verify focused tests pass without logging returned paths.

---

### Task 4: Implement the transactional database reset

**Files:**

- Modify: `lib/db/personal-data-reset.ts`
- Create: `lib/db/__tests__/personal-data-reset-transaction.test.ts`
- Create: `supabase/migrations/20260806000001_personal_data_reset.sql`

**Interfaces:**

- `deleteCustomerPersonalData(userId: string): Promise<void>`
- `verifyCustomerPersonalDataDeleted(userId: string): Promise<void>`

- [ ] Write failing tests proving one dedicated pool connection owns `BEGIN`, per-user advisory locking, deletes, verification, `COMMIT`, and `ROLLBACK`.
- [ ] Delete foreign-key dependents explicitly where constraints use `SET NULL` or no cascade; use existing cascades only where verified in the current schema.
- [ ] Remove customer communication/access records from both participant directions and delete customer-identifying audit payloads.
- [ ] Remove applications before the applicant when required by current foreign keys, then remove applicant-owned profile, family, benefit, identity, and verification data.
- [ ] Remove direct user-owned personal rows, including insurance history, notifications, help content, AI memory, analytics/session state, handoff/upload state, and login-history data classified for deletion. Preserve authentication credentials, including passkeys.
- [ ] Reset optional personal fields on `public.users` while preserving its ID, email/login linkage, active status, and `user_roles`.
- [ ] Add SQL comments documenting the preserve/delete boundary and make reruns no-ops.
- [ ] Verify inside the same transaction that no classified customer/application rows remain; rollback on residue.
- [ ] Run migration/schema validation and focused transaction tests.

---

### Task 5: Coordinate storage, database, and residual verification

**Files:**

- Create: `lib/account/delete-personal-data.ts`
- Create: `lib/account/__tests__/delete-personal-data.test.ts`

**Interfaces:**

- `resetPersonalData(userId: string): Promise<void>`

- [ ] Write failing tests for the sequence: context inventory → storage deletion → database transaction → database/storage verification.
- [ ] Prove storage failure prevents the database transaction.
- [ ] Prove database failure after storage cleanup is retryable and never returns success.
- [ ] Prove missing storage objects and an already-reset database converge successfully.
- [ ] Add bounded concurrency and avoid retaining file contents in memory.
- [ ] Emit structured phase, duration, and count metrics only; scrub thrown provider details before they reach callers.
- [ ] Verify the focused coordinator tests pass.

---

### Task 6: Add the authenticated reset API

**Files:**

- Create: `app/api/account/personal-data/route.ts`
- Create: `app/api/account/personal-data/__tests__/route.test.ts`
- Modify: `lib/server/rate-limit.ts`

**Contract:**

```http
DELETE /api/account/personal-data
Content-Type: application/json

{ "confirmation": "DELETE ALL DATA" }
```

Success: `{ "ok": true }`. Errors contain only `{ "ok": false, "error": string }`.

- [ ] Write failing tests for `401`, non-customer `403`, invalid JSON/phrase `400`, rate-limit `429`, reset failure `500`, and success `200`.
- [ ] Authenticate with `requireAuthenticatedUser` and enforce the customer/applicant role using the existing authorization utilities.
- [ ] Derive the deletion target exclusively from `authResult.userId`; reject/ignore no alternate target fields because the request schema permits only `confirmation`.
- [ ] Apply a strict destructive-action rate limit keyed by the authenticated user.
- [ ] Call `resetPersonalData` and return minimal envelopes.
- [ ] Use existing server error logging with safe metadata only.
- [ ] Verify route tests pass.

---

### Task 7: Build the typed-confirmation dashboard component

**Files:**

- Create: `components/dashboard/delete-personal-data-card.tsx`
- Create: `components/dashboard/__tests__/delete-personal-data-card.test.tsx`
- Modify: `app/customer/dashboard/page.tsx`

- [ ] Write failing UI tests for opening/canceling, exact phrase matching, disabled destructive action, in-flight dismissal/duplicate prevention, generic retry feedback, and success callback.
- [ ] Build a compact danger card and Radix AlertDialog using existing Button/Input/Card primitives and dashboard visual conventions.
- [ ] Keep confirmation/request state inside the new client component instead of expanding the dashboard page's existing state surface.
- [ ] Call `authenticatedFetch` with `DELETE` and the confirmation payload.
- [ ] On success, invoke an explicit dashboard reset callback that reloads server-backed collections and clears customer-specific in-memory state.
- [ ] Add accessible labels, destructive copy, focus behavior, and an `aria-live` error region.
- [ ] Mount the card in the customer dashboard below normal account/application actions.
- [ ] Verify focused component and existing dashboard tests pass.

---

### Task 8: Clear browser-only personal state and render the new-user state

**Files:**

- Modify: `lib/redux/features/user-profile-slice.ts`
- Modify: `lib/redux/features/application-slice.ts`
- Modify: `app/customer/dashboard/page.tsx`
- Create or modify focused Redux/dashboard tests under the existing `__tests__` directories.

- [ ] Write failing tests for reset reducers and post-success dashboard state.
- [ ] Add explicit reset actions for user profile and application state.
- [ ] Remove known application draft/resume keys and customer caches from browser storage; enumerate exact owned keys rather than calling `localStorage.clear()` or `sessionStorage.clear()`.
- [ ] Dispatch reset actions only after the server reports verified success.
- [ ] Reload applications, notifications, access relationships, and greeting/profile data so the existing empty state renders without a full account logout.
- [ ] Verify focused Redux and dashboard tests pass.

---

### Task 9: End-to-end residual-data and regression verification

**Files:**

- Create: `e2e/customer-delete-personal-data.spec.ts` if the existing Playwright authentication fixtures support a disposable customer; otherwise add an integration test under `app/api/account/personal-data/__tests__/` using the project database harness.
- Update: `docs/superpowers/specs/2026-08-06-delete-personal-data-design.md` only if implementation reveals a necessary, approved correction.

- [ ] Seed a disposable customer with profile, application statuses, documents/derivatives, insurance history, messages/media, social-worker access, notifications, identity data, AI memory, and browser draft state.
- [ ] Execute the dashboard confirmation flow and assert the account stays authenticated.
- [ ] Assert the dashboard/profile match a new customer and every classified database/storage artifact is absent.
- [ ] Re-run the operation and assert idempotent success.
- [ ] Run focused tests after every task, then run:

```bash
zsh -lic 'pnpm lint'
zsh -lic 'pnpm exec tsc --noEmit'
zsh -lic 'pnpm test:ci'
zsh -lic 'pnpm run build'
```

- [ ] Inspect `git diff --check`, confirm no secrets or PHI fixtures were added, and report any unrelated pre-existing worktree changes separately.

## Delivery Order and Rollback

1. Land contract/tests and storage helpers.
2. Land the migration and server deletion path behind an unlinked endpoint.
3. Validate against a representative non-production Supabase project.
4. Land the dashboard entry point after residual-data verification is green.

Rollback removes the dashboard entry point and disables the route first. The migration is additive and should not be destructively reversed while any deployed code may call it. Because completed resets are intentionally irreversible, rollback cannot restore deleted customer data.
