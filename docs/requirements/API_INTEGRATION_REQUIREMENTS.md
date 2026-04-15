# API and Integration Requirements

**Status:** Generated from current codebase  
**Baseline date:** 2026-04-15  

## 1. API Boundary Principles

| ID | Requirement |
|---|---|
| API-001 | Route handlers shall validate request bodies and query parameters before invoking domain or infrastructure code. |
| API-002 | Route handlers shall enforce authentication and role authorization before reading or mutating protected resources. |
| API-003 | Route handlers shall return consistent JSON envelopes where practical: `ok`, `data` or domain payload, and `error` on failure. |
| API-004 | Streaming AI routes shall emit text plus structured `data-masshealth` annotations for UI state. |
| API-005 | Node-only routes that use PDF, filesystem-like buffers, native parsers, or server-only SDKs shall declare `runtime = "nodejs"`. |
| API-006 | Compatibility endpoints may remain, but new AI work should prefer `app/api/agents/*` routes. |

## 2. Route Families

| Route family | Purpose | Requirement IDs |
|---|---|---|
| `/api/auth/*` | Dev auth, invite callback, current user. | API-010 to API-019 |
| `/api/agents/*` | Modular AI agent routes. | API-020 to API-029 |
| `/api/chat/masshealth` | Legacy MassHealth chat endpoint. | API-030 |
| `/api/applications/*` | Application creation, documents, drafts. | API-040 to API-049 |
| `/api/forms/*`, `/api/pdf/*` | PDF fill, generate, extract. | API-050 to API-059 |
| `/api/masshealth/*` | Appeals and income verification helpers. | API-060 to API-069 |
| `/api/benefit-orchestration/*` | Family profile and benefit evaluation. | API-070 to API-079 |
| `/api/identity/*` | Mobile verification and license scan. | API-080 to API-089 |
| `/api/social-worker/*`, `/api/patient/*`, `/api/messages/*`, `/api/sessions/*` | Collaboration and messaging. | API-090 to API-109 |
| `/api/notifications/*` | Notification operations. | API-110 to API-119 |
| `/api/admin/*` | Admin management and analytics. | API-120 to API-129 |
| `/api/rag/ingest` | Policy ingestion. | API-130 to API-139 |

## 3. Authentication and Auth API Requirements

| ID | Requirement |
|---|---|
| API-010 | `/api/auth/me` shall return the authenticated user context or an unauthenticated response. |
| API-011 | Invite token endpoints shall validate token existence, expiration, and accepted status before account linking. |
| API-012 | Dev auth endpoints shall be disabled unless local development helpers are explicitly enabled. |
| API-013 | Auth callbacks shall preserve session state and redirect safely. |

## 4. Agent API Requirements

| ID | Requirement |
|---|---|
| API-020 | `/api/agents` shall classify intent and forward to a specialist route without losing request headers. |
| API-021 | `/api/agents/chat` shall validate messages, reject out-of-scope topics, stream responses, and expose RAG metadata when retrieval occurs. |
| API-022 | `/api/agents/benefit-advisor` shall load user memory, stream eligibility annotations, retrieve policy, and emit reflection-reviewed final explanations. |
| API-023 | `/api/agents/form-assistant` shall accept current form context, stream extracted fields, and expose RAG metadata for policy retrieval. |
| API-024 | `/api/agents/intake` shall run one-question-at-a-time intake and emit safe conversational output. |
| API-025 | `/api/agents/appeal` shall accept denial context, retrieve policy, and emit reflection-reviewed appeal material. |
| API-026 | `/api/agents/vision` shall validate document/image inputs and use the configured vision/PDF extraction path. |
| API-027 | Agent routes shall bound model/tool steps to protect latency and prevent infinite tool loops. |
| API-028 | Agent route tests shall cover auth failure, validation failure, out-of-scope handling where applicable, tool annotation behavior, and model failure fallback. |

## 5. Application and Document API Requirements

| ID | Requirement |
|---|---|
| API-040 | `/api/applications` shall create or list application records scoped to the authenticated user. |
| API-041 | `/api/applications/[applicationId]/draft` shall load and persist draft state for the owning user or authorized collaborator. |
| API-042 | `/api/applications/[applicationId]/documents` shall support document listing and upload with ownership checks. |
| API-043 | `/api/applications/[applicationId]/documents/[documentId]` shall support secure document access and mutation by owner or authorized collaborator. |
| API-044 | Document endpoints shall validate file size, content type, and storage path before persistence. |

