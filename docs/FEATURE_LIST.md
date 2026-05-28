# HealthCompass MA Feature List

**Status:** Current supported feature inventory  
**Baseline date:** 2026-04-16  
**Scope:** Features visible in the current Next.js app, API routes, domain libraries, and supporting docs.

This document lists the product capabilities currently supported by HealthCompass MA. It is implementation-grounded: each feature group includes the primary UI, API, and logic anchors that maintain it.

## Personas

| Persona | Supported workflows |
|---|---|
| Applicant | Eligibility screening, MassHealth application intake, profile management, identity verification, document upload, benefit discovery, appeal support, notifications, social-worker collaboration. |
| Social worker | Patient access, patient dashboard review, messaging, collaborative sessions, application support, engagement requests. |
| Reviewer | Case queue, case details, audit view, income verification review, RFI and decision workflows. |
| Admin | User, role, company, social-worker, session, analytics, reports, exports, and invitations management. |
| AI assistant | MassHealth Q&A, benefit advisor, intake assistant, form assistant, appeal assistant, vision/document extraction, RAG-backed policy retrieval, reflection quality gates. |

## Public And Entry Features

| Feature | Description | Primary anchors |
|---|---|---|
| Landing page | Public entry point with product navigation and calls to action. | `app/page.tsx`, `app/page.constants.tsx`, `app/page.hooks.ts` |
| Authentication | Login, registration, OAuth callback, invite acceptance, current-user lookup, and local development auth helpers. | `app/auth/*`, `app/api/auth/*`, `lib/auth/*` |
| Role-based access | Distinguishes applicant, social worker, reviewer, and admin access. | `lib/auth/require-auth.ts`, `lib/auth/require-social-worker.ts`, `lib/auth/require-admin.ts` |
| Company search | Searches provider/company data for social-worker registration and admin company workflows. | `app/api/companies/search/route.ts`, `app/admin/companies/page.tsx` |
| Health checks | App and database health endpoints. | `app/api/health/route.ts`, `app/api/health/db/route.ts` |

## Applicant Features

| Feature | Description | Primary anchors |
|---|---|---|
| Applicant dashboard | Shows applications, next actions, status cards, profile/avatar entry points, notifications, social-worker access, and session invitations. | `app/customer/dashboard/page.tsx`, `app/customer/dashboard/*` |
| Application status list | Lists applications with status filter, search, type labels, and retryable loading state. | `app/customer/status/page.tsx`, `app/api/applications/route.ts` |
| Application status detail | Shows one application draft/status record, timeline, household summary, income summary, and edit path. | `app/customer/status/[id]/page.tsx`, `app/api/applications/[applicationId]/draft/route.ts` |
| User profile | Lets applicants manage personal info, family summary, education, bank account, notification preferences, app settings, language, accessibility options, and avatar. | `app/customer/profile/page.tsx`, `components/user-profile/*`, `app/api/user-profile/*`, `lib/db/user-profile.ts` |
| Profile photo | Uploads and removes profile avatar images. | `components/user-profile/PersonalSection.tsx`, `app/api/user-profile/avatar/route.ts` |
| Encrypted sensitive profile fields | Supports encrypted storage patterns for sensitive profile data where configured. | `lib/user-profile/encrypt.ts`, `lib/db/user-profile.ts` |
| Applicant notifications | Lists notifications, unread count, individual read, and mark-all-read. | `app/notifications/page.tsx`, `components/notifications/*`, `app/api/notifications/*`, `lib/notifications/*` |
| Applicant sessions | Lists and opens collaborative sessions. | `app/customer/sessions/page.tsx`, `app/customer/sessions/[sessionId]/page.tsx`, `components/collaborative-sessions/*` |
| Social-worker access grant | Lets applicants grant or revoke social-worker access by email. | `app/api/patient/social-worker-access/route.ts`, `app/customer/dashboard/page.tsx` |
| Social-worker assistance request | Lets applicants request or cancel support from social workers. | `app/api/patient/sw-request/route.ts`, `components/social-worker/engagement-requests-panel.tsx` |
| Idle timeout guard | Warns users before session timeout and supports staying signed in. | `components/shared/IdleTimeoutGuard.tsx`, `hooks/use-idle-timeout.ts` |
| Language switching | Supports app language state and translated copy for key applicant flows. | `components/shared/LanguageSwitcher.tsx`, `lib/i18n/*`, `lib/redux/features/app-slice.ts` |

## Eligibility And Benefit Discovery

