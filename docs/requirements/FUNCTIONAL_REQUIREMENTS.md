# Functional Requirements

**Status:** Generated from current codebase  
**Baseline date:** 2026-04-15  

## 1. Authentication and Authorization

| ID | Requirement | Current implementation anchors |
|---|---|---|
| FR-001 | The system shall support applicant registration, login, invite callback, local development auth helpers, and current-user lookup. | `app/auth/*`, `app/api/auth/*`, `lib/auth/*` |
| FR-002 | The system shall distinguish applicant, social worker, reviewer, and admin access patterns. | `lib/auth/require-auth.ts`, `lib/auth/require-social-worker.ts`, `lib/auth/require-admin.ts`, admin/social-worker/reviewer routes |
| FR-003 | Admin-only operations shall reject unauthenticated or non-admin callers. | `app/api/admin/**`, `lib/auth/require-admin.ts` |
| FR-004 | Social-worker-only operations shall reject unauthorized callers and shall scope patient data to granted access. | `app/api/social-worker/**`, `app/api/patient/**`, `lib/db/social-worker.ts` |
| FR-005 | Development-only auth helpers shall not be enabled in production. | `NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS`, `app/api/auth/dev-*` |

## 2. Applicant Profile and Dashboard

| ID | Requirement | Current implementation anchors |
|---|---|---|
| FR-010 | Applicants shall be able to view and update profile sections including personal, education, bank, notification, and family summary data. | `app/customer/profile/page.tsx`, `components/user-profile/*`, `lib/db/user-profile.ts` |
| FR-011 | The system shall support applicant dashboard, session list, status view, and notification entry points. | `app/customer/dashboard/*`, `app/customer/sessions/page.tsx`, `app/customer/status/page.tsx` |
| FR-012 | Applicant profile storage shall support encrypted sensitive fields where configured. | `lib/user-profile/encrypt.ts`, `PROFILE_ENCRYPTION_KEY` |

## 3. Prescreener and Eligibility

| ID | Requirement | Current implementation anchors |
|---|---|---|
| FR-020 | The prescreener shall collect core eligibility facts and display likely benefit results. | `app/prescreener/*`, `components/prescreener/EligibilityResults.tsx` |
| FR-021 | The eligibility engine shall calculate FPL and program status deterministically. | `lib/eligibility-engine.ts`, `lib/masshealth/*eligibility-engine.ts` |
| FR-022 | Eligibility results shall include program status, reason/tagline, next action, and user-facing color/category data. | `lib/eligibility-engine.ts`, `lib/benefit-orchestration/types.ts` |
| FR-023 | Missing critical facts shall produce a follow-up question rather than a fabricated eligibility result. | `lib/masshealth/fact-extraction.ts`, `lib/agents/benefit-advisor/tools.ts` |

## 4. MassHealth Application Intake

| ID | Requirement | Current implementation anchors |
|---|---|---|
| FR-030 | Applicants shall be able to select an application type and start new or renewal workflows. | `app/application/type/page.tsx`, `app/application/new/page.tsx`, `app/application/renewal/page.tsx` |
| FR-031 | The system shall support ACA-3 form wizard state, household member entry, income entry, and confirmation. | `components/application/aca3/form-wizard.tsx`, `app/application/household/page.tsx`, `app/application/confirmation/page.tsx` |
| FR-032 | Application drafts shall be persisted and reloadable by application id. | `app/api/applications/[applicationId]/draft/route.ts`, `lib/db/application-drafts.ts` |
| FR-033 | Application checks shall identify missing required fields, eligibility findings, and next-step guidance. | `components/application/ApplicationChecksPanel.tsx`, `lib/masshealth/application-checks.ts` |
| FR-034 | The app shall generate and fill MassHealth PDF payloads from structured application data. | `app/api/forms/aca-3-0325/fill/route.ts`, `app/api/pdf/generate/route.ts`, `lib/pdf/*` |
| FR-035 | The intake agent shall ask one question at a time and avoid repeating known household relationship facts. | `lib/agents/intake/*`, `lib/masshealth/household-relationships.ts` |

## 5. Form Assistant

| ID | Requirement | Current implementation anchors |
|---|---|---|
| FR-040 | The form assistant shall extract structured fields from the conversation and emit field updates to the UI. | `app/api/agents/form-assistant/route.ts`, `lib/agents/form-assistant/tools.ts`, `lib/masshealth/form-field-extraction.ts` |
| FR-041 | The form assistant shall deduplicate household members and income sources against current client state. | `lib/masshealth/form-field-extraction.ts`, `lib/agents/form-assistant/tools.ts` |
| FR-042 | The form assistant shall not extract or request SSN through LLM field extraction. | `lib/agents/form-assistant/prompts.ts`, `lib/masshealth/form-field-extraction.ts` |
| FR-043 | The form assistant shall retrieve policy only for policy, eligibility, or document guidance questions. | `lib/agents/form-assistant/tools.ts` |

## 6. Benefit Orchestration