## 6. PDF and Forms API Requirements

| ID | Requirement |
|---|---|
| API-050 | `/api/forms/aca-3-0325/fill` shall generate a filled ACA-3 PDF from validated structured payloads. |
| API-051 | `/api/pdf/generate` shall return generated PDF bytes with correct content type and download headers. |
| API-052 | `/api/pdf/extract` shall reject missing, empty, oversized, or non-PDF files. |
| API-053 | PDF extraction shall return structured JSON suitable for downstream form mapping. |

## 7. MassHealth Workflow API Requirements

| ID | Requirement |
|---|---|
| API-060 | Appeals category endpoints shall return cacheable category metadata. |
| API-061 | Appeals research and draft endpoints shall retrieve relevant policy and support legacy clients while canonical agents remain preferred. |
| API-062 | Income verification checklist endpoint shall calculate required documents from application and household context. |
| API-063 | Income verification document endpoints shall upload, extract, store, and associate evidence with the correct application. |
| API-064 | Reviewer income verification endpoints shall support RFI and decision workflows with authenticated reviewer access. |

## 8. Benefit Orchestration API Requirements

| ID | Requirement |
|---|---|
| API-070 | Profile endpoints shall persist and retrieve a family profile for the authenticated user. |
| API-071 | Evaluate endpoints shall run deterministic program evaluators and return a benefit stack result. |
| API-072 | Benefit orchestration responses shall include recommendations, required documents, priority, and application bundles. |

## 9. Identity API Requirements

| ID | Requirement |
|---|---|
| API-080 | Mobile verification session endpoints shall create, retrieve, and expire tokenized sessions. |
| API-081 | QR code endpoints shall expose mobile verification URLs without leaking service-role credentials. |
| API-082 | License verification endpoints shall parse AAMVA barcode payloads, validate applicant ownership, and persist verification attempts. |
| API-083 | Identity endpoints shall never expose raw barcode data beyond required processing and audit context. |

## 10. Collaboration and Messaging API Requirements

| ID | Requirement |
|---|---|
| API-090 | Engagement request endpoints shall let patients and social workers request, accept, reject, and revoke access. |
| API-091 | Social-worker patient endpoints shall return only patients with active access grants. |
| API-092 | Message endpoints shall support text, file upload, generated signed URLs, and transcription updates. |
| API-093 | Session endpoints shall create, update, end, and list collaborative sessions with participant-scoped access. |
| API-094 | Voice message endpoints shall store audio, track transcription state, and handle transcription failures. |

## 11. Notifications and Admin API Requirements

| ID | Requirement |
|---|---|
| API-110 | Notification endpoints shall list notifications, return unread counts, mark individual notifications read, and mark all read. |
| API-111 | Notification mutation endpoints shall scope operations to the authenticated user. |
| API-120 | Admin endpoints shall require admin authorization for companies, users, social workers, stats, analytics, invites, and exports. |
| API-121 | Admin invite endpoints shall validate role, email, expiration, and duplicate invite behavior. |
| API-122 | Analytics endpoints shall support aggregate and drill-down views without exposing data to unauthorized roles. |

## 12. External Integration Requirements

| ID | Requirement | Integration |
|---|---|---|
| API-130 | Policy ingestion shall require `RAG_INGEST_SECRET` or equivalent privileged authorization. | Supabase/Postgres, pgvector |
| API-131 | Embedding generation shall use configured Ollama embedding model with timeout and fallback behavior. | Ollama |
| API-132 | Conversational and extraction calls shall use configured Ollama chat/vision models. | Ollama |
| API-133 | Email sends shall use Resend when configured and console/log fallback in local development. | Resend |
| API-134 | Voice transcription shall use configured Whisper binary/model and track failures. | Whisper CLI |
| API-135 | Address validation/geocoding shall use configured external services only when API keys are present. | External geocoding |
| API-136 | Observability exporters shall be optional and fail closed if OpenObserve config is incomplete. | OpenObserve/OpenTelemetry |
