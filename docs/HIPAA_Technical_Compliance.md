# Technical HIPAA Compliance Implementation — mHealth App

**Author:** Bin Lee  
**Date:** May 2026  
**Platform:** Next.js 15 + Supabase + PostgreSQL

---

## Overview

This document summarizes the technical security and privacy controls implemented in the mHealth application to satisfy HIPAA Technical Safeguard requirements (45 CFR §164.312). The implementation follows a defense-in-depth model — PHI is protected at every layer: the database, the application server, the API boundary, the tracing pipeline, and the deployment environment.

---

## 1. PHI Encryption at Rest — §164.312(a)(2)(iv)

**Requirement:** Implement a mechanism to encrypt and decrypt ePHI.

### Implementation

All PHI fields stored in the `applicants` table are encrypted at the application layer using **AES-256-GCM** before writing to the database.

**Key management (`lib/user-profile/encrypt.ts`):**

- A 256-bit (32-byte) symmetric key is loaded exclusively from the `PROFILE_ENCRYPTION_KEY` environment variable at runtime — never hardcoded
- Key format is validated on load: accepts 64-character hex or 44-character base64
- The key is never logged, serialized, or transmitted over the wire

**Ciphertext format:** `v1:{iv_hex}:{auth_tag_hex}:{ciphertext_hex}`

- The `v1` version prefix enables **zero-downtime key rotation** in the future — a follow-up migration can re-encrypt rows to a `v2` key without downtime
- A fresh 12-byte random IV is generated per encryption call using `crypto.randomBytes()`
- The 16-byte GCM authentication tag provides ciphertext integrity verification — any tampering causes decryption to fail loudly

**Encrypted PHI fields (migration `20260428100000_encrypt_phi_fields.sql`):**

- `ssn_encrypted` — Social Security Number
- `first_name_encrypted`, `last_name_encrypted` — Full name
- `dob_encrypted` — Date of birth
- `phone_encrypted` — Phone number
- `address_line1_encrypted`, `address_line2_encrypted`, `city_encrypted`, `state_encrypted`, `zip_encrypted` — Full address

**Driver's license number** is stored only as a SHA-256 hash — the plaintext is never persisted to disk.

**Migration strategy:** Zero-downtime dual-write — new columns added alongside legacy plaintext columns; the application reads from `*_encrypted` with fallback to plaintext for unbackfilled rows. A backfill script (`scripts/backfill-phi-encryption.ts`) encrypts all historical rows idempotently. A follow-up migration drops the legacy plaintext columns after backfill is verified.

**Production guard (`instrumentation.ts`):** The server fails loudly at startup if `PROFILE_ENCRYPTION_KEY` is missing in production — PHI cannot be safely stored or retrieved without it.

---

## 2. Audit Controls — §164.312(b)

**Requirement:** Implement hardware, software, and procedural mechanisms that record and examine activity in systems that contain or use ePHI.

### Implementation

Every read or write of an encrypted PHI field is recorded in the `audit_logs` table via `logPhiAccess()` (`lib/db/phi-audit.ts`).

**Per audit record:**

- `user_id` — the authenticated user whose PHI was accessed
- `action` — dot-namespaced event name (e.g. `phi.ssn.decrypted`, `phi.ssn.written`)
- `ip_address` — originating client IP extracted from `x-forwarded-for` / `x-real-ip`
- `new_data` — structured JSON with purpose (e.g. `"pdf-generation"`, `"user-submitted"`) and additional metadata
- `created_at` — immutable timestamp

**Design decisions:**

- Writes are **fire-and-forget** — a broken audit log never blocks a clinical workflow (PDF generation, benefit orchestration, etc.)
- Failures are forwarded to `logServerError` so ops can detect a systemic outage via the structured log stream
- The admin read path (`getPhiAuditLogs`) is intentionally separate from the write path and only callable from server-side admin routes

**Admin audit viewer** (`GET /api/admin/phi-audit`):

- Paginated, filterable by user ID
- Protected by the `requireAdmin` guard (authentication + RBAC + MFA check)
- A full audit UI is available at `/admin/phi-audit`

---

## 3. Access Control — §164.312(a)(1)

**Requirement:** Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to authorized persons.

### Authentication

**Supabase Auth** is the primary identity provider for end users:

- Email/password login with enforced strong passwords
- Email verification required before account activation
- JWT-based sessions verified server-side on every API call via `requireAuthenticatedUser()`
- JWT signature verification uses HMAC-SHA256 with timing-safe comparison to prevent timing attacks

**Admin Passkeys** (WebAuthn, `lib/auth/admin-passkeys.ts` + `lib/auth/passkey-webauthn.ts`):

