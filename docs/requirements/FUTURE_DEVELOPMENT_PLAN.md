# Future Development Plan

**Status:** Generated from current codebase  
**Baseline date:** 2026-04-15  

## 1. Planning Assumptions

- The app should remain a modular monolith for the next several phases.
- Eligibility and benefit decisions must remain deterministic and test-backed.
- LLMs should be provider-portable behind agent/tool boundaries.
- Cloud Supabase is the production data plane; local Supabase remains the development/test plane.
- The most important production risks are privacy, AI reliability, route authorization, document workflows, and operational visibility.

## 2. Phase 0: Stabilize Current Agent and Requirements Baseline

| ID | Item | Outcome |
|---|---|---|
| PLAN-000 | Keep the new requirements package current. | Product, functional, AI, API, data/security, NFR, roadmap, and traceability docs live under `docs/requirements/`. |
| PLAN-001 | Finish source-level review of modified agent code. | Memory, reflection, and RAG metadata changes are reviewed as one agent reliability package. |
| PLAN-002 | Verify cloud Supabase migrations. | `user_agent_memory` and RAG source metadata columns are validated in cloud. |
| PLAN-003 | Add CI gate for typecheck if not already enforced. | `pnpm exec tsc --noEmit` runs in CI alongside lint and tests. |

## 3. Phase 1: Production Hardening

| ID | Item | Scope | Acceptance |
|---|---|---|---|
| PLAN-010 | Route authorization audit | Review all `app/api/**` routes for auth and ownership checks. | Every protected route has explicit auth tests. |
| PLAN-011 | Sensitive logging redaction | Add shared redaction helpers for logs, telemetry, and AI traces. | No raw documents, barcode data, service keys, or full sensitive prompts in logs. |
| PLAN-012 | Agent trace schema | Persist redacted trace metadata for model calls, tool calls, RAG quality, reflection, and latency. | Agent eval dashboard can be built from traces. |
| PLAN-013 | RAG source rendering | Surface source tier, scores, and citation coverage in the UI. | User can see sources behind policy-grounded answers. |
| PLAN-014 | Document workflow hardening | Centralize file validation, ownership checks, extraction timeouts, and storage paths. | Upload/extract routes share one validation boundary. |
| PLAN-015 | Observability activation | Configure OpenTelemetry/OpenObserve for production. | Dashboards for API error rate, model health, DB health, and ingestion failures. |
| PLAN-016 | Backup and restore drill | Validate Supabase backup/restore and storage recovery. | RPO/RTO targets documented and tested. |

## 4. Phase 2: Product Workflow Completion

| ID | Item | Scope | Acceptance |
|---|---|---|---|
| PLAN-020 | Unified applicant workspace | Combine application draft, form assistant, checklist, documents, eligibility, and generated PDF status. | Applicant can resume all application tasks from one page. |
| PLAN-021 | Reviewer workbench | Case queue, income evidence review, RFI timeline, decisions, and audit trail. | Reviewer can complete an income verification case without leaving workbench. |
| PLAN-022 | Social-worker collaboration upgrade | Session lifecycle, chat history, patient summary, and application co-navigation. | Social worker can help a patient complete an application end to end. |
| PLAN-023 | Notifications lifecycle | Reminder scheduling, digest emails, and notification preferences. | Users receive document, RFI, session, and status reminders. |
| PLAN-024 | Appeal packet generation | Convert appeal explanation, letter, evidence checklist, and source citations into downloadable packet. | User can download an appeal packet suitable for review. |
| PLAN-025 | Identity verification completion | Add retention policy, mismatch handling, and reviewer/admin visibility for verification status. | Identity verification is auditable and user-friendly. |

## 5. Phase 3: Modular Monolith Refactor