| Feature | Description | Primary anchors |
|---|---|---|
| Prescreener | Collects core facts and returns likely eligibility results. | `app/prescreener/page.tsx`, `components/prescreener/EligibilityResults.tsx`, `lib/eligibility-engine.ts` |
| Deterministic MassHealth eligibility | Runs MassHealth-specific deterministic eligibility logic for ACA-3 and ACA-3-AP flows. | `lib/masshealth/aca3-eligibility-engine.ts`, `lib/masshealth/aca3ap-eligibility-engine.ts` |
| FPL calculations | Computes federal poverty level percentages and program thresholds. | `lib/benefit-orchestration/fpl-utils.ts`, `lib/eligibility-engine.ts` |
| Cross-program benefit stack | Evaluates a family profile across multiple programs and ranks opportunities. | `app/benefit-stack/page.tsx`, `components/benefit-orchestration/*`, `app/api/benefit-orchestration/evaluate/route.ts`, `lib/benefit-orchestration/orchestrator.ts` |
| Supported benefit programs | MassHealth, SNAP, WIC, LIHEAP, Medicare Savings Program, childcare assistance, Section 8, TAFDC, EAEDC, and EITC evaluators. | `lib/benefit-orchestration/programs/*` |
| Benefit profile persistence | Saves and reloads family profiles and benefit-stack results. | `app/api/benefit-orchestration/profile/route.ts`, `lib/db/benefit-orchestration.ts` |

## MassHealth Application Features

| Feature | Description | Primary anchors |
|---|---|---|
| Application type selection | Lets users choose new application or renewal paths. | `app/application/type/page.tsx`, `app/application/new/page.tsx`, `app/application/renewal/page.tsx` |
| ACA-3 form wizard | Captures applicant, household, income, coverage, and supporting application data. | `components/application/aca3/form-wizard.tsx`, `components/application/wizard-layout.tsx` |
| Household entry | Supports household member entry and relationship-aware application state. | `app/application/household/page.tsx`, `lib/masshealth/household-relationships.ts` |
| Application assistant | Chat-style application helper embedded in the ACA-3 workflow. | `components/application/aca3/application-assistant.tsx`, `components/application/aca3/intake-chat.tsx` |
| Draft persistence | Saves, retrieves, and updates application drafts by application id. | `app/api/applications/[applicationId]/draft/route.ts`, `lib/db/application-drafts.ts` |
| Application checks | Identifies missing required fields, warnings, eligibility findings, and next-step guidance. | `components/application/ApplicationChecksPanel.tsx`, `lib/masshealth/application-checks.ts` |
| Address validation | Validates address inputs and returns suggested corrections. | `app/api/address/validate/route.ts`, `hooks/use-personal-info-validation.ts`, `components/shared/AddressFields.tsx` |
| ACA PDF fill | Generates filled ACA-3 PDF output from structured payloads. | `app/api/forms/aca-3-0325/fill/route.ts`, `lib/pdf/masshealth-aca.ts`, `lib/pdf/masshealth-aca-payload.ts` |
| Generic PDF generation | Generates PDFs from JSON payloads and supports PDF preview workflows. | `app/api/pdf/generate/route.ts`, `lib/pdf/*` |
| Confirmation flow | Presents completed application confirmation state. | `app/application/confirmation/page.tsx` |

## Document And Verification Features

| Feature | Description | Primary anchors |
|---|---|---|
| Application document upload | Uploads, lists, previews, and deletes documents by application. | `components/application/document-uploader.tsx`, `app/api/applications/[applicationId]/documents/*`, `lib/db/documents.ts` |
| Document extraction | Extracts text/JSON from uploaded PDFs with validation for file type and size. | `app/api/pdf/extract/route.ts`, `lib/pdf/extract-pdf-json.ts` |
| Appeal document extraction | Extracts denial notice text for appeal workflows. | `app/api/appeals/extract-document/route.ts`, `hooks/use-document-upload.ts` |
| Income evidence checklist | Generates per-member, per-income-source evidence requirements. | `components/application/income-verification/income-evidence-checklist.tsx`, `app/api/masshealth/income-verification/checklist/route.ts`, `lib/masshealth/income-verification-engine.ts` |
| Income document upload and extraction | Uploads income documents, starts extraction, and recomputes verification state. | `app/api/masshealth/income-verification/documents/route.ts`, `app/api/masshealth/income-verification/extract/route.ts`, `app/api/masshealth/income-verification/[applicationId]/recompute/route.ts` |
| Identity verification | Verifies identity using license barcode scan, AAMVA parsing, profile matching, and status banners. | `components/identity/*`, `app/api/identity/verify-license/route.ts`, `lib/identity/*`, `lib/db/identity-verification.ts` |
| Mobile verification session | Creates QR/mobile verification sessions and polls for completion. | `app/api/identity/mobile-session/route.ts`, `app/api/identity/mobile-verify/[token]/route.ts`, `app/verify/mobile/[token]/page.tsx`, `lib/db/mobile-verify-session.ts` |
| License profile scan | Scans license data to prefill profile fields. | `components/identity/ProfileScanModal.tsx`, `lib/identity/aamva-parser.ts` |