- Admins can register FIDO2/WebAuthn passkeys (hardware security keys, Face ID, Touch ID)
- Passkey credentials stored in `admin_passkey_credentials` table
- Session tokens are HMAC-SHA256 signed with `ADMIN_PASSKEY_SESSION_SECRET`, include a random nonce, and expire after 8 hours

### Role-Based Access Control (RBAC)

Three distinct roles enforced at both the API layer and database layer:

- **Applicant** — self-service access to own PHI only
- **Social Worker** — read access to assigned patients' records
- **Admin** — full access; requires MFA

**Database-level enforcement:** A PostgreSQL trigger (`trg_enforce_admin_social_worker_exclusivity`) prevents any user from holding both `admin` and `social_worker` roles simultaneously — privilege escalation via dual-role assignment is blocked at the DB level.

**Row-Level Security (RLS)** is enabled on all sensitive tables — `revoked_sessions`, `social_worker_profiles`, `patient_social_worker_access`, `companies`, and others — enforcing ownership and access rules at the storage layer independent of application code.

### Multi-Factor Authentication (MFA)

- Admin users are required to complete TOTP-based MFA via Supabase's built-in MFA before accessing admin routes
- The `requireAdmin` guard checks `aal2` (Authentication Assurance Level 2) before granting access
- A dedicated MFA verification page (`/auth/mfa`) guides admins through TOTP code entry
- Passkey sessions are treated as inherently strong two-factor authentication and bypass the TOTP requirement

---

## 4. Session Management and Automatic Logoff — §164.312(a)(2)(iii)

**Requirement:** Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity.

### Implementation

**Session revocation** (`lib/auth/session-revocation.ts`, migration `20260427090000_revoked_sessions.sql`):

A `revoked_sessions` table supports three revocation modes:

- **Token-level** — revoke a specific access token (SHA-256 hash stored, not the token itself)
- **Session-level** — revoke by Supabase `session_id` / `jti`
- **User-level** — revoke all tokens for a user issued before a given timestamp (e.g. force logout all devices)

Every API request checks the revocation list before accepting a session. Admins can force-logout any user from the Admin Sessions page (`/admin/sessions`). Admin passkey sessions expire after 8 hours with no renewal.

---

## 5. Transmission Security — §164.312(e)(1) and §164.312(e)(2)(ii)

**Requirement:** Implement technical security measures to guard against unauthorized access to ePHI transmitted over an electronic communications network.

### HTTPS / TLS

- **HSTS** enforced via `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` on every response
- All production traffic runs over TLS — the Docker deployment sits behind a reverse proxy with ACME/Let's Encrypt certificate auto-renewal

### Content Security Policy (CSP) with Per-Request Nonces

A fresh cryptographic nonce (128-bit, Web Crypto) is generated for every HTTP request in `proxy.ts` / `lib/csp/nonce.ts`:

- `script-src` uses `'nonce-{value}'` + `'strict-dynamic'` instead of the weaker `'unsafe-inline'`
- Prevents Cross-Site Scripting (XSS) — injected scripts cannot run without a valid nonce
- CSP is set on the response header so browsers enforce it

### Additional Security Headers