| ID | Requirement | Current implementation anchors |
|---|---|---|
| FR-050 | The system shall collect a family profile for cross-program benefit evaluation. | `components/benefit-orchestration/FamilyProfileWizard.tsx`, `lib/benefit-orchestration/types.ts` |
| FR-051 | The benefit orchestrator shall evaluate MassHealth, SNAP, WIC, LIHEAP, MSP, childcare, Section 8, TAFDC, EAEDC, and EITC modules. | `lib/benefit-orchestration/orchestrator.ts`, `lib/benefit-orchestration/programs/*` |
| FR-052 | Benefit results shall include status, confidence, estimated value where available, eligibility factors, next steps, and required documents. | `lib/benefit-orchestration/types.ts` |
| FR-053 | Benefit stack results and family profiles shall be persisted for later access. | `app/api/benefit-orchestration/*`, `lib/db/benefit-orchestration.ts`, `database/benefit_orchestration_schema.sql` |

## 7. Appeals

| ID | Requirement | Current implementation anchors |
|---|---|---|
| FR-060 | Users shall be able to submit denial context and receive an appeal explanation, letter, and evidence checklist. | `app/appeal-assistant/page.tsx`, `components/appeals/*`, `app/api/agents/appeal/route.ts` |
| FR-061 | Appeal drafting shall retrieve relevant policy and appeal procedure context before final generation. | `lib/agents/appeal/tools.ts`, `app/api/masshealth/appeals/research/route.ts` |
| FR-062 | Appeal letters shall pass a reflection quality gate before final output. | `lib/agents/reflection/quality-gate.ts`, `lib/agents/appeal/tools.ts`, `app/api/appeals/analyze/route.ts` |
| FR-063 | Appeals category metadata and draft endpoints shall remain available for MassHealth appeal UI flows. | `app/api/masshealth/appeals/categories/route.ts`, `app/api/masshealth/appeals/draft/route.ts` |

## 8. Document Handling and Identity Verification

| ID | Requirement | Current implementation anchors |
|---|---|---|
| FR-070 | Applications shall support document upload, listing, retrieval, and deletion by application id. | `app/api/applications/[applicationId]/documents/*`, `lib/db/documents.ts` |
| FR-071 | PDF extraction shall validate uploads and return structured extraction data. | `app/api/pdf/extract/route.ts`, `lib/pdf/extract-pdf-json.ts` |
| FR-072 | Income verification shall support checklist generation, document upload, extraction, recompute, reviewer decision, and RFI. | `app/api/masshealth/income-verification/**`, `app/api/reviewer/income-verification/**`, `lib/db/income-verification.ts` |
| FR-073 | Identity verification shall support mobile session creation, QR code flow, license scan/parse, and verification status lookup. | `app/api/identity/**`, `components/identity/*`, `lib/identity/*` |
| FR-074 | Uploaded document and identity files shall be scoped to authenticated users and application ownership. | `lib/supabase/storage.ts`, document and identity route handlers |

## 9. Collaboration, Messaging, and Notifications

| ID | Requirement | Current implementation anchors |
|---|---|---|
| FR-080 | Social workers shall be able to request and manage patient engagement access. | `app/api/social-worker/engagement-requests/**`, `app/api/patient/sw-request/route.ts` |
| FR-081 | The system shall support direct messages between social workers and patients, including uploaded media and transcription status. | `app/api/messages/**`, `app/api/social-worker/messages/route.ts`, `lib/db/sw-messaging.ts` |
| FR-082 | Collaborative sessions shall support scheduling, active/ended states, session messages, voice messages, and session room UI. | `app/api/sessions/**`, `components/collaborative-sessions/*`, `lib/collaborative-sessions/*` |
| FR-083 | Notifications shall support create/list, unread count, mark read, and mark all read. | `app/api/notifications/**`, `components/notifications/*`, `lib/notifications/*` |

## 10. Admin and Reporting

| ID | Requirement | Current implementation anchors |
|---|---|---|
| FR-090 | Admins shall be able to manage users, invite users, list companies, manage social workers, view stats, and access analytics. | `app/admin/**`, `app/api/admin/**`, `lib/db/admin.ts` |
| FR-091 | Admin analytics shall support drill-down data and export workflows. | `app/api/admin/analytics/**`, `app/api/admin/export/route.ts`, `lib/db/admin-analytics.ts` |
| FR-092 | Admin reports shall be exposed through the admin UI. | `app/admin/reports/page.tsx` |

## 11. Knowledge Center

| ID | Requirement | Current implementation anchors |
|---|---|---|
| FR-100 | Users shall be able to browse MassHealth knowledge center articles, videos, and documents. | `app/knowledge-center/**`, `lib/masshealth/knowledge-center.ts` |
| FR-101 | Knowledge center content shall distinguish videos, articles, and downloadable documents. | `lib/masshealth/types.ts` |

## 12. Cross-Feature Requirements

| ID | Requirement |
|---|---|
| FR-110 | All user-facing errors shall be actionable and avoid exposing internal stack traces. |
| FR-111 | Long-running AI, extraction, and document operations shall fail softly with retryable messages where possible. |
| FR-112 | New features shall include route-level or module-level tests for auth failure, validation failure, happy path, and persistence failure. |
| FR-113 | User-facing policy claims must be grounded in deterministic rules, retrieved policy context, or documented static content. |