## Appeals Features

| Feature | Description | Primary anchors |
|---|---|---|
| Appeal assistant | Collects denial context and returns user-facing appeal analysis, letter content, and evidence checklist. | `app/appeal-assistant/page.tsx`, `components/appeals/*`, `app/api/appeals/analyze/route.ts`, `lib/appeals/*` |
| MassHealth appeals workspace | Supports denial text/file input, category selection, policy research, fact entry, appeal drafting, and document download. | `app/masshealth-appeals/page.tsx`, `app/api/masshealth/appeals/*`, `lib/appeals/draft-personalization.ts` |
| Appeal policy retrieval | Retrieves relevant MassHealth policy context for appeal research and drafting. | `app/api/masshealth/appeals/research/route.ts`, `lib/rag/retrieve.ts` |
| Appeal quality gate | Runs reflection review before final appeal output where agent flow is used. | `app/api/agents/appeal/route.ts`, `lib/agents/appeal/*`, `lib/agents/reflection/quality-gate.ts` |
| Appeal categories | Exposes category metadata for denial issue selection. | `app/api/masshealth/appeals/categories/route.ts`, `lib/appeals/constants.ts` |

## Social Worker Features

| Feature | Description | Primary anchors |
|---|---|---|
| Social-worker dashboard | Shows social-worker workspace entry points and operational summary. | `app/social-worker/dashboard/page.tsx` |
| Patient list | Lists authorized patients and supports patient navigation. | `app/social-worker/patients/page.tsx`, `app/api/social-worker/patients/route.ts`, `lib/db/social-worker.ts` |
| Patient dashboard view | Lets social workers view an authorized patient's applicant-style dashboard. | `app/social-worker/patients/[patientId]/page.tsx`, `app/api/social-worker/patients/[patientId]/dashboard/route.ts` |
| Patient profile view | Lets social workers access authorized patient profile data. | `app/api/social-worker/patients/[patientId]/profile/route.ts` |
| Patient application access | Lists patient applications, opens an application, and starts a new application for a patient. | `app/social-worker/patients/[patientId]/applications/*`, `app/api/social-worker/patients/[patientId]/applications/route.ts` |
| Engagement requests | Social workers can review and resolve patient support requests. | `app/api/social-worker/engagement-requests/*`, `components/social-worker/engagement-requests-panel.tsx` |
| Social-worker profile | Supports social-worker profile lookup and management. | `app/api/social-worker/profile/route.ts`, `app/api/social-worker/search/route.ts` |
| Direct messaging | Supports patient/social-worker threads and direct messages. | `app/social-worker/messages/*`, `app/api/messages/[userId]/route.ts`, `app/api/social-worker/messages/route.ts`, `lib/db/sw-messaging.ts` |
| Message uploads | Supports uploaded files/media in message threads. | `app/api/messages/[userId]/upload/route.ts` |
| Message translation | Translates message content for multilingual communication. | `app/api/messages/translate/route.ts` |
| Message transcription | Supports voice/audio transcription status and result retrieval. | `app/api/messages/[userId]/[messageId]/transcription/route.ts` |
| Collaborative session scheduling | Lets social workers schedule or invite patients to sessions. | `components/collaborative-sessions/ScheduleSessionModal.tsx`, `app/api/sessions/route.ts` |
| Collaborative session room | Supports session messages, active/ended status, voice messages, and shared room UI. | `components/collaborative-sessions/SessionRoom.tsx`, `app/api/sessions/[sessionId]/*` |
| Screen sharing | Supports one-way screen sharing via WebRTC and Supabase broadcast signaling. | `components/collaborative-sessions/ScreenSharePanel.tsx`, `hooks/use-webrtc-screenshare.ts`, `lib/collaborative-sessions/session-rtc-context.tsx` |

## Reviewer Features

