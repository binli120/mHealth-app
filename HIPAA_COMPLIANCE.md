# HIPAA Compliance Assessment — MassHealth mHealth Application

**Document version:** 1.0  
**Assessment date:** 2026-04-26  
**Application:** MassHealth mHealth App (Next.js 16 / Supabase / Vercel)  
**Status:** Substantially compliant with identified gaps requiring remediation  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Applicable HIPAA Rules](#2-applicable-hipaa-rules)
3. [PHI Inventory](#3-phi-inventory)
4. [Administrative Safeguards](#4-administrative-safeguards)
5. [Physical Safeguards](#5-physical-safeguards)
6. [Technical Safeguards](#6-technical-safeguards)
7. [Breach Notification Rule](#7-breach-notification-rule)
8. [Business Associate Agreements](#8-business-associate-agreements)
9. [Compliance Gaps and Remediation Roadmap](#9-compliance-gaps-and-remediation-roadmap)
10. [Compliance Matrix Summary](#10-compliance-matrix-summary)

---

## 1. Executive Summary

The MassHealth mHealth application is a healthcare benefits platform that enables applicants to apply for MassHealth coverage, verify identity, and communicate with social workers. Because the application collects, stores, processes, and transmits **Protected Health Information (PHI)** on behalf of a covered entity (MassHealth / Massachusetts Executive Office of Health and Human Services), it must comply with HIPAA's Privacy Rule, Security Rule, and Breach Notification Rule.

### Overall Posture

The application demonstrates a **strong architectural foundation** for HIPAA compliance: JWT-based authentication with Supabase, database-level Row-Level Security (RLS), AES-256-GCM encryption for financial data, structured audit logging with PII redaction, and hardened HTTP security headers. However, several **critical and high-severity gaps** must be remediated before the system can be considered fully HIPAA-compliant in a production environment.

| Category | Status |
|---|---|
| Administrative Safeguards | Partial |
| Physical Safeguards | Compliant (via Supabase/Vercel BAAs) |
| Technical Safeguards | Partial — critical gaps present |
| Breach Notification | Partial |
| Business Associate Agreements | Action required |

---

## 2. Applicable HIPAA Rules

### Who This Applies To

| Party | Role | Obligation |
|---|---|---|
| MassHealth (EOHHS) | Covered Entity | Full HIPAA compliance |
| Development / operations team | Workforce | Policy adherence, training |
| Supabase Inc. | Business Associate | BAA required |
| Vercel Inc. | Business Associate | BAA required |
| Resend Inc. (email) | Business Associate | BAA required |
| OpenAI (AI features) | Business Associate | BAA required |
| OpenObserve (logging) | Business Associate | BAA required |

### Rules in Scope

- **Privacy Rule** (45 CFR §164.500–534): Governs use and disclosure of PHI
- **Security Rule** (45 CFR §164.302–318): Administrative, physical, and technical safeguards for ePHI
- **Breach Notification Rule** (45 CFR §164.400–414): Notification requirements after breach

---

## 3. PHI Inventory

The following data elements constitute **electronic Protected Health Information (ePHI)** within this system:

### Applicant PHI

| Data Element | Table / Field | Storage Format | Classification |
|---|---|---|---|
| Full name | `applicants.first_name`, `last_name` | Plaintext | PHI |
| Date of birth | `applicants.dob` | Plaintext DATE | PHI |
| Social Security Number | `applicants.ssn_encrypted` | App-layer encrypted (AES-256-GCM) | PHI — High Sensitivity |
| Home address | `applicants.address` | Plaintext JSONB | PHI |
| Phone number | `applicants.phone` | Plaintext | PHI |
| Email address | `users.email` (Supabase Auth) | Plaintext | PHI |
| Immigration / citizenship status | `applicants.citizenship_status` | Plaintext | PHI |
| Household medical conditions | `household_members.pregnant`, `disabled`, `over_65` | Plaintext BOOLEAN | PHI |
| Income and employment | `incomes.employer_name`, `monthly_amount` | Plaintext | PHI |
| Bank account data | `user_profiles.bank_data` | AES-256-GCM encrypted | PHI — High Sensitivity |
| Driver's license data | `identity_verification_attempts.*` | Plaintext | PHI |
| Application and benefits status | `applications.*` | Plaintext | PHI |
| Chat/message content | `chat_logs.messages` | Plaintext JSONB | PHI (may contain clinical info) |
| Uploaded documents | Supabase Storage | Encrypted at rest (Supabase-managed) | PHI |

### Data Flow Diagram (Logical)

```
[Applicant Browser]
      │ HTTPS/TLS 1.2+
      ▼
[Vercel Edge Network]
      │
      ▼
[Next.js App Server (Vercel Fluid Compute)]
      │  JWT Auth  │  RLS-enforced queries
      ▼             ▼
[Supabase Auth] [Supabase PostgreSQL]
                      │
                      ▼
              [Supabase Storage]
                  (Documents)

[App Server] ──── HTTPS ────► [Resend] (Email invites)
[App Server] ──── HTTPS ────► [OpenAI] (Benefits advisor)
[App Server] ──── HTTPS ────► [OpenObserve] (Logs/traces)
```

---

## 4. Administrative Safeguards

### 4.1 Security Officer (§164.308(a)(2))

**Requirement:** Designate a HIPAA Security Officer responsible for implementing and maintaining security policies.

**Status:** ⚠️ Action Required — A Security Officer must be formally designated and documented.

**Recommendation:** Document the Security Officer role, responsibilities, and contact information in the organization's HIPAA policy binder.

---

### 4.2 Workforce Training (§164.308(a)(5))

**Requirement:** Train all workforce members on HIPAA policies and procedures; sanction those who violate them.

**Status:** ⚠️ Action Required — No training records or in-app training enforcement observed.

**Recommendation:**
- Conduct annual HIPAA workforce training for all developers, ops, and support staff
- Maintain training completion records
- Establish a sanction policy for violations

---

### 4.3 Access Management Policy (§164.308(a)(4))

**Requirement:** Implement policies to grant access to ePHI only to authorized users, including a formal access authorization process.

**Current Implementation:**
- Role-based access control (RBAC) is implemented via `user_roles` and `roles` database tables
- Defined roles: `admin`, `social_worker`, `reviewer`, `supervisor`, `read_only_staff`, `applicant`
- API routes enforce role checks via `/lib/auth/require-admin.ts` and `/lib/auth/require-social-worker.ts`
- Admin user invitations require admin-role privileges (`/api/admin/users/invite`)
- Database RLS policies enforce row-level access: `can_access_applicant()`, `is_staff()`

**Status:** ✅ Implemented — policies documented in code; formal written access policy needed.

**Recommendation:** Create written Access Control Policy documenting each role's permitted access, how access is granted/revoked, and the review schedule.

---

### 4.4 Audit Controls (§164.308(a)(1)(ii)(D) / §164.312(b))

**Requirement:** Implement audit controls that record and examine activity in systems containing ePHI.

**Current Implementation:**

| Audit Mechanism | Implementation | Location |
|---|---|---|
| Login/logout events | `login_events` table with user_id, IP, user_agent, timestamp | `database/access_management_schema.sql` |
| Structured server logs | JSON logs with user context, request path, response code | `lib/server/logger.ts` |
| Log shipping | OpenTelemetry traces shipped to OpenObserve | `instrumentation.ts` |
| PII redaction in logs | Keys: `authorization`, `token`, `password`, `ssn`, `dob` auto-redacted | `lib/server/logger.ts` |

**Status:** ⚠️ Partial — basic login auditing exists; **data access audit logging** (read/write of PHI records) is not comprehensively implemented.

**Recommendation:**
- Add an `audit_events` table and log all PHI reads (not just writes) with user_id, record type, record_id, action, timestamp
- Retain audit logs for minimum 6 years (HIPAA requirement)
- Implement log integrity protection (write-once storage or cryptographic chaining)

---

### 4.5 Risk Analysis (§164.308(a)(1))

**Requirement:** Conduct and document a risk analysis of potential threats and vulnerabilities to ePHI confidentiality, integrity, and availability.

**Status:** ⚠️ Action Required — This document serves as an initial gap analysis; a formal risk analysis using NIST SP 800-30 or equivalent methodology must be completed and documented.

---

### 4.6 Contingency Plan (§164.308(a)(7))

**Requirement:** Establish data backup, disaster recovery, and emergency operations plans.

**Current Implementation:**
- Supabase provides automated daily backups with point-in-time recovery (PITR) on Pro plan and above
- Vercel provides zero-downtime deployments and rollback capability

**Status:** ⚠️ Partial — infrastructure backups exist; formal **Business Continuity / Disaster Recovery (BCDR) plan** must be documented, including RTO/RPO targets and tested recovery procedures.

---

## 5. Physical Safeguards

### 5.1 Facility Access Controls (§164.310(a))

**Status:** ✅ Compliant via Cloud Provider  
The application runs entirely on Supabase (AWS infrastructure) and Vercel, both of which maintain SOC 2 Type II certification and physical data center security (access controls, surveillance, environmental controls). Physical access to servers is not applicable to the application team.

### 5.2 Workstation Security (§164.310(b)(c))

**Status:** ⚠️ Action Required  
Developer workstations that access production credentials or SSH into infrastructure must have:
- Full disk encryption (FileVault / BitLocker)
- Automatic screen lock (≤15 min idle)
- Endpoint detection and response (EDR) software
- Prohibition on storing PHI locally

### 5.3 Device and Media Controls (§164.310(d))

**Status:** ⚠️ Action Required  
Document procedures for:
- Disposal of devices that may have cached PHI (dev machines, CI/CD runners)
- Media re-use policies
- Encryption of portable media if PHI is ever moved offline

---

## 6. Technical Safeguards

### 6.1 Access Control (§164.312(a)(1))

**Requirement:** Unique user identification, emergency access, automatic logoff, and encryption/decryption mechanisms.

#### 6.1.1 Unique User Identification ✅

Each user receives a unique UUID from Supabase Auth. All API calls are tied to `auth.uid()` via JWT claims. Database RLS policies use `request_user_id()` to isolate data per user.

```sql
-- lib/auth/require-auth.ts: extracts uid from JWT
const userId = payload.sub; // Supabase Auth UUID

-- database: RLS policy example
CREATE POLICY "Users can only see their own profile"
  ON user_profiles FOR SELECT
  USING (user_id = public.request_user_id());
```

#### 6.1.2 Emergency Access Procedure ⚠️

**Status:** Not formally documented. Admin role exists but emergency break-glass procedures are not defined.

**Recommendation:** Document an emergency access procedure where a designated admin can override normal access controls under logged, supervised conditions.

#### 6.1.3 Automatic Logoff ⚠️

**Configuration:** `admin_settings.session_timeout_minutes = 60` is set in the database.

**Gap:** Application code does not enforce this timeout server-side. JWT expiry (managed by Supabase) provides token-level expiry, but idle session tracking is not implemented.

**Recommendation:** Implement client-side idle detection that calls Supabase `signOut()` after 15–30 minutes of inactivity, and server-side session invalidation that rejects JWTs issued before a forced logout timestamp.

#### 6.1.4 Encryption and Decryption ⚠️

**Current State:**

| Data Type | Encryption Status |
|---|---|
| Bank account data (`bank_data`) | ✅ AES-256-GCM, PBKDF2-derived key (`lib/user-profile/encrypt.ts`) |
| SSN (`ssn_encrypted`) | ⚠️ Field named "encrypted" but encryption code path not confirmed for all write paths |
| Names, addresses, phone, DOB | ❌ Stored plaintext in database |
| Driver's license data | ❌ Stored plaintext |
| Chat messages | ❌ Stored plaintext JSONB |
| Data in transit | ✅ HTTPS/TLS enforced (HSTS 2-year preload) |
| Documents (Supabase Storage) | ✅ Encrypted at rest by Supabase (AES-256) |
| Database at rest | ✅ Supabase/AWS RDS encryption at rest |

**Recommendation:** Implement application-layer field encryption for the highest-sensitivity PHI fields (SSN, DOB, driver's license number) using the existing `encryptField()` utility in `lib/user-profile/encrypt.ts`. Row-level database encryption by Supabase covers the broader at-rest requirement.

---

### 6.2 Audit Controls (§164.312(b))

See [Section 4.4](#44-audit-controls-§16430812-d--§16431212). Key implementation:

**Logger with PII redaction** (`lib/server/logger.ts`):
```typescript
const SENSITIVE_KEYS = new Set([
  'authorization', 'token', 'access_token', 'refresh_token',
  'password', 'secret', 'ssn', 'dob',
]);
// Automatically replaces sensitive values with '[REDACTED]'
```

**Login audit trail** (`database/access_management_schema.sql`):
```sql
CREATE TABLE login_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id),
  event_type  TEXT CHECK (event_type IN ('login', 'logout', 'force_logout')),
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 6.3 Integrity Controls (§164.312(c)(1))

**Requirement:** Protect ePHI from improper alteration or destruction.

**Current Implementation:**
- Supabase PostgreSQL provides ACID transactions guaranteeing data integrity
- Application write operations are gated behind JWT authentication
- RLS policies prevent unauthorized writes
- Supabase Storage uses checksums for object integrity

**Gap:** No application-level data integrity verification (e.g., HMAC signatures on records) is implemented for detecting unauthorized out-of-band modifications.

**Recommendation:** For the highest-sensitivity PHI, consider adding HMAC signatures stored alongside records to detect unauthorized database-level modifications.

---

### 6.4 Transmission Security (§164.312(e)(1))

**Requirement:** Guard against unauthorized access to ePHI transmitted over electronic networks.

**Current Implementation:**

**HTTPS Enforcement** (`next.config.mjs`):
```javascript
{
  key: 'Strict-Transport-Security',
  value: 'max-age=63072000; includeSubDomains; preload',
}
```
This enforces HTTPS with a 2-year HSTS policy and preload registration, preventing downgrade attacks.

**Content Security Policy** (`next.config.mjs`):
```
default-src 'self'
script-src 'self' 'unsafe-inline'    ← See gap below
connect-src 'self' [supabase-host] wss://[supabase-host]
frame-src 'none'
object-src 'none'
```

**Additional Headers:**
```
X-Frame-Options: DENY                    ← Prevents clickjacking
X-Content-Type-Options: nosniff          ← Prevents MIME sniffing
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=(), geolocation=()
```

**Gap:** `script-src 'unsafe-inline'` weakens XSS protection. This is a Next.js hydration constraint; it should be mitigated with nonce-based CSP in Next.js middleware.

**Status:** ✅ Substantially compliant — HTTPS enforced end-to-end; CSP inline script gap should be addressed.

---

### 6.5 Authentication (§164.312(d))

**Requirement:** Verify the identity of persons seeking access to ePHI.

**Current Implementation:**

**JWT Validation** (`lib/auth/require-auth.ts`):
- Validates JWT signature using Supabase public key (RS256 in production)
- Checks expiry (`exp` claim), issuer (`iss`), audience (`aud = 'authenticated'`)
- Uses `timingSafeEqual` for HMAC comparison to prevent timing attacks
- Falls back to Supabase `auth.getUser()` for additional server-side validation

**Role Verification** (`lib/auth/require-admin.ts`):
```typescript
const { data: userRole } = await supabase
  .from('user_roles')
  .select('roles(name)')
  .eq('user_id', userId)
  .single();

if (userRole?.roles?.name !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Gaps:**
- Multi-Factor Authentication (MFA) is not enforced for any role, including admins
- `admin_settings.require_2fa_admin = false` in database

**Recommendation:** Enable and enforce MFA (TOTP or SMS) for all staff roles (admin, social_worker, reviewer, supervisor). Supabase Auth supports TOTP MFA natively.

---

### 6.6 Row-Level Security (Defense in Depth)

**Current Implementation:** PostgreSQL RLS policies enforce data isolation at the database layer, independent of application-layer access controls. This provides defense-in-depth: even if application authorization is bypassed, the database rejects unauthorized queries.

**Key RLS functions** (`database/mHealth_schema.sql`):
```sql
-- Extracts authenticated user ID from JWT
CREATE FUNCTION public.request_user_id()
RETURNS UUID AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb->>'sub')::UUID;
$$ LANGUAGE sql STABLE;

-- Checks if user is staff (admin/reviewer)
CREATE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = public.request_user_id()
    AND r.name IN ('admin', 'reviewer', 'supervisor', 'read_only_staff')
  );
$$ LANGUAGE sql STABLE;

-- Applicant self-access or staff access
CREATE FUNCTION public.can_access_applicant(applicant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT applicant_id = public.request_user_id() OR public.is_staff();
$$ LANGUAGE sql STABLE;
```

**Status:** ✅ Strong — RLS provides database-level enforcement independent of application code.

---

## 7. Breach Notification Rule

### 7.1 Requirements

Under 45 CFR §164.400–414, covered entities must notify:
- **Affected individuals** within 60 days of breach discovery
- **HHS Secretary** annually (or immediately if >500 individuals affected)
- **Media** if >500 individuals in a state are affected

### 7.2 Current Breach Detection Capabilities

| Capability | Status |
|---|---|
| Login anomaly detection | ⚠️ Login events logged but no alerting on anomalies |
| Unauthorized access detection | ⚠️ No automated intrusion detection |
| Data exfiltration monitoring | ❌ Not implemented |
| Incident response runbook | ❌ Not documented |

### 7.3 Recommendations

1. **Configure alerts** in OpenObserve or a SIEM tool for:
   - Repeated failed authentication attempts (>5 in 5 min from same IP)
   - Bulk data queries (>100 records returned in single request)
   - Access outside normal hours or from unusual geographies
   - Admin actions on user accounts

2. **Document an Incident Response Plan** including:
   - Breach identification and containment steps
   - Internal escalation chain (Security Officer → Legal → Executive)
   - HHS notification template and timeline
   - Individual notification template

3. **Conduct tabletop exercises** at least annually to validate the plan.

---

## 8. Business Associate Agreements

HIPAA requires a signed Business Associate Agreement (BAA) with every vendor that creates, receives, maintains, or transmits PHI on behalf of the covered entity.

| Vendor | PHI Exposure | BAA Status |
|---|---|---|
| **Supabase Inc.** | Database, Auth, Storage — all PHI | ⚠️ Must be signed (Supabase offers BAA on Enterprise plan) |
| **Vercel Inc.** | Application server processing PHI in memory | ⚠️ Must be signed (Vercel offers BAA on Enterprise plan) |
| **Resend Inc.** | Email invitations (may contain PII) | ⚠️ Must be verified/signed |
| **OpenAI** | AI benefits advisor (prompts may contain PHI) | ⚠️ Must be signed (OpenAI offers BAA for Healthcare) |
| **OpenObserve** | Log/trace data (may include PHI context) | ⚠️ Must be verified/signed |

> **Critical Note:** Without signed BAAs from all vendors above, the application **cannot be legally operated** with PHI under HIPAA, regardless of technical safeguards.

---

## 9. Compliance Gaps and Remediation Roadmap

### Priority Matrix

| # | Finding | Severity | Effort | Timeline |
|---|---|---|---|---|
| 1 | SSN field encryption not verified end-to-end | Critical | Medium | Sprint 1 |
| 2 | Business Associate Agreements not confirmed | Critical | Low | Immediate |
| 3 | MFA not enforced for staff/admin roles | Critical | Low–Medium | Sprint 1 |
| 4 | Comprehensive PHI access audit logging missing | High | Medium | Sprint 2 |
| 5 | Session idle timeout not enforced in app | High | Low | Sprint 1 |
| 6 | No session revocation mechanism | High | Medium | Sprint 2 |
| 7 | Rate limiting is in-memory (breaks on multi-instance) | High | Medium | Sprint 2 |
| 8 | `unsafe-inline` in CSP weakens XSS protection | High | Medium | Sprint 2 |
| 9 | PII fields (name, address, DOB) not app-layer encrypted | Medium | High | Sprint 3 |
| 10 | No anomaly alerting / intrusion detection | Medium | Medium | Sprint 2 |
| 11 | Formal risk analysis not completed | Medium | High | Q2 |
| 12 | Incident response plan not documented | Medium | Low | Q2 |
| 13 | BCDR plan not documented | Medium | Low | Q2 |
| 14 | Workstation security policy not documented | Medium | Low | Q2 |
| 15 | Workforce HIPAA training not implemented | Medium | Low | Q2 |
| 16 | Document upload virus scanning missing | Medium | Medium | Sprint 3 |
| 17 | OpenTelemetry HTTP traces may capture PHI headers | Low | Low | Sprint 2 |
| 18 | Dev-only auth routes must remain disabled in production | Low | Low | Sprint 1 |

### Sprint 1 (Immediate — within 2 weeks)

1. **Verify and fix SSN encryption write path** — Audit all code paths that write to `applicants.ssn_encrypted` to confirm `encryptField()` is called. Add integration test.
2. **Sign BAAs** — Contact Supabase, Vercel, Resend, OpenAI, OpenObserve to initiate BAA process (upgrade to Enterprise plans where needed).
3. **Enable MFA** — Enable Supabase Auth TOTP MFA and enforce for admin, social_worker, and supervisor roles via `app_metadata.mfa_required` check in `require-auth.ts`.
4. **Enforce session idle timeout** — Add client-side `useIdleTimer` hook (15 min) and server-side `last_active` check against JWT `iat`.
5. **Audit dev auth routes** — Confirm `NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS=false` in all production environment configurations and add a startup assertion that fails loudly in production if set to `true`.

### Sprint 2 (Short-term — within 4 weeks)

6. **Implement PHI access audit logging** — Add an `audit_events` table and middleware that records every API route access involving PHI (user_id, action, resource_type, resource_id, timestamp).
7. **Add session revocation** — Create a `revoked_sessions` table; check it in `requireAuthenticatedUser()`; populate on `signOut()` and admin-forced logout.
8. **Redis-backed rate limiting** — Replace in-memory rate limiter with Upstash Redis to work across Vercel serverless instances.
9. **Nonce-based CSP** — Implement per-request nonce in Next.js middleware and replace `'unsafe-inline'` with `'nonce-{nonce}'`.
10. **Anomaly alerting** — Configure OpenObserve alerts for failed auth spikes, bulk queries, and off-hours access.
11. **Disable OpenTelemetry HTTP body capture** — Ensure HTTP instrumentation does not capture request/response bodies (set `requestHook` to filter PHI headers).

### Sprint 3 (Medium-term — within 8 weeks)

12. **Encrypt additional PHI fields** — Encrypt `applicants.first_name`, `last_name`, `address`, `phone`, `dob` and `identity_verification_attempts.license_number` using the existing `encryptField()` utility. Create a migration script.
13. **File upload validation** — Add MIME type verification, file size limits (≤25 MB), and integrate virus scanning (e.g., ClamAV via Lambda or VirusTotal API) for document uploads.
14. **Minimize identity verification data** — Retain only final pass/fail status and confidence score from identity checks; purge raw extraction data after 30 days.

### Q2 (Governance — within 90 days)

15. **Complete formal risk analysis** — Conduct NIST SP 800-30 risk analysis covering all PHI data flows; document residual risks and treatment plans.
16. **Write BCDR plan** — Document RTO (4 hours), RPO (24 hours), Supabase PITR activation steps, Vercel rollback procedures, and communication plan.
17. **Write Incident Response plan** — Include breach classification, containment, notification templates, and escalation chain.
18. **Workstation security policy** — Mandate FileVault, screen lock ≤10 min, and prohibit local PHI storage for all developers.
19. **Annual workforce training** — Deliver HIPAA privacy and security training; maintain completion records for 6 years.

---

## 10. Compliance Matrix Summary

### HIPAA Security Rule — Technical Safeguards (§164.312)

| Specification | Required/Addressable | Status | Notes |
|---|---|---|---|
| Unique user identification | Required | ✅ | Supabase Auth UUIDs |
| Emergency access procedure | Required | ⚠️ | Not documented |
| Automatic logoff | Addressable | ⚠️ | Configured but not enforced in app |
| Encryption/decryption | Addressable | ⚠️ | Partial — bank data encrypted; names/DOB not |
| Audit controls | Required | ⚠️ | Login events only; PHI read access not logged |
| Integrity — authentication mechanisms | Addressable | ✅ | ACID DB, Supabase checksums |
| Integrity — transmission | Required | ✅ | TLS/HTTPS enforced via HSTS |
| Person or entity authentication | Required | ⚠️ | JWT auth present; MFA not enforced |
| Transmission security — encryption | Addressable | ✅ | TLS 1.2+ via Vercel/Supabase |

### HIPAA Security Rule — Administrative Safeguards (§164.308)

| Specification | Required/Addressable | Status | Notes |
|---|---|---|---|
| Security management process — risk analysis | Required | ❌ | Not completed |
| Security management process — risk management | Required | ❌ | Not documented |
| Assigned security responsibility | Required | ❌ | No designated Security Officer |
| Workforce security — authorization | Required | ✅ | RBAC + RLS implemented |
| Workforce security — termination | Addressable | ⚠️ | No formal offboarding procedure |
| Information access management | Required | ✅ | Role-based with admin-only grants |
| Security awareness and training | Addressable | ❌ | No training program |
| Security incident procedures | Required | ❌ | No incident response plan |
| Contingency plan — data backup | Required | ✅ | Supabase automated backups |
| Contingency plan — disaster recovery | Required | ⚠️ | Not formally documented |
| Contingency plan — emergency operations | Required | ⚠️ | Not documented |
| Evaluation | Required | ⚠️ | This document is initial evaluation |
| Business associate contracts | Required | ❌ | BAAs not confirmed for all vendors |

### HIPAA Privacy Rule — Key Requirements

| Requirement | Status | Notes |
|---|---|---|
| Minimum necessary principle | ✅ | RLS + RBAC limit data access to what each role needs |
| Patient right to access own records | ✅ | Applicants can view own application data |
| Consent and authorization | ⚠️ | Consent flow should be verified in onboarding |
| Restrictions on PHI disclosure | ✅ | Data not shared with non-BAA third parties (to be verified) |
| Notice of Privacy Practices | ⚠️ | Must be displayed and acknowledged at registration |

---

## Appendix A — Key Files Reference

| File | HIPAA Relevance |
|---|---|
| `lib/auth/require-auth.ts` | JWT validation, authentication enforcement |
| `lib/auth/require-admin.ts` | Admin role authorization |
| `lib/auth/require-social-worker.ts` | Social worker role authorization |
| `lib/user-profile/encrypt.ts` | AES-256-GCM field encryption |
| `lib/server/logger.ts` | Audit logging with PII redaction |
| `lib/server/rate-limit.ts` | Rate limiting (needs Redis upgrade) |
| `database/mHealth_schema.sql` | PHI table definitions and RLS policies |
| `database/access_management_schema.sql` | RBAC schema, login_events, session settings |
| `next.config.mjs` | Security headers (HSTS, CSP, X-Frame-Options) |
| `instrumentation.ts` | OpenTelemetry tracing (audit trail) |

## Appendix B — Regulatory References

- **45 CFR Part 164** — HIPAA Security and Privacy Rules
- **NIST SP 800-66r2** — Implementing the HIPAA Security Rule
- **NIST SP 800-30r1** — Guide for Conducting Risk Assessments
- **HHS OCR Guidance** — ocr.hhs.gov/hipaa
- **Supabase HIPAA Guide** — supabase.com/docs/guides/platform/hipaa
- **Vercel HIPAA** — vercel.com/security (Enterprise BAA available)

---

*This document was produced as an architectural HIPAA gap assessment. It does not constitute legal advice. Consult a qualified HIPAA compliance attorney and certified security professional before attesting to HIPAA compliance.*
