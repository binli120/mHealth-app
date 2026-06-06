# QA, Roadmap, and Traceability

**Status:** Canonical QA, roadmap, and source traceability documentation  
**Last updated:** 2026-06-06

## Testing Strategy

HealthCompass MA uses layered testing: deterministic domain unit tests, API route tests, component tests, and Playwright E2E journeys. High-risk workflows require negative-path coverage for auth, PHI, expired tokens, invalid input, and cross-user access.

## Test Layers

| Layer | Scope | Primary commands |
|---|---|---|
| Unit tests | Pure utilities, eligibility engines, auth helpers, AI tool helpers, DB wrappers with mocks. | `pnpm test` |
| API route tests | Route validation, auth behavior, error handling, persistence boundaries. | `pnpm test app/api/...` |
| Component tests | React behavior for UI components, forms, glossary, notifications, dashboards. | `pnpm test components/...` |
| E2E tests | User journeys across auth, prescreener, application, dashboard, reviewer, social worker, admin. | `pnpm run test:e2e` |
| Schema checks | DB connectivity and generated schema docs. | `pnpm run db:check`, `pnpm run db:schema:generate` |

## Core E2E Journeys

| Journey | Coverage |
|---|---|
| Landing and public UX | Landing, privacy, public pages, accessibility regressions. |
| Auth | Register/login/MFA/passkey/session behavior. |
| Prescreener | Eligibility screening and language copy. |
| Benefit stack | Program cards and eligibility explanations. |
| Application | ACA-3 wizard, draft, document upload, PDF/form integration. |
| Profile | User profile, SSN handling, identity flows. |
| Reviewer | Application review, decisions, RFIs, income verification. |
| Social worker | Dashboard, patients, sessions, messages, role boundaries. |
| Admin | Sidebar, reports, users, companies, glossary, MFA/passkeys. |
| Insurance history | Timeline, records, explanations, dashboard card. |

## Release Gates

Before shipping user-facing, data-model, auth, or AI behavior changes:

- Unit tests for changed deterministic logic pass.
- API route tests cover success, unauthorized, malformed input, and failure cases.
- E2E journey is added or updated for major workflow changes.
- RLS/auth ownership behavior is verified for new tables/routes.
- AI changes document prompt design, retrieval strategy, evaluation metrics, and fallback behavior.
- Schema docs are regenerated after database changes.
- Security/compliance checklist passes for PHI/PII surfaces.
- Observability/logging avoids PHI payloads.

## Roadmap Phases

| Phase | Focus | Representative work |
|---|---|---|
| Phase 0 | Stabilize current baseline | Keep requirements, schema docs, and final docs aligned; reduce stale specs. |
| Phase 1 | Production hardening | Security gaps, RLS review, rate limits, observability, incident runbooks, BAA/vendor review. |
| Phase 2 | Workflow completion | Intake polish, insurance history, glossary, income verification, notification UX, reviewer/admin completion. |
| Phase 3 | Modular monolith refactor | Enforce API/domain/DB boundaries, reduce large components, improve shared types. |
| Phase 4 | AI evaluation and governance | Citation coverage, extraction metrics, prompt registry, model fallback policies, reviewer correction loops. |
| Phase 5 | Scale and automation | Performance optimization, workflow automation, policy monitoring, analytics dashboards. |

## Traceability Map

| Feature/domain | Product doc | Architecture/data | AI/policy | Security | QA |
|---|---|---|---|---|---|
| ACA-3 intake | Product catalog | App/API/data flow | Intake/form assistant prompts | PHI draft/encryption | Application E2E + wizard tests |
| Benefit orchestration | Product catalog | Domain engines/data tables | Benefit advisor prompts | Eligibility boundary | Benefit engine unit tests |
| Insurance history | Product catalog | Coverage/explanation tables | Explanation fallback | User ownership/RLS | Insurance history tests |
| Glossary | Product catalog | `glossary_terms` | Translation fallback | Admin auth | Scanner/component/API tests |
| Identity verification | Product catalog | Identity tables/routes | Extraction prompts | Token/privacy controls | Identity route/unit tests |
| Income verification | Product catalog | Income evidence tables | Extraction prompts | Reviewer access/audit | Reviewer/API tests |
| Appeals | Product catalog | Appeal source tables | Drafting/RAG | Legal boundary | Appeal route tests |
| Collaboration | Product catalog | Sessions/messages tables | Transcription support | Access grant/revocation | Social-worker/session E2E |
| Notifications | Product catalog | Notifications tables/routes | Policy update summaries | No PHI email/log leakage | Notification route/component tests |
| Admin/reporting | Product catalog | Admin route families | N/A | MFA/passkey/least privilege | Admin E2E |

