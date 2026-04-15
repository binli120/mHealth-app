# Traceability Matrix

**Status:** Generated from current codebase  
**Baseline date:** 2026-04-15  

## 1. Feature to Implementation Matrix

| Feature area | Requirement IDs | Current files | Test anchors |
|---|---|---|---|
| Authentication and roles | FR-001 to FR-005, API-010 to API-013, DATA-001 to DATA-007 | `app/auth/*`, `app/api/auth/*`, `lib/auth/*` | `lib/auth/__tests__/*`, `app/api/auth/invite/[token]/__tests__/route.test.ts` |
| Applicant profile | FR-010 to FR-012 | `app/customer/profile/page.tsx`, `components/user-profile/*`, `lib/db/user-profile.ts`, `lib/user-profile/*` | `lib/user-profile/__tests__/*` |
| Prescreener and eligibility | FR-020 to FR-023 | `app/prescreener/*`, `components/prescreener/*`, `lib/eligibility-engine.ts`, `lib/masshealth/*eligibility-engine.ts` | `app/prescreener/__tests__/*`, `lib/__tests__/eligibility-engine.test.ts`, `lib/masshealth/__tests__/*eligibility*` |
| Application intake | FR-030 to FR-035, API-040 to API-044 | `app/application/**`, `components/application/**`, `app/api/applications/**`, `lib/db/application-drafts.ts`, `lib/masshealth/application-*` | `components/application/**/__tests__/*`, `app/api/applications/**/__tests__/*`, `lib/masshealth/__tests__/application-*` |
| Form assistant | FR-040 to FR-043, AI-010 to AI-027 | `app/api/agents/form-assistant/route.ts`, `lib/agents/form-assistant/*`, `lib/masshealth/form-field-extraction.ts` | `app/api/agents/form-assistant/__tests__/route.test.ts`, `lib/agents/form-assistant/__tests__/*`, `lib/masshealth/__tests__/form-field-extraction.test.ts` |
| Benefit advisor | FR-020 to FR-023, AI-030 to AI-044 | `app/api/agents/benefit-advisor/route.ts`, `lib/agents/benefit-advisor/*`, `lib/agents/memory/*`, `lib/agents/reflection/*`, `lib/eligibility-engine.ts` | `app/api/agents/benefit-advisor/__tests__/route.test.ts`, `lib/agents/benefit-advisor/__tests__/*`, `lib/agents/reflection/__tests__/*` |
| General chat | AI-020 to AI-027, API-021 | `app/api/agents/chat/route.ts`, `lib/agents/chat/*`, `lib/rag/*` | `app/api/agents/chat/__tests__/route.test.ts`, `lib/agents/chat/__tests__/*`, `lib/rag/__tests__/*` |
| Intake agent | FR-035, AI-014 | `app/api/agents/intake/route.ts`, `lib/agents/intake/*`, `lib/masshealth/household-relationships.ts` | `app/api/agents/intake/__tests__/route.test.ts`, `lib/masshealth/__tests__/household-relationships.test.ts` |
| Appeals | FR-060 to FR-063, AI-040 to AI-044, API-060 to API-061 | `app/appeal-assistant/page.tsx`, `app/masshealth-appeals/page.tsx`, `components/appeals/*`, `app/api/agents/appeal/route.ts`, `app/api/appeals/*`, `app/api/masshealth/appeals/*`, `lib/agents/appeal/*`, `lib/appeals/*` | `app/api/agents/appeal/__tests__/route.test.ts`, `app/api/masshealth/appeals/draft/__tests__/route.test.ts`, `components/appeals/__tests__/*`, `lib/appeals/__tests__/*` |
| Vision and PDF extraction | FR-070 to FR-072, API-050 to API-053 | `app/api/agents/vision/route.ts`, `app/api/pdf/extract/route.ts`, `lib/pdf/*`, `lib/masshealth/extract-*` | `app/api/agents/vision/__tests__/route.test.ts`, `app/api/pdf/extract/__tests__/route.test.ts`, `lib/pdf/__tests__/*`, `lib/masshealth/__tests__/extract-*` |
| Benefit orchestration | FR-050 to FR-053, API-070 to API-072 | `app/benefit-stack/page.tsx`, `components/benefit-orchestration/*`, `app/api/benefit-orchestration/*`, `lib/benefit-orchestration/*`, `lib/db/benefit-orchestration.ts` | `components/benefit-orchestration/__tests__/*`, `lib/benefit-orchestration/__tests__/*` |
| Identity verification | FR-073 to FR-074, API-080 to API-083 | `app/api/identity/*`, `components/identity/*`, `lib/identity/*`, `lib/db/identity-verification.ts`, `lib/db/mobile-verify-session.ts` | `lib/utils/__tests__/aamva.test.ts` and future route tests |
| Collaboration and messaging | FR-080 to FR-083, API-090 to API-094 | `app/api/social-worker/**`, `app/api/patient/**`, `app/api/messages/**`, `app/api/sessions/**`, `components/collaborative-sessions/*`, `components/chat/sw-*`, `lib/collaborative-sessions/*`, `lib/db/sw-messaging.ts` | `app/api/sessions/**/__tests__/*`, `components/collaborative-sessions/__tests__/*` |
| Notifications | FR-083, API-110 to API-111 | `app/api/notifications/**`, `components/notifications/*`, `lib/notifications/*`, `lib/db/notifications.ts` | `app/api/notifications/__tests__/routes.test.ts`, `components/notifications/__tests__/*`, `lib/notifications/__tests__/*` |
| Admin | FR-090 to FR-092, API-120 to API-122 | `app/admin/**`, `app/api/admin/**`, `lib/db/admin.ts`, `lib/db/admin-analytics.ts` | `app/api/admin/__tests__/*`, `app/api/admin/users/__tests__/invite.test.ts` |
| RAG | AI-020 to AI-027, API-130 to API-132 | `app/api/rag/ingest/route.ts`, `lib/rag/*`, `database/rag_schema.sql` | `lib/rag/__tests__/*` |