| Feature | Description | Primary anchors |
|---|---|---|
| Reviewer dashboard | Reviewer landing page with case workload summaries. | `app/reviewer/dashboard/page.tsx` |
| Case list | Lists reviewer cases and queue state. | `app/reviewer/cases/page.tsx` |
| Case detail | Shows detailed case data, warnings, evidence, and application context. | `app/reviewer/case/[id]/page.tsx` |
| Audit view | Supports reviewer audit page for case traceability. | `app/reviewer/audit/page.tsx` |
| Income verification decision | Lets reviewers record income verification decisions. | `app/api/reviewer/income-verification/[applicationId]/decision/route.ts`, `lib/db/income-verification.ts` |
| Request for information | Lets reviewers issue income verification RFIs. | `app/api/reviewer/income-verification/[applicationId]/rfi/route.ts` |

## Admin Features

| Feature | Description | Primary anchors |
|---|---|---|
| Admin dashboard | Admin landing page with management navigation and summary cards. | `app/admin/page.tsx`, `app/api/admin/stats/route.ts` |
| User management | Lists users, changes activation state, assigns roles, bulk actions, CSV import, and invitations. | `app/admin/users/page.tsx`, `app/api/admin/users/*`, `app/api/admin/bulk/route.ts`, `lib/db/admin-access.ts` |
| Role and permission management | Creates/deletes roles and updates role permissions. | `app/admin/roles/page.tsx`, `app/api/admin/roles/route.ts`, `lib/constants/permissions.ts` |
| Company management | Searches, creates, approves, rejects, and lists companies. | `app/admin/companies/page.tsx`, `app/api/admin/companies/route.ts` |
| Social-worker management | Lists, filters, approves, rejects, and invites social workers. | `app/admin/social-workers/page.tsx`, `app/api/admin/social-workers/route.ts` |
| Admin analytics | Shows platform metrics and chart drill-downs. | `app/admin/analytics/page.tsx`, `app/api/admin/analytics/*`, `lib/db/admin-analytics.ts` |
| Reports and exports | Exports application and user CSV reports. | `app/admin/reports/page.tsx`, `app/api/admin/export/route.ts` |
| Session management | Shows active sessions, updates session settings, and force-signs-out users. | `app/admin/sessions/page.tsx`, `app/api/admin/sessions/route.ts` |

## Knowledge And Education Features

| Feature | Description | Primary anchors |
|---|---|---|
| Knowledge center | Browse MassHealth education resources. | `app/knowledge-center/page.tsx`, `lib/masshealth/knowledge-center.ts` |
| Articles | Article listing page for knowledge resources. | `app/knowledge-center/articles/page.tsx` |
| Videos | Video listing page for knowledge resources. | `app/knowledge-center/videos/page.tsx` |
| Resource typing | Distinguishes videos, articles, and downloadable documents. | `lib/masshealth/types.ts` |

## AI And Agent Features

| Feature | Description | API boundary | Prompt design | Retrieval strategy | Evaluation metrics |
|---|---|---|---|---|---|
| Supervisor agent | Routes general messages to the correct specialist agent. | `POST /api/agents` | Strict intent classification with bounded choices. | None directly; delegates to specialist. | Intent accuracy, fallback rate, route latency. |
| General chat agent | Answers MassHealth questions in plain language. | `POST /api/agents/chat` | Out-of-scope guard plus MassHealth-specific system prompt. | Model may call `retrieve_policy` for focused policy context. | Citation coverage, answer relevance, out-of-scope rejection rate, P95 latency. |
| Benefit advisor agent | Extracts facts, checks deterministic eligibility, retrieves policy, and explains likely eligibility. | `POST /api/agents/benefit-advisor` | Tool-first ReAct flow: extract facts, check eligibility, retrieve policy, finish explanation. | Queries derived from extracted facts and top programs, not full transcript dumps. | Eligibility agreement, fact extraction precision/recall, memory reuse rate, reflection pass rate. |
| Form assistant agent | Extracts structured form updates and answers section-specific questions. | `POST /api/agents/form-assistant` | Field extraction prompt with SSN exclusion and dedupe rules. | Retrieves policy only for policy, eligibility, or document guidance questions. | Field extraction accuracy, duplicate member rate, unsafe-field extraction rate. |
| Intake agent | Guides users through intake one question at a time. | `POST /api/agents/intake` | Conversational intake prompt with household relationship awareness. | Uses domain context when needed; deterministic checks remain outside the prompt. | Completion rate, repeated-question rate, missing-critical-fact rate. |
| Appeal agent | Drafts appeal support content from denial context. | `POST /api/agents/appeal` | Structured appeal prompt with final reflection gate. | Retrieves denial-reason-specific policy and procedure context. | JSON/structure validity, policy grounding, reflection revision rate, user-edit burden. |
| Vision agent | Extracts information from uploaded documents/images. | `POST /api/agents/vision` | Vision/document extraction prompt with bounded output shape. | No broad RAG by default; document content is the primary context. | Extraction accuracy, parse success, invalid-file rejection rate. |
| Legacy MassHealth chat | Compatibility endpoint for MassHealth chat widget. | `POST /api/chat/masshealth` | Mode-specific MassHealth prompt. | Focused policy retrieval for MassHealth Q&A and eligibility guidance. | Same as chat and benefit advisor, depending on mode. |
| Agent memory | Saves and reloads persistent benefit-advisor facts. | Internal library | Not prompt-owned; memory is loaded before prompt construction. | N/A | Memory accuracy, stale fact rate, user correction rate. |
| Reflection quality gate | Reviews high-stakes generated explanations and letters before final output. | Internal library | Critique/revision prompt with pass/fail criteria. | Uses generated text and relevant context, not independent broad search. | Pass rate, revision rate, blocked unsafe output rate. |