## Historical Source Documents

These files remain useful as implementation history but should not override the canonical final docs.

### Product and Requirements Sources

| File | Keep for |
|---|---|
| `features/features.md` | Long-range AI feature strategy and moat ideas. |
| `docs/requirements/PRODUCT_REQUIREMENTS.md` | Product requirements baseline. |
| `docs/requirements/FUNCTIONAL_REQUIREMENTS.md` | Functional requirement IDs. |
| `docs/requirements/API_INTEGRATION_REQUIREMENTS.md` | API contract baseline. |
| `docs/requirements/NON_FUNCTIONAL_REQUIREMENTS.md` | NFR targets. |
| `docs/requirements/FUTURE_DEVELOPMENT_PLAN.md` | Roadmap source. |
| `docs/requirements/TRACEABILITY_MATRIX.md` | Older traceability mapping. |

### Feature Specs and Plans

| File | Consolidated into |
|---|---|
| `docs/superpowers/specs/2026-05-31-insurance-history-timeline-design.md` | Product catalog, architecture/data, AI/policy, QA traceability. |
| `docs/superpowers/plans/2026-05-31-insurance-history-timeline.md` | Product catalog, architecture/data, QA traceability. |
| `docs/superpowers/specs/2026-06-02-glossary-design.md` | Product catalog, AI/policy, QA traceability. |
| `docs/superpowers/plans/2026-06-02-glossary-feature.md` | Product catalog, architecture/data, QA traceability. |
| `docs/superpowers/specs/2026-06-02-health-safety-net-eligibility-design.md` | Product catalog, AI/policy, roadmap. |
| `docs/superpowers/plans/2026-05-29-decompose-aca3-components.md` | Product catalog, architecture/data, roadmap. |
| `docs/superpowers/plans/2026-05-26-security-fixes-h1-h4.md` | Security/compliance, QA release gates. |

### Architecture, AI, and Data Sources

| File | Consolidated into |
|---|---|
| `docs/ARCHITECTURE.md` | System architecture and data. |
| `docs/APP_ARCHITECTURE_DIAGRAM.md` | System architecture and data. |
| `docs/AI_AGENT_DESIGN.md` | AI and policy systems. |
| `docs/AI_AGENT_ARCHITECTURE_OVERVIEW.md` | AI and policy systems, architecture/data. |
| `docs/database/CLOUD_DATABASE_ERD.md` | System architecture and data. |
| `supabase/er-diagram.md` | System architecture and data. |
| `supabase/README.md` | System architecture and data, operations. |

### Security, Compliance, and Operations Sources

| File | Consolidated into |
|---|---|
| `HIPAA_COMPLIANCE.md` | Security/compliance/operations. |
| `docs/HIPAA_Technical_Compliance.md` | Security/compliance/operations. |
| `docs/REGULATORY_COMPLIANCE_STATUS.md` | Security/compliance/operations. |
| `docs/PHI_KEY_ROTATION.md` | Security/compliance/operations. |
| `docs/requirements/DATA_SECURITY_REQUIREMENTS.md` | Security/compliance/operations. |
| `README.md` | Operations, setup, deployment, test accounts. |

### QA Sources

| File | Consolidated into |
|---|---|
| `TEST_PLAN.md` | QA roadmap traceability. |
| `docs/QA.md` | QA roadmap traceability. |
| `docs/qa/COVERAGE_MATRIX.md` | QA roadmap traceability. |
| `docs/qa/E2E_JOURNEYS.md` | QA roadmap traceability. |
| `docs/qa/UAT_TEMPLATE.md` | QA roadmap traceability. |

## Documentation Cleanup Recommendation

After reviewing the final docs, the repository can be simplified further by moving dated source notes into an archive:

```text
docs/archive/requirements/
docs/archive/superpowers/
docs/archive/legacy/
```

Recommended next step:
- Keep canonical final docs in `docs/final/`.
- Keep generated database artifacts where they are.
- Move dated implementation plans/specs to `docs/archive/` once no active PR depends on them.
- Keep `README.md` focused on setup, local development, commands, and deployment only.
