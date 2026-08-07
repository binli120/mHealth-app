# Delete Personal Data Design

## Objective

Give an authenticated customer one irreversible action that removes all personal data owned by that customer while preserving the minimum account and role records required to sign in. After completion, the customer dashboard and profile must behave like those of a newly registered customer.

This is an account reset, not account deletion. The authentication identity, login credentials, active-account state, and customer role remain.

## User Experience

The customer dashboard includes a danger section with a **Delete all personal data** button. Selecting it opens a modal that states:

- deletion is permanent;
- all profile and identity data, applications, statuses, histories, messages, and uploaded files will be removed;
- the login account will remain; and
- the account will return to its initial empty state.

The user must enter the exact phrase `DELETE ALL DATA`. The final delete button is disabled until the phrase matches. While the request runs, both dismissal and repeated submission are disabled.

On success, the client clears customer-specific Redux and browser draft state, closes the modal, refreshes server data, and renders the existing empty-dashboard experience. On failure, the modal remains open with a generic retryable error. Error text must not expose record identifiers, storage paths, or protected data.

## Preserved Data

Only records required to keep login and authorization functional are preserved:

- the Supabase authentication identity;
- the corresponding minimal `public.users` row; and
- the user's customer role assignments.

Fields on the preserved application user row that contain optional personal presentation data, such as an avatar reference, are reset to their empty values. Authentication metadata must be reviewed during implementation; optional personal metadata is cleared while identity and credential metadata required for login is retained.

## Deleted Data Boundary

The reset removes every customer-owned or customer-identifying record outside the preserved boundary, including:

- applicant, user profile, family profile, bank, identity-verification, and benefit-orchestration data;
- all applications regardless of state, including drafts, submitted/decided statuses, form state, household members, income, assets, validations, screenings, review history, requests for information, and income-verification records;
- application documents, derived pages, OCR text, extractions, thumbnails, PDF renditions, and income evidence;
- insurance-history records and explanations;
- customer notifications, help activity, AI/user memory, analytics records that identify the customer, and temporary handoff or verification sessions;
- social-worker engagement, access grants, collaborative sessions, direct messages, voice/image attachments, and related customer-owned communication data; and
- all storage objects belonging to the customer or referenced by deleted rows, including profile avatars, application documents and derivatives, identity uploads, message media, and temporary uploads.

Shared reference data, policy content, organization data, and records owned exclusively by other users are not deleted. A relationship row or conversation involving the customer is deleted even when another user can view it.

The implementation inventory must cover the current schema and migrations rather than relying only on the baseline schema. Tests must fail when a newly added customer-owned table is omitted from the deletion contract.

## Architecture

### Dashboard component

A small client component owns the modal, confirmation phrase, request state, and success/error feedback. It is embedded in the existing customer dashboard so the rest of the page does not acquire additional client-side state.

### API boundary

`DELETE /api/account/personal-data` is the sole browser-facing operation. The body contains only the confirmation phrase. The route:

1. validates the authenticated session and customer role;
2. checks the exact confirmation phrase server-side;
3. derives the user identity from the session and never accepts a target user ID;
4. invokes the deletion service; and
5. returns a minimal success or error envelope.

The endpoint uses the project's existing authenticated request and CSRF/origin protections. It is rate-limited to prevent accidental or abusive repeated execution. Logs contain the operation name, authenticated actor ID or a non-reversible correlation identifier, outcome, duration, and counts only; they never contain deleted values or file paths.

### Deletion service

A server-only deletion service coordinates storage and PostgreSQL. A database function or transaction-owned repository function is the canonical database deletion boundary. It locks the target account reset operation, resolves all rows by the authenticated user, gathers storage references, deletes dependent rows in foreign-key-safe order, resets permitted fields on the preserved user row, and commits as one database transaction.

Database deletion is idempotent: a retry against an already-reset account succeeds and reports zero remaining records. The transaction must not weaken row-level security for normal application traffic. Any privileged execution path is server-only, fixes its `search_path`, validates the caller identity, and grants no arbitrary-user delete capability to clients.

## Storage and Consistency

Supabase Storage and PostgreSQL cannot participate in one atomic transaction. The operation therefore uses an explicit, retryable workflow:

1. authenticate and acquire the per-user reset guard;
2. inventory every referenced object and every object under customer-owned storage prefixes;
3. remove those objects in bounded batches;
4. run the database deletion transaction; and
5. verify that no customer-owned database rows or storage objects remain before returning success.

Missing objects are treated as already deleted. If storage cleanup fails, the database transaction does not begin and the endpoint returns a retryable failure. If the database transaction fails after storage cleanup, retrying safely completes the database cleanup; database rows may temporarily reference missing objects, but the endpoint never reports success in that state.

Large object inventories are processed with bounded concurrency and pagination to control memory, latency, and provider rate limits. If observed production volume makes the synchronous request unsafe, the same deletion service can later run behind a durable job without changing the API contract; an asynchronous job is not part of the initial scope.

## Error Handling and Safety

- Unauthenticated requests return `401`; non-customer accounts return `403`.
- A missing or incorrect confirmation phrase returns `400` without performing work.
- Concurrent requests for the same user serialize or converge idempotently.
- Storage or database failures return a generic retryable `500` response and are recorded in structured server logs.
- The route does not return deleted record counts or identifiers to the browser.
- The UI does not optimistically hide data before server verification succeeds.
- Background work that can recreate records for the customer must either observe the reset guard or fail harmlessly against the deleted parent data.

## Testing

### Database and service tests

- Seed a user with records in every customer-owned table and objects in every relevant storage location, execute reset, and assert the complete deletion boundary.
- Assert the auth identity, minimal `public.users` row, active state, and customer role remain.
- Assert optional personal fields on preserved records are cleared.
- Assert a second execution succeeds with no residual data.
- Inject storage and transaction failures and verify retry behavior and absence of false success.
- Exercise foreign-key relationships whose current delete behavior is `SET NULL` or has no cascade.
- Maintain a schema inventory assertion so new customer-owned tables require an explicit preserve/delete classification.

### Route tests

- Reject unauthenticated, unauthorized, malformed, and incorrectly confirmed requests.
- Prove the target identity always comes from the session.
- Verify rate limiting, safe error envelopes, and no sensitive logging.

### UI tests

- Open and cancel the warning modal without side effects.
- Keep the destructive action disabled until `DELETE ALL DATA` matches exactly.
- Prevent duplicate submissions while deletion is running.
- Show retryable failure feedback without clearing visible data.
- On success, clear local customer state, refresh, and render the new-user empty state.

## Operational Verification

Before release, run the focused unit/integration tests, lint, TypeScript checks, and the existing CI test gate. Validate the migration against a representative local database and verify all configured storage buckets. Production rollout should monitor reset attempts, failures by phase, latency, and residual-data verification failures without collecting deleted personal content.

## Out of Scope

- Deleting or disabling the login account.
- Removing shared policy/reference data.
- Providing a data export workflow.
- Introducing a general administrator delete-user capability.
- Retaining customer-identifying audit payloads after a successful reset. If a legal retention rule requires otherwise, that policy must be defined explicitly before release and the product copy must disclose the exception.
