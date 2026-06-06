# Product and Feature Catalog

**Status:** Canonical product and feature documentation  
**Last updated:** 2026-06-06

## Product Summary

HealthCompass MA is a MassHealth application and benefits assistance platform for applicants, social workers, reviewers, and administrators. The product combines deterministic eligibility logic, document workflows, AI-assisted form completion, policy-grounded guidance, and collaboration tools.

The current product is a production-oriented modular monolith built with Next.js, TypeScript, Supabase/Postgres, Supabase Storage, pgvector, and AI SDK-based agent workflows.

## Personas

| Persona | Primary goals | Core surfaces |
|---|---|---|
| Applicant / customer | Apply for MassHealth, understand eligibility, manage profile, upload documents, review benefit history, receive notifications. | `/prescreener`, `/application/*`, `/customer/*`, `/benefit-stack`, `/masshealth-appeals`, chat widget. |
| Social worker | Search patients, support applications, collaborate in sessions, exchange messages, guide document completion. | `/social-worker/*`, session room, direct messages, patient application pages. |
| Reviewer | Review applications, income evidence, RFIs, decisions, reports, and audit context. | `/reviewer/*`, reviewer case pages, income verification APIs. |
| Admin | Manage users, roles, companies, glossary, reports, analytics, MFA/passkeys, PHI audit, and platform settings. | `/admin/*`, admin APIs, glossary admin, analytics dashboards. |

## Feature Domains

### 1. Authentication, Roles, and Access

Current capabilities:
- Applicant registration, login, password reset, MFA flow, invite flow, session cookie support, and passkey logout.
- Role-based access for applicant, social worker, reviewer, supervisor, read-only staff, case reviewer, and admin.
- Admin-sensitive operations require stronger authentication with MFA and passkey support.
- Development-only auth helpers are explicitly scoped to local/test contexts.

Primary files:
- `lib/auth/*`
- `app/auth/*`
- `app/api/auth/*`
- `components/admin/admin-auth-gate.tsx`

### 2. Applicant Intake and ACA-3 Workflow

Current capabilities:
- Prescreener flow for early eligibility guidance.
- ACA-3 application intake through form wizard and conversational assistant.
- Application draft save/resume, PHI draft key handling, validation, document attachment, and PDF generation/fill.
- Modular ACA3 components after decomposition: wizard context, field renderer, validation, steps, submit/review flows, intake question builder, answer parser, and assistant utilities.

Primary files:
- `components/application/aca3/*`
- `app/application/*`
- `app/api/applications/*`
- `app/api/forms/aca-3-0325/fill/*`
- `lib/pdf/masshealth-aca*`

### 3. Benefit Orchestration and Eligibility

Current capabilities:
- Deterministic benefit program evaluation for MassHealth, SNAP, TAFDC, EAEDC, MSP, WIC, LIHEAP, childcare, EITC, Section 8, and Health Safety Net.
- Family profile capture and benefit stack results.
- Benefit Advisor agent tools for conversational guidance.
- Health Safety Net eligibility is treated as deterministic domain logic first, with AI explanation only for user-facing plain language.

Primary files:
- `lib/benefit-orchestration/*`
- `app/benefit-stack/*`
- `app/api/benefit-orchestration/*`
- `lib/masshealth/*eligibility*`

### 4. Document Handling, Identity, and Income Verification

Current capabilities:
- Document upload, validation, thumbnail/PDF handling, page OCR/extraction, and application document routes.
- Identity verification via driver-license analysis, mobile verification sessions, QR flow, AAMVA parsing, and profile auto-fill.
- Income evidence requirements, income document extraction, reviewer decisions, recompute flow, and RFI support.
- Mobile upload sessions are tokenized, expiring, and rate-limited.

Primary files:
- `lib/uploads/*`
- `lib/identity/*`
- `lib/db/identity-verification.ts`
- `lib/db/income-verification.ts`
- `app/api/identity/*`
- `app/api/masshealth/income-verification/*`
- `app/api/upload/mobile/[token]/*`

