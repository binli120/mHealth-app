# Data and Security Requirements

**Status:** Generated from current codebase  
**Baseline date:** 2026-04-15  

## 1. Data Domains

| Domain | Tables or storage | Primary owners |
|---|---|---|
| Core application | `organizations`, `users`, `roles`, `user_roles`, `applicants`, `applications`, `household_members`, `incomes`, `assets`, `documents`, `document_pages`, `document_extractions`, `validation_results`, `eligibility_screenings`, `review_actions`, `rfis`, `audit_logs` | Application intake, reviewer workflows |
| User profile | `user_profiles` | Applicant profile |
| Documents | `documents`, Supabase Storage, document route handlers | Application intake, income verification |
| Policy RAG | `policy_documents`, `policy_chunks` | RAG ingestion and retrieval |
| Agent memory | `user_agent_memory` | Benefit advisor and future agents |
| Benefit orchestration | `family_profiles`, `benefit_stack_results` | Benefit stack |
| Identity verification | `identity_verification_attempts`, `mobile_verify_sessions` | Identity workflow |
| Notifications | `notifications` | Notification service |
| Social-worker access | `companies`, `social_worker_profiles`, `patient_social_worker_access`, `sw_engagement_requests`, `sw_direct_messages` | Social worker collaboration |
| Collaborative sessions | `collaborative_sessions`, `session_messages` | Session workflow |
| Invitations | `invitations` | Admin and onboarding |
| Chat logs | `chat_logs` | AI/chat audit and analytics |

## 2. Data Classification

| Classification | Examples | Requirement |
|---|---|---|
| Public | Static page copy, knowledge center articles, policy document titles and public URLs. | Can be served to unauthenticated users where product design allows. |
| Internal | Admin analytics aggregates, route metrics, feature flags. | Requires staff/admin access. |
| PII | Name, address, date of birth, email, phone, household members, immigration/citizenship status. | Requires authentication, scoped authorization, encryption where appropriate, and auditability. |
| Sensitive financial | Income, assets, bank data, tax filing status, benefit amounts. | Requires strict scoped access and encryption/redaction where practical. |
| Identity data | License barcode data, verification attempts, mobile verification tokens. | Requires shortest feasible retention and limited exposure. |
| Health/benefit data | Application status, eligibility screening, disability, pregnancy, Medicare status, benefit results. | Treat as highly sensitive benefit/health-adjacent data. |
| AI traces | Prompts, messages, extracted facts, RAG sources, reflection output. | Must avoid unnecessary sensitive persistence and support redaction. |

## 3. Access Control Requirements

| ID | Requirement |
|---|---|
| DATA-001 | Every protected API route shall require authenticated user context before accessing Supabase data. |
| DATA-002 | Admin routes shall use admin authorization and shall not rely on client-side route hiding. |
| DATA-003 | Social-worker routes shall verify active access grants before returning patient data. |
| DATA-004 | Reviewer routes shall require reviewer/staff authorization before RFI or decision mutation. |
| DATA-005 | Application document routes shall verify ownership or authorized collaborator access for every document id. |
| DATA-006 | Service-role Supabase keys shall only be used server-side and never returned to clients. |
| DATA-007 | Local development auth helper routes shall be disabled in production. |

## 4. Privacy and PII Requirements

| ID | Requirement |
|---|---|
| DATA-010 | The system shall avoid collecting SSN through LLM extraction or general chat. |
| DATA-011 | User profile bank fields shall use encryption support when `PROFILE_ENCRYPTION_KEY` is configured. |
| DATA-012 | Identity barcode raw data shall be parsed and discarded or minimized after verification processing. |
| DATA-013 | Agent memory shall store only facts necessary for user assistance and shall avoid raw transcripts by default. |
| DATA-014 | AI prompts shall avoid including unnecessary documents, unrelated household details, or full historical transcripts when task-specific context is enough. |
| DATA-015 | Logs shall not include full uploaded documents, raw identity payloads, service-role keys, or complete prompt payloads containing PII. |
| DATA-016 | Future releases shall provide user-facing memory controls for view, delete, and reset of agent memory. |

## 5. Audit Requirements

| ID | Requirement |
|---|---|
| DATA-020 | Application status changes, reviewer actions, RFI events, identity verification attempts, and admin actions shall be auditable. |
| DATA-021 | Audit records shall include actor id, action, target resource, timestamp, and relevant non-sensitive metadata. |
| DATA-022 | AI-generated eligibility explanations and appeal letters should record quality metadata without persisting unnecessary raw sensitive prompt content. |
| DATA-023 | Future agent traces shall include tool calls, RAG metadata, reflection status, and model latency for debugging and compliance review. |

## 6. Data Retention Requirements

| ID | Requirement |
|---|---|
| DATA-030 | Application drafts shall be retained while an application remains active or until the user deletes the draft. |
| DATA-031 | Uploaded documents shall be retained according to application/reviewer policy and deletable when no longer needed. |
| DATA-032 | Mobile verification sessions shall expire and shall not remain valid indefinitely. |
| DATA-033 | Invitations shall expire and shall not be reusable after acceptance. |
| DATA-034 | Agent memory shall have a future retention policy with user-controlled deletion. |
| DATA-035 | Chat logs and AI traces shall have retention limits appropriate for debugging and compliance, not indefinite storage by default. |

## 7. Database and Migration Requirements

| ID | Requirement |
|---|---|
| DATA-040 | Schema changes shall be represented as SQL migrations under `database/` or `database/migrations/`. |
| DATA-041 | Migrations shall be idempotent where practical and safe to run in local and cloud Supabase. |
| DATA-042 | New tables shall include primary keys, timestamps, ownership references, and indexes for common access paths. |
| DATA-043 | Sensitive tables shall be designed for row-level ownership even if application-level guards are currently used. |
| DATA-044 | pgvector policy chunks shall preserve source title, URL, document type, content, embedding, and chunk index. |
| DATA-045 | Migration tests or database validation scripts shall cover critical schema assumptions before production deploys. |

## 8. Storage Requirements

| ID | Requirement |
|---|---|
| DATA-050 | Uploaded documents shall use deterministic, ownership-scoped storage paths. |
| DATA-051 | Signed URLs shall be time-limited. |
| DATA-052 | File uploads shall validate size, MIME type, and expected workflow before storage. |
| DATA-053 | Audio uploads for messaging shall preserve transcription status and failure state. |
| DATA-054 | Future malware scanning and content safety checks should be added before documents are used in reviewer or AI workflows. |

## 9. Security Roadmap

| ID | Requirement |
|---|---|
| DATA-FUT-001 | Add a security review checklist for every route touching PII, identity, financial, or document data. |
| DATA-FUT-002 | Add centralized redaction helpers for logs, AI traces, and error telemetry. |
| DATA-FUT-003 | Add RLS policy documentation and automated checks for Supabase tables. |
| DATA-FUT-004 | Add user-facing export/delete flows for profile, memory, and uploaded documents where legally and operationally appropriate. |
| DATA-FUT-005 | Add secrets scanning and production environment validation to CI/CD. |
