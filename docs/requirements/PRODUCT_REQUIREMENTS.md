# Product Requirements

**Product:** HealthCompass MA  
**Status:** Current implementation plus future development targets  
**Baseline date:** 2026-04-15  

## 1. Product Vision

HealthCompass MA helps Massachusetts residents, social workers, reviewers, and administrators complete, understand, review, and manage MassHealth and adjacent benefit workflows with policy-grounded AI assistance and deterministic eligibility logic.

The product must reduce application friction without replacing official MassHealth determinations. It should guide applicants, structure information, explain likely eligibility, help with appeals, support social-worker collaboration, and preserve traceability for sensitive decisions.

## 2. Personas

| Persona | Description | Primary goals |
|---|---|---|
| Applicant | Massachusetts resident or household member seeking benefits. | Check likely eligibility, complete applications, upload documents, receive reminders, understand appeal options. |
| Social worker | Staff member supporting applicants. | Manage patient list, collaborate in sessions, message patients, review applications, help resolve missing information. |
| Reviewer | Internal reviewer handling income verification and case follow-up. | Review submitted evidence, issue RFI, record decisions, audit case state. |
| Admin | Organization operator. | Manage users, companies, social workers, analytics, reports, invitations, and platform configuration. |
| AI assistant | System capability surfaced through chat, form, advisor, appeal, and vision flows. | Extract facts, retrieve policy, explain results, draft user-facing text, and self-review before final output. |

## 3. Product Goals

| ID | Goal | Success measure |
|---|---|---|
| PRD-001 | Make MassHealth application intake easier and more accurate. | Applicants can complete ACA-3 intake with structured field capture, validation, draft persistence, and PDF generation. |
| PRD-002 | Provide trustworthy eligibility guidance. | Deterministic eligibility engine returns explainable likely programs; LLM explanations cite retrieved policy where available. |
| PRD-003 | Improve benefit discovery beyond MassHealth. | Benefit stack recommends relevant programs and application bundles from a family profile. |
| PRD-004 | Support appeal preparation. | Users can provide denial context and receive a reflection-reviewed appeal explanation, letter, and evidence checklist. |
| PRD-005 | Enable social-worker collaboration. | Social workers can access authorized patient contexts, schedule sessions, exchange messages, and collaborate. |
| PRD-006 | Preserve security and privacy for sensitive data. | Authentication, role checks, scoped access, auditability, and encryption patterns are maintained for PII and documents. |
| PRD-007 | Make AI behavior observable and evaluable. | Agent outputs include structured annotations, RAG quality metadata, and testable quality gates. |
| PRD-008 | Prepare for production scale. | Requirements include latency, reliability, observability, CI, and phased modularization targets. |

## 4. Current Product Scope

### 4.1 Applicant Experience

Current applicant-facing capabilities include:

- Landing page and authentication.
- Prescreener and eligibility results.
- Application type selection and MassHealth application workflow.
- ACA-3 form wizard and intake chat.
- Application draft persistence.
- Document upload and PDF extraction/generation.
- User profile and applicant profile management.
- Identity verification using license barcode/mobile verification flows.
- Benefit stack evaluation.
- Appeal assistant and MassHealth appeals drafting.
- Notifications.
- Chat widget and AI-assisted MassHealth help.

### 4.2 Social Worker Experience

Current social-worker capabilities include:

- Dashboard, patient list, patient profile access, and patient application access.
- Engagement requests and access grants.
- Direct messages and uploaded voice/audio message flows.
- Collaborative sessions with session messages and screen-sharing UI primitives.
- Social-worker profile management and search.

### 4.3 Reviewer Experience

Current reviewer capabilities include:

- Reviewer dashboard, cases, and audit pages.
- Income verification case lookup.
- RFI and decision routes for reviewer action.
- Income evidence checklist, upload, extraction, recompute, and status workflows.

### 4.4 Admin Experience

Current admin capabilities include:

- Admin dashboard, analytics, reports, companies, users, and social workers.
- User invitation flow.
- Admin stats and export route families.
- Company and social-worker management.

### 4.5 AI Experience

Current AI capabilities include:

- Supervisor intent routing.
- General MassHealth chat.
- Benefit advisor with memory, deterministic eligibility, RAG, and reflection quality gate.
- Form assistant with field extraction and policy help.
- Intake agent with one-question-at-a-time guidance.
- Appeal agent with policy retrieval and reflection quality gate.
- Vision/document extraction agent.
- RAG ingestion/retrieval with confidence metadata.
- Agent memory stored in `user_agent_memory`.

## 5. Out of Scope

| ID | Item | Reason |
|---|---|---|
| PRD-OOS-001 | Official MassHealth eligibility determination. | The product can guide and explain but cannot replace agency decisions. |
| PRD-OOS-002 | Legal representation. | Appeal support is drafting and educational assistance, not attorney-client advice. |
| PRD-OOS-003 | Fully automated application submission to MassHealth. | Current code focuses on preparation, generation, collaboration, and review. |
| PRD-OOS-004 | Automated final reviewer decisions without human review. | Reviewer routes and deterministic checks support human review workflows. |

## 6. Product Acceptance Criteria

| ID | Acceptance criterion |
|---|---|
| PRD-AC-001 | Applicant workflows must never claim a benefit is guaranteed; language must indicate likely eligibility or next steps. |
| PRD-AC-002 | Eligibility and benefit recommendations must come from deterministic engines, not freeform model reasoning. |
| PRD-AC-003 | AI-generated appeal letters and eligibility explanations must pass reflection review before final user-facing commitment. |
| PRD-AC-004 | RAG-enabled agents must expose retrieval confidence metadata, chunk scores, source tiers, and citation coverage where retrieval occurs. |
| PRD-AC-005 | Social-worker access to patient data must require authenticated and authorized access. |
| PRD-AC-006 | Admin routes must require admin-level authorization. |
| PRD-AC-007 | Document upload and extraction must validate file type, size, and ownership before processing. |
| PRD-AC-008 | All critical workflows must have unit tests; high-value applicant journeys should have Playwright coverage. |

## 7. Future Product Outcomes

| ID | Outcome | Target phase |
|---|---|---|
| PRD-FUT-001 | Unified application workspace combining intake, document checklist, AI assistant, eligibility, and PDF generation. | Phase 2 |
| PRD-FUT-002 | Reviewer workbench with end-to-end audit trail, queue management, RFI lifecycle, and case history. | Phase 2 |
| PRD-FUT-003 | Agent evaluation dashboard for RAG confidence, hallucination checks, extraction accuracy, and reflection revisions. | Phase 2 |
| PRD-FUT-004 | Production observability for all external integrations and AI calls. | Phase 1 |
| PRD-FUT-005 | Modular monolith feature boundaries replacing flat `lib/` ownership. | Phase 3 |