### 5. Insurance History Timeline

Current capabilities:
- Customer insurance history page with annual coverage records.
- Timeline components, summary card, chart, and coverage form.
- Coverage records from platform-derived, self-reported, and document-derived sources.
- Explanation engine compares adjacent coverage records and produces plain-language transition explanations.

Data model:
- `insurance_coverage_records`
- `insurance_explanations`

Primary files:
- `app/customer/insurance-history/*`
- `components/insurance-history/*`
- `lib/insurance-history/*`
- `app/api/insurance-history/*`

### 6. Glossary and Language Support

Current capabilities:
- Contextual glossary table with English definitions and multilingual fields.
- Scanner that detects benefit/insurance terms in rendered text.
- `GlossaryText`, `GlossaryTerm`, and `GlossaryPopover` components.
- Public glossary APIs and admin glossary CRUD APIs.
- Terms can be integrated into chat, benefit descriptions, appeals, prescreener results, and knowledge-center content.

Data model:
- `glossary_terms`

Primary files:
- `lib/glossary/*`
- `components/glossary/*`
- `app/api/glossary/*`
- `app/api/admin/glossary/*`

### 7. Appeals and Policy Assistance

Current capabilities:
- Appeal category retrieval, draft personalization, document extraction, and appeal draft generation.
- Denial-pattern and source-document support through MassHealth appeal source tables.
- AI drafting is constrained to assistance and explanation; legal advice boundaries must remain explicit.

Primary files:
- `app/masshealth-appeals/*`
- `app/api/masshealth/appeals/*`
- `lib/appeals/*`

### 8. Collaboration, Messaging, and Notifications

Current capabilities:
- Social-worker patient search, engagement requests, patient access, collaborative sessions, and session messages.
- Direct chat panel, voice messaging, transcription routes, and WebRTC screen share/session support.
- Notifications, unread count, read/read-all routes, and benefit policy update notifications.

Primary files:
- `lib/collaborative-sessions/*`
- `components/collaborative-sessions/*`
- `components/chat/*`
- `app/api/sessions/*`
- `app/api/social-worker/*`
- `app/api/notifications/*`
- `lib/notifications/*`

### 9. Growth, SEO, Analytics, and Admin Reporting

Current capabilities:
- Growth scripts/provider, referral capture, mailing-list signups, SEO metadata, analytics route families, and admin reports.
- Admin analytics drill-downs and export/bulk routes.
- Current analytics should remain privacy-aware and avoid PHI leakage into third-party tooling.

Primary files:
- `components/analytics/*`
- `lib/growth/*`
- `app/api/growth/*`
- `app/admin/analytics/*`
- `app/api/admin/analytics/*`

## Current Out of Scope

- Automated government submission to MassHealth or the Health Connector.
- Binding eligibility determinations without reviewer/user confirmation.
- Legal advice or representative services for appeals.
- Production PHI processing by any vendor without completed BAA and security review.
- Fully autonomous policy-monitor-driven benefit changes without user-visible evidence and audit trail.

## Feature Ownership Matrix

| Domain | Product owner lens | Engineering owner lens | Security/compliance lens |
|---|---|---|---|
| Intake and ACA-3 | Completion rate, error reduction, accessibility | Form architecture, validation, PDF fidelity | PHI minimization, encrypted drafts |
| Benefit orchestration | Accurate program guidance | Deterministic engines, test fixtures | Avoid false eligibility guarantees |
| AI assistant | Clarity, language access, retention | Prompt/RAG/tool reliability | Citation quality, PHI controls |
| Identity/documents | Trust, reduced manual entry | Upload/extraction pipelines | Token expiry, storage access, audit |
| Collaboration | Case support and continuity | Sessions, messaging, WebRTC | Access grants, revocation, message audit |
| Admin/reviewer | Operational throughput | Role APIs, reporting, dashboards | MFA/passkey, least privilege |