## RAG And Policy Features

| Feature | Description | Primary anchors |
|---|---|---|
| Policy ingestion | Ingests policy sources into document and chunk storage. | `app/api/rag/ingest/route.ts`, `lib/rag/ingest.ts` |
| Embeddings | Generates embeddings and supports cache behavior. | `lib/rag/embed.ts`, `lib/rag/embed-cache.ts` |
| Policy retrieval | Retrieves policy chunks through pgvector search. | `lib/rag/retrieve.ts`, `lib/rag/types.ts` |
| Retrieval metadata | Tracks chunk scores, source metadata, and confidence inputs. | `lib/rag/metadata.ts`, `lib/rag/types.ts` |

## Platform And Cross-Cutting Features

| Feature | Description | Primary anchors |
|---|---|---|
| User-facing error normalization | Converts technical errors into actionable UI messages. | `lib/errors/user-facing.ts` |
| Redux state management | Manages app, profile, application, notifications, identity, extraction, benefit, and collaboration state. | `lib/redux/*` |
| Reusable UI system | Provides common components for forms, cards, dialogs, alerts, buttons, navigation, and feedback. | `components/ui/*`, `components/shared/*` |
| Theming | Supports theme provider and toggle. | `components/theme-provider.tsx`, `components/shared/ThemeToggle.tsx` |
| Formatting and input utilities | Provides formatting, address parsing, date-of-birth validation, SSN/phone/currency helpers, and random IDs. | `lib/utils/*`, `components/shared/CurrencyInput.tsx` |
| Server logging | Serializes and logs server errors with safe truncation. | `lib/server/logger.ts` |
| Supabase integration | Client, server, storage, and authenticated fetch helpers. | `lib/supabase/*` |
| Email notifications | Email templates and notification service primitives. | `lib/notifications/email-templates.tsx`, `lib/notifications/service.ts`, `lib/resend.ts` |

## Explicit Product Boundaries

| Boundary | Current position |
|---|---|
| Official eligibility determination | The app provides likely eligibility and guidance. It does not replace official MassHealth determinations. |
| Legal representation | Appeal features provide drafting and educational support, not legal representation. |
| Automated final reviewer decisions | Reviewer workflows support human decisioning; final decisions are not delegated fully to AI. |
| Automated government submission | Current features prepare, validate, generate, and support applications. Fully automated government submission is not a supported current feature. |

## Test Coverage Anchors

| Area | Test anchors |
|---|---|
| MassHealth eligibility and requirements | `lib/masshealth/__tests__/*` |
| Benefit orchestration | `lib/benefit-orchestration/**/__tests__/*`, `components/benefit-orchestration/__tests__/*` |
| Application UI | `components/application/**/__tests__/*`, `hooks/__tests__/*` |
| Appeals | `components/appeals/__tests__/*`, `lib/appeals/__tests__/*`, `app/api/masshealth/appeals/draft/__tests__/*` |
| Agents | `app/api/agents/**/__tests__/*`, `lib/agents/**/__tests__/*` |
| RAG | `lib/rag/__tests__/*` |
| Identity and utilities | `lib/utils/__tests__/*`, identity route/component tests where present |
| Notifications and collaboration | `components/notifications/__tests__/*`, `components/collaborative-sessions/__tests__/*`, `app/api/sessions/**/__tests__/*` |
| Admin and auth | `app/api/admin/__tests__/*`, `lib/auth/__tests__/*` |