## 2. Data Traceability

| Table or schema | Requirement IDs | Current migration files |
|---|---|---|
| Core applications and review | DATA-020 to DATA-045 | `database/mHealth_schema.sql`, `database/mHealth_schema_update.sql` |
| User profile | DATA-010 to DATA-012 | `database/user_profile_schema.sql` |
| RAG | AI-020 to AI-027, DATA-044 | `database/rag_schema.sql` |
| Agent memory | AI-030 to AI-035, DATA-013, DATA-034 | `database/migrations/add_user_agent_memory.sql` |
| Benefit orchestration | FR-050 to FR-053 | `database/benefit_orchestration_schema.sql` |
| Identity | FR-073 to FR-074, DATA-030 to DATA-032 | `database/identity_verification_schema.sql`, `database/migrations/add_mobile_verify_sessions.sql`, `database/migrations/add_mobile_session_extracted_data.sql` |
| Notifications | FR-083 | `database/notifications_schema.sql` |
| Social workers and messaging | FR-080 to FR-082 | `database/social_worker_schema.sql`, `database/sw_messaging_schema.sql`, `database/collaborative_session_schema.sql` |
| Invitations | API-011, DATA-033 | `database/invitations_schema.sql` |
| Chat logs | DATA-022 to DATA-035 | `database/chat_logs_schema.sql` |

## 3. Future Plan Traceability

| Plan ID | Related requirements | Primary implementation targets |
|---|---|---|
| PLAN-010 | DATA-001 to DATA-007, API-001 to API-006 | `app/api/**`, `lib/auth/**` |
| PLAN-011 | DATA-015, NFR-030 to NFR-034 | `lib/server/logger.ts`, future redaction utilities |
| PLAN-012 | AI-EVAL-001 to AI-EVAL-008, NFR-031 | `lib/agents/**`, future trace tables |
| PLAN-013 | AI-027 | `components/chat/*`, `components/application/aca3/application-assistant.tsx`, appeal UI |
| PLAN-014 | FR-070 to FR-074, API-044, DATA-050 to DATA-054 | document and identity route families |
| PLAN-020 | FR-030 to FR-043 | `app/application/**`, `components/application/**`, agent routes |
| PLAN-021 | FR-072, API-064 | `app/reviewer/**`, reviewer income verification APIs |
| PLAN-022 | FR-080 to FR-083 | social-worker, messages, sessions modules |
| PLAN-024 | FR-060 to FR-063 | appeals routes, PDF generation, evidence checklist |
| PLAN-030 | NFR-050 to NFR-055 | future `modules/*` or `lib/modules/*` |
| PLAN-040 | AI-EVAL-001 to AI-EVAL-008 | future eval fixtures and agent trace schema |
| PLAN-050 | NFR-020 to NFR-024 | future queue/worker infrastructure |

## 4. Coverage Gaps to Prioritize

| Gap | Requirement IDs | Priority |
|---|---|---|
| Full auth/ownership test audit for all protected routes. | DATA-001 to DATA-007, API-001 to API-006 | P0 |
| Agent eval suite with fixture-based scoring. | AI-EVAL-001 to AI-EVAL-008 | P0 |
| RAG metadata rendering in UI, not only tool annotations. | AI-027, PLAN-013 | P1 |
| Identity route tests and retention behavior. | FR-073, API-080 to API-083, DATA-032 | P1 |
| Document upload/extraction shared validation boundary. | FR-070 to FR-072, DATA-050 to DATA-054 | P1 |
| Reviewer workbench tests for RFI/decision lifecycle. | FR-072, API-064, PLAN-021 | P1 |
| Legacy endpoint migration or explicit compatibility designation. | API-006, NFR-054, PLAN-034 | P2 |