Set globally via `next.config.mjs` and `proxy.ts`:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` — prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` — prevents MIME-sniffing |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=(), payment=()` |
| `Content-Security-Policy` | Nonce-based, generated per request |

### PHI Never Returned Over the Wire

The SSN API (`GET /api/user-profile/ssn`) returns only `{ hasSsn: boolean }` — the plaintext SSN is never transmitted to the client. Decryption happens server-side only (e.g. for PDF generation).

---

## 6. OpenTelemetry PHI Filtering — Trace Data Protection

**Requirement:** Ensure that operational monitoring systems do not inadvertently capture or expose PHI.

### Implementation (`lib/telemetry/otel-phi-hooks.ts`, `instrumentation.ts`)

Four pure hook functions intercept every OTel span before it is exported to OpenObserve:

**`shouldIgnoreIncomingRequest`** — drops noisy, non-diagnostic spans entirely:

- `/api/health`, `/_next/*` static bundles, favicons, robots.txt, sitemap.xml

**`scrubHttpRequestSpan`** — applied to every HTTP request span:

- Blanks `url.query` — query strings may carry OAuth tokens or user-supplied search terms
- Strips query string from `http.target`, leaving only the path
- Defensively redacts `authorization`, `cookie`, `set-cookie`, and `x-supabase-session` headers — even though OTel does not capture headers by default, this prevents future config changes from accidentally leaking them

**`scrubHttpResponseSpan`** — applied to every HTTP response span:

- Redacts `http.response.header.set-cookie` — session tokens embedded in Set-Cookie values must never reach the trace backend

**PostgreSQL instrumentation (`scrubPgStatement`)**:

- `enhancedDatabaseReporting: false` — explicitly set so query parameter values (`$1`, `$2`, …) are never captured in `db.statement`
- A secondary pattern-match guard (`PHI_IN_SQL_PATTERN`) detects accidental PHI string-interpolation in query text: AES-256-GCM ciphertext (`v1:{hex}:…`) or bare SSNs (`###-##-####`)
- When detected: `db.statement` is redacted and a `console.error` fires, surfacing the programming error loudly

All four hooks are unit-tested with 25 Vitest tests using a minimal `Span` stub — no OTel SDK required.

---

## 7. Data Minimization and Retention — §164.306(a)(4)

**Requirement:** Protect against reasonably anticipated uses or disclosures of ePHI that are not permitted.

### Implementation

A scheduled cron job (`GET /api/cron/purge-identity-extractions`) NULLs raw extraction data older than **30 days**:

| Table | Fields Purged |
|---|---|
| `mobile_verify_sessions` | `extracted_data` (AAMVA-parsed name, address fields) |
| `identity_verification_attempts` | `ip_address`, `user_agent` |
| `document_extractions` | `raw_output`, `structured_output` |
| `document_pages` | `ocr_text` |

Structured results (verification scores, hashed DL number, boolean breakdowns) are retained indefinitely for audit purposes. Raw OCR output and client identifiers are purged after 30 days.

---

## 8. Rate Limiting — §164.312(a)(2)(i) Brute Force Prevention

**Requirement:** Assign unique user identifiers and protect against unauthorized access attempts.

### Implementation (`lib/server/rate-limit.ts`)

A per-IP sliding-window rate limiter protects sensitive endpoints:

- Invite token lookup: **20 requests / minute per IP**
- Invite acceptance (account creation): **5 requests / minute per IP**
- SSN submission: rate-limited per authenticated user

Memory is bounded — a pruning interval removes expired entries every 5 minutes.

---

## 9. Dev Auth Route Security — Production Isolation

**Requirement:** Prevent test and development mechanisms from being accessible in production.

### Implementation

Three dev-only routes (`/api/auth/dev-register`, `/api/auth/dev-grant-admin`, `/api/auth/dev-auto-confirm`) that bypass Supabase Auth for local testing are controlled by a feature flag (`NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS`).

**Production hard-block (`instrumentation.ts`):** The server throws an uncaught exception at startup if this flag is truthy in `NODE_ENV=production` — the application refuses to start rather than expose dev auth routes in production.

E2E security tests (`e2e/tests/10-dev-auth-security.spec.ts`) verify these routes return 404 when the flag is disabled and reject malformed input with 400 (never 500 or a data leak).

---

## 10. CI/CD Security Controls

- **GitHub Actions secrets** — all production credentials (`PROFILE_ENCRYPTION_KEY`, `ADMIN_PASSKEY_SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, database credentials, etc.) are stored as GitHub Secrets and injected at deploy time — never committed to the repository
- **`.env.production.local` permissions** — written with `chmod 600` on the VPS — readable only by the deploy user
- **CI gate** — deployment requires all CI jobs (unit tests, type checks, linting) to pass before the SSH deploy runs
- **Docker standalone build** — the app runs in an isolated container; the Node.js server process does not have direct filesystem access to other container files

---

## Summary Table

| HIPAA Control | §164.312 Reference | Implementation |
|---|---|---|
| Encryption at rest | §164.312(a)(2)(iv) | AES-256-GCM per-field, server-only key, version-tagged ciphertext |
| Audit controls | §164.312(b) | `audit_logs` table, every PHI read/write logged with IP + purpose |
| Access control | §164.312(a)(1) | Supabase Auth + RBAC + DB-level role exclusivity trigger + RLS |
| Multi-factor authentication | §164.312(d) | TOTP via Supabase MFA (aal2) required for admin access |
| Admin strong authentication | §164.312(d) | WebAuthn/FIDO2 passkeys with HMAC-signed session tokens |
| Session termination | §164.312(a)(2)(iii) | Token revocation table, admin force-logout, 8-hour passkey TTL |
| Transmission security | §164.312(e)(2)(ii) | HSTS, TLS, nonce-based CSP, sensitive headers redacted |
| PHI never on wire | §164.312(e)(1) | SSN endpoint returns `{ hasSsn }` only; plaintext decrypted server-side |
| Trace data protection | §164.312(b) | OTel hooks scrub query strings, cookies, auth headers, SQL params |
| Data minimization | §164.306(a)(4) | 30-day cron purge of raw OCR, extraction, and IP data |
| Brute force prevention | §164.312(a)(2)(i) | Per-IP sliding-window rate limiting on auth and PHI endpoints |
| Dev route isolation | §164.306(a)(2) | Production startup guard throws if dev auth flag is enabled |
