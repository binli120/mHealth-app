# HealthCompass MA Final Documentation

**Status:** Canonical documentation set  
**Last updated:** 2026-06-06  
**Scope:** Consolidates the project Markdown files into a smaller reader-facing set.

This folder is the recommended entry point for product, engineering, security, QA, and roadmap review. Older feature specs and implementation plans remain in the repository as source notes, but this folder should be treated as the stable documentation surface.

## Canonical Documents

| Document | Purpose |
|---|---|
| [Product and Feature Catalog](./PRODUCT_FEATURE_CATALOG.md) | Current product scope, personas, feature domains, user workflows, and feature ownership. |
| [System Architecture and Data](./SYSTEM_ARCHITECTURE_AND_DATA.md) | Application architecture, API boundaries, data model, Supabase/Postgres schema references, deployment boundaries, and observability. |
| [AI and Policy Systems](./AI_AND_POLICY_SYSTEMS.md) | AI agents, prompt design, retrieval strategy, policy grounding, LLM fallback rules, evaluation metrics, and reliability controls. |
| [Security, Compliance, and Operations](./SECURITY_COMPLIANCE_OPERATIONS.md) | HIPAA posture, PHI handling, authentication, RLS, audit, rate limits, deployment, monitoring, and operational controls. |
| [QA, Roadmap, and Traceability](./QA_ROADMAP_TRACEABILITY.md) | Test strategy, release gates, roadmap phases, traceability map, and historical source-document index. |

## Source Document Categories

| Category | Source files consolidated |
|---|---|
| Product and features | `features/features.md`, `docs/requirements/PRODUCT_REQUIREMENTS.md`, `docs/requirements/FUNCTIONAL_REQUIREMENTS.md`, dated glossary, insurance history, health safety net, and ACA3 notes. |
| Architecture and data | `docs/ARCHITECTURE.md`, `docs/APP_ARCHITECTURE_DIAGRAM.md`, `docs/AI_AGENT_ARCHITECTURE_OVERVIEW.md`, `docs/database/CLOUD_DATABASE_ERD.md`, `supabase/er-diagram.md`, `supabase/README.md`. |
| AI and policy | `docs/AI_AGENT_DESIGN.md`, `docs/requirements/AI_AGENT_REQUIREMENTS.md`, appeal, policy update, RAG, document extraction, and benefit orchestration notes. |
| Security and compliance | `HIPAA_COMPLIANCE.md`, `docs/HIPAA_Technical_Compliance.md`, `docs/REGULATORY_COMPLIANCE_STATUS.md`, `docs/PHI_KEY_ROTATION.md`, `docs/requirements/DATA_SECURITY_REQUIREMENTS.md`, security hardening plan. |
| QA and delivery | `TEST_PLAN.md`, `docs/QA.md`, `docs/qa/*`, `docs/requirements/NON_FUNCTIONAL_REQUIREMENTS.md`, `docs/requirements/FUTURE_DEVELOPMENT_PLAN.md`, `docs/requirements/TRACEABILITY_MATRIX.md`. |

## Maintenance Rules

- Update these canonical files when feature behavior, architecture, API contracts, schema, AI behavior, security controls, or release criteria change.
- Keep dated implementation plans under `docs/superpowers/` as historical records; do not treat them as current source of truth after the final docs are updated.
- For database changes, regenerate schema artifacts with `pnpm run db:schema:generate` and update [System Architecture and Data](./SYSTEM_ARCHITECTURE_AND_DATA.md) if domain ownership or API boundaries changed.
- For AI changes, document prompt design, retrieval strategy, evaluation metrics, cost/latency implications, and fallback behavior in [AI and Policy Systems](./AI_AND_POLICY_SYSTEMS.md).
- For security changes, update risk status, auditability, auth boundaries, data retention, and operational runbooks in [Security, Compliance, and Operations](./SECURITY_COMPLIANCE_OPERATIONS.md).
