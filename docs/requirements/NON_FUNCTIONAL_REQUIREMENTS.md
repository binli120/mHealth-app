# Non-Functional Requirements

**Status:** Generated from current codebase  
**Baseline date:** 2026-04-15  

## 1. Performance

| ID | Requirement | Target |
|---|---|---|
| NFR-001 | Standard JSON API routes should respond quickly under normal load. | P95 under 800 ms excluding external services. |
| NFR-002 | Streaming agent routes should begin returning output quickly. | First byte P95 under 3 s when Ollama is healthy. |
| NFR-003 | End-to-end AI agent responses should remain bounded. | P95 under 25 s for chat/form/intake, under 45 s for appeal/vision workflows. |
| NFR-004 | RAG retrieval should preserve bounded prompt size. | `topK` capped per tool schema; context should fit within model budget. |
| NFR-005 | PDF extraction/generation should avoid blocking unrelated requests. | Node runtime with bounded file size and timeout controls. |
| NFR-006 | Frontend interactions should avoid layout shift during streaming annotations and field updates. | Stable form, card, and chat layouts. |

## 2. Reliability and Resilience

| ID | Requirement |
|---|---|
| NFR-010 | RAG, memory, reflection, translation, email, and observability failures shall fail softly where they are not core to persistence. |
| NFR-011 | Database write failures for critical user data shall return explicit errors and shall not report success. |
| NFR-012 | Agent tool loops shall be bounded and tested. |
| NFR-013 | Long-running external calls shall have timeout behavior and actionable fallback messages. |
| NFR-014 | Health endpoints shall support application and database readiness checks. |
| NFR-015 | Production deploys shall include rollback instructions and migration ordering. |

## 3. Scalability

| ID | Requirement |
|---|---|
| NFR-020 | The system shall remain a modular monolith until independent scaling pressure justifies service extraction. |
| NFR-021 | AI model calls shall be isolated behind agent/tool modules to allow future provider replacement. |
| NFR-022 | RAG retrieval shall use indexed pgvector search and avoid full document scans in request paths. |
| NFR-023 | Document extraction, OCR, and ingestion should move to queued background jobs when request latency exceeds targets. |
| NFR-024 | Notification and email sends should support retryable background delivery in production. |

## 4. Observability

| ID | Requirement |
|---|---|
| NFR-030 | API routes shall produce structured logs for errors with redacted context. |
| NFR-031 | AI routes shall record model, latency, tool calls, RAG quality metadata, reflection outcome, and failure reason in a redacted trace. |
| NFR-032 | RAG ingestion shall log document count, chunk count, source URLs, embedding failures, and freshness. |
| NFR-033 | Document workflows shall log file size, type, extraction duration, and validation failures without logging raw file content. |
| NFR-034 | OpenTelemetry/OpenObserve integration shall be optional locally and enabled by complete production config. |
| NFR-035 | Alerts shall cover database health, model availability, route error rate, and ingestion failures. |

## 5. Accessibility and Internationalization

| ID | Requirement |
|---|---|
| NFR-040 | Applicant and social-worker workflows shall be keyboard navigable. |
| NFR-041 | Shared UI components shall maintain accessible labels, roles, focus states, and screen-reader behavior. |
| NFR-042 | Chat and agent output shall support configured languages without changing deterministic eligibility logic. |
| NFR-043 | Critical documents and generated content shall use plain language appropriate for lay users. |
| NFR-044 | Color-coded eligibility states shall not rely on color alone. |

## 6. Maintainability

| ID | Requirement |
|---|---|
| NFR-050 | Feature work shall move toward bounded contexts and thin route handlers. |
| NFR-051 | Domain logic shall remain framework-independent where practical. |
| NFR-052 | Prompt templates, retrieval tools, deterministic engines, and DB adapters shall stay separated. |
| NFR-053 | Shared types shall live close to their domain owner and be exported through stable module boundaries. |
| NFR-054 | Legacy endpoints shall be marked, covered by compatibility tests, or migrated to canonical agent routes. |
| NFR-055 | New requirements and architecture docs shall be updated with feature changes. |

## 7. Testability and Quality Gates

| ID | Requirement | Current commands |
|---|---|---|
| NFR-060 | Unit and integration tests shall cover API routes, deterministic engines, agents, and DB adapters. | `pnpm test` |
| NFR-061 | Lint shall pass before merge. | `pnpm run lint` |
| NFR-062 | Type checking shall pass before merge. | `pnpm exec tsc --noEmit` |
| NFR-063 | E2E tests shall cover major applicant, admin, reviewer, social-worker, and appeal flows. | `pnpm test:e2e` |
| NFR-064 | Agent changes shall include tests for tool schema, annotations, fallback behavior, and prompt invariants. | Vitest route/tool tests |
| NFR-065 | Future CI shall enforce coverage thresholds on critical modules even if global coverage remains transitional. | `pnpm test:coverage` |

## 8. Compliance and Safety

| ID | Requirement |
|---|---|
| NFR-070 | The application shall avoid stating that it is making official MassHealth determinations. |
| NFR-071 | Appeal outputs shall avoid legal representation claims. |
| NFR-072 | Sensitive user data shall be minimized in prompts, logs, telemetry, and memory. |
| NFR-073 | User-facing AI outputs shall be traceable to deterministic facts, retrieved policy, or known static content. |
| NFR-074 | Production operations shall include documented incident response for privacy, data corruption, and model outage events. |

## 9. Operational Targets

| ID | Requirement | Target |
|---|---|---|
| NFR-080 | Availability | 99.5 percent initial production target, excluding planned maintenance and external model outages. |
| NFR-081 | RPO | 24 hours until automated managed backups are verified; tighter target after production hardening. |
| NFR-082 | RTO | 4 hours initial target for app restore; 24 hours for non-critical AI ingestion pipelines. |
| NFR-083 | Deployment | CI must run lint, typecheck, unit tests, and smoke health check. |
| NFR-084 | Secrets | Production secrets must be environment-managed and never committed. |
