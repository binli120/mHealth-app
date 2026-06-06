# Security, Compliance, and Operations

**Status:** Canonical security, compliance, and operations documentation  
**Last updated:** 2026-06-06

## Compliance Posture

HealthCompass MA handles sensitive applicant information and must be operated as a PHI/PII-aware system. The project tracks HIPAA Security Rule controls, privacy obligations, eligibility-determination boundaries, appeal/legal boundaries, vendor requirements, and auditability.

This document consolidates the active controls from HIPAA, technical compliance, PHI key rotation, regulatory risk, data security requirements, and security hardening notes.

## Data Classification

| Class | Examples | Handling |
|---|---|---|
| PHI / high sensitivity | SSN, DOB, address, phone, application data, income evidence, identity documents, health coverage records. | Encrypt where supported, minimize logging, restrict by RLS/auth, audit access. |
| PII / account data | Email, name, role, organization/company, login events. | Role-limited access, audit sensitive admin actions. |
| Policy content | MassHealth policy docs, glossary terms, benefit rules. | Public/non-PHI but source integrity matters. |
| Operational telemetry | Logs, traces, health status, performance metrics. | No PHI payloads; redact secrets/tokens. |

## PHI Handling

Current PHI controls:

- Encrypted applicant fields for name, DOB, phone, address, and SSN-related data where implemented.
- Client-side encrypted PHI draft resume flow with encrypted draft blob references.
- Server-side profile encryption using configured profile encryption key.
- Supabase RLS as defense-in-depth for user/application ownership.
- Route-level auth guards for customer, social worker, reviewer, and admin surfaces.
- Explicit audit and PHI audit tables/routes for sensitive operations.

Required practices:

- Do not log raw PHI, extracted document text, SSNs, tokens, or encrypted key material.
- Do not expose Supabase service role keys to client code.
- Keep upload/download access mediated by authenticated routes.
- Store only the minimum fields needed for workflow completion and audit.

## Authentication and Authorization

| Control | Current pattern |
|---|---|
| User auth | Supabase JWT/session cookie and app auth helpers. |
| Admin auth | Admin route guard, MFA requirements, passkey support for sensitive operations. |
| Role checks | `require-auth`, `require-admin`, `require-reviewer`, `require-social-worker`. |
| Session revocation | Revoked session tracking and passkey/session tests. |
| Invitation flow | Tokenized invitations with expiry and role/company context. |
| Development auth | Explicit dev-only helper routes; must stay disabled outside safe environments. |

## Database Security

Core controls:

- RLS enabled on application tables.
- App-owned helper functions for user identity and staff checks.
- Unique constraints and foreign keys for domain integrity.
- `rate_limit_counters` table for shared Postgres-backed rate limiting.
- Security-invoker view adjustments where needed.
- Generated ER docs for review of live relationships.

Schema maintenance:

```bash
pnpm run db:schema:generate
```

Update schema docs after migrations, and review new tables for:

- RLS policy coverage
- ownership model
- PHI/PII classification
- audit requirements
- retention requirements
- API route exposure

## Rate Limiting and Abuse Controls

Implemented/expected controls:

- Postgres-backed rate limiter for shared windows.
- Mobile upload token expiry and rate limiting.
- RAG ingest fail-closed behavior.
- Auth/dev-auth safeguards.
- Route-specific protection for high-risk APIs.

High-risk routes should be reviewed for:

- token expiry
- IP/session/user limits
- payload size limits
- authentication and role boundaries
- audit events
- safe error messages

## Audit and Monitoring

| Area | Control |
|---|---|
| Login events | Track login-related activity where available. |
| PHI access | PHI audit route/table for sensitive reads/writes. |
| Admin actions | Admin and role changes should be auditable. |
| Application review | Review actions, RFIs, income decisions, and status changes are persisted. |
| Notifications | Notification creation/read state is persisted. |
| Telemetry | OpenObserve and OTel hooks support operational review without PHI payloads. |

## Vendor and Integration Requirements

| Vendor/service | Use | Compliance note |
|---|---|---|
| Supabase | Auth, Postgres, storage, pgvector. | Primary data processor; review BAA/security posture for production PHI. |
| Groq / hosted LLMs | Primary LLM where configured. | Must not process real PHI without BAA/security approval. |
| Ollama/local models | Local fallback LLM. | Lower vendor exposure; still requires host security. |
| Resend | Transactional email. | Avoid PHI in email body unless approved and encrypted/appropriate. |
| OpenObserve | Logs/traces. | Never send PHI payloads. |
| MassHealth analysis service | Document/policy analysis. | Treat as PHI-capable only after deployment/security review. |
| Whisper | Voice transcription. | Voice/text may contain PHI; route and storage must be controlled. |

## Operational Runbook

### Local Development

```bash
pnpm install
supabase start
pnpm run db:migrate:dev
pnpm dev
```

### Database Connectivity

```bash
pnpm run db:check
```

### Schema Documentation

```bash
pnpm run db:schema:generate
```

### Tests

```bash
pnpm test
pnpm run test:e2e
```

### Production/VPS Operations

Use the deployment docs and README runbooks for:

- systemd service status/restart/logs
- OpenObserve status
- Vector collector status
- SSL certificate checks
- model/service availability
- health endpoint checks

## Incident Response

Minimum response workflow:

1. Identify affected route, user scope, records, and time window.
2. Preserve logs and audit rows without expanding PHI exposure.
3. Revoke sessions/tokens if auth or upload links are implicated.
4. Disable affected feature flag or route if containment requires it.
5. Assess HIPAA breach notification obligations.
6. Patch, test, and document remediation.
7. Add regression tests or monitoring to prevent recurrence.

## Compliance Gaps and Active Risks

| Risk | Status / mitigation |
|---|---|
| Hosted LLM PHI processing | Requires BAA/vendor approval before production PHI use. |
| Legal advice boundary in appeals | Keep disclaimers and source-backed drafting; do not represent user. |
| Eligibility guarantee risk | Deterministic engines provide guidance, not official agency decisions. |
| Telemetry PHI leakage | Continue redaction tests and logging review. |
| RLS drift after schema changes | Review each migration and regenerate schema docs. |
| Long-lived mobile/upload tokens | Enforce expiry, rate limits, and audit. |
| Translation/policy drift | Use source-backed responses and fallback to English where needed. |

## Security Review Checklist

- Auth guard and role check are explicit.
- RLS policy or server-side ownership check exists.
- Input validation covers type, size, and allowed values.
- Secrets/tokens are not logged or returned.
- PHI is encrypted or minimized as appropriate.
- Audit event exists for high-impact action.
- Rate limit exists for public/tokenized/high-cost route.
- AI calls do not receive unnecessary PHI.
- Tests cover unauthorized, cross-user, expired-token, malformed-input, and failure cases.