| ID | Item | Scope | Acceptance |
|---|---|---|---|
| PLAN-030 | Feature boundary migration | Move toward feature-first modules for intake, agents, appeals, benefit stack, identity, collaboration, notifications, admin. | New code uses module boundaries instead of broad flat `lib/` imports. |
| PLAN-031 | Thin route handlers | Route handlers delegate validation, orchestration, and persistence to use-case modules. | Route files contain transport concerns only. |
| PLAN-032 | Repository interfaces | DB adapters are hidden behind feature repositories. | Domain/application code does not import raw Supabase clients directly. |
| PLAN-033 | Domain test expansion | Add fixture-heavy tests for deterministic eligibility, benefit orchestration, income verification, and application checks. | Critical decision logic has branch coverage and regression fixtures. |
| PLAN-034 | Legacy endpoint deprecation | Migrate clients from `app/api/chat/masshealth` and legacy appeal routes to canonical agents. | Legacy routes are either removed or marked compatibility-only. |

## 6. Phase 4: AI Evaluation and Governance

| ID | Item | Scope | Acceptance |
|---|---|---|---|
| PLAN-040 | Agent evaluation suite | Add fixtures for chat, benefit advisor, form assistant, appeal, extraction, and vision. | CI can run deterministic agent contract tests without live model dependency. |
| PLAN-041 | Human review sampling | Add admin/reviewer review queue for sampled AI outputs and low-confidence RAG responses. | AI quality can be monitored over time. |
| PLAN-042 | Policy freshness pipeline | Scheduled check for policy source freshness, ingestion drift, and stale chunks. | RAG index freshness is visible and alertable. |
| PLAN-043 | Model/provider abstraction | Make Ollama provider swappable for hosted or specialized models. | Agent code does not depend directly on one provider implementation. |
| PLAN-044 | Memory governance | Add user controls for memory view/delete/reset, retention policy, and memory audit events. | User can manage stored agent memory. |

## 7. Phase 5: Scale and Workflow Automation

| ID | Item | Scope | Acceptance |
|---|---|---|---|
| PLAN-050 | Background jobs | Move ingestion, OCR, large PDF extraction, notifications, and email retries to queue workers. | Request latency is bounded and retryable work is durable. |
| PLAN-051 | Case workflow automation | Add state machines for applications, RFIs, reviews, identity, and appeals. | Status transitions are explicit, auditable, and testable. |
| PLAN-052 | Analytics and reporting | Expand admin analytics to operational, eligibility, document, and AI quality metrics. | Admins can monitor throughput, bottlenecks, and quality. |
| PLAN-053 | Multi-tenant organization hardening | Strengthen org boundaries for companies, social workers, admins, and applicants. | Data access is tenant-scoped across all staff workflows. |

## 8. Backlog by Domain

| Domain | Backlog |
|---|---|
| Application intake | Resume state, save conflict handling, offline draft safeguards, generated PDF preview, submission checklist. |
| Eligibility | Annual FPL update process, policy versioning, fixture suite by household archetype, program-specific explanations. |
| Benefit stack | Prioritization tuning, bundle-level document reuse, estimated value confidence, cross-program conflict warnings. |
| Appeals | Appeal deadline support, packet generation, evidence upload linking, citation rendering, legal-aid referral options. |
| RAG | Hybrid search, reranking, document freshness, source rendering, ingestion audit, confidence dashboards. |
| Agents | Trace schema, eval suite, model abstraction, low-confidence escalation, per-agent latency budgets. |
| Documents | Malware scanning, OCR queue, extraction review UI, storage retention, evidence tagging. |
| Identity | User consent screen, mismatch resolution, retention controls, reviewer visibility. |
| Collaboration | Presence, co-editing safeguards, session recordings policy, social-worker workload views. |
| Admin | Role management, audit viewer, exports, org/company tenant management. |

## 9. Release Gates

| Gate | Requirement |
|---|---|
| Code quality | `pnpm run lint`, `pnpm exec tsc --noEmit`, and `pnpm test` pass. |
| Security | New protected routes have auth/authorization tests and no secret exposure. |
| AI safety | Agent changes include prompt tests, tool tests, fallback tests, and RAG/reflection quality assertions where relevant. |
| Data | New tables have migrations, ownership references, indexes, and retention consideration. |
| Observability | New external integrations expose latency and failure telemetry. |
| Documentation | Requirement docs and traceability matrix are updated for user-facing or data-contract changes. |
