---
name: masshealth-benefit-expert
description: Project-specific MassHealth benefits expert for this codebase. Use when building, reviewing, or debugging MassHealth features in this app, including eligibility rules, ACA-3 or ACA-3-AP flows, benefit-stack orchestration, chat/advisor experiences, appeals, policy RAG, document extraction, multilingual guidance, or any task that needs repo-specific file routing, prompt design, retrieval strategy, or evaluation metrics.
---

# MassHealth Benefit Expert

## Overview
- Ground MassHealth work in this repository's architecture instead of generic Medicaid guidance.
- Prefer deterministic rules for eligibility and application logic; use LLMs for extraction, explanation, summarization, and policy-backed assistance.

## Load Only Needed Context
- Read [references/repo-map.md](references/repo-map.md) first for the relevant feature slice and file map.
- Read [references/ai-patterns.md](references/ai-patterns.md) when the task touches prompts, RAG, extraction, evaluation, or reliability.
- Run `scripts/masshealth_context_lookup.py --topic <topic>` before opening many files. Use `--list` to see supported topics.
- Open only the files for the active track; do not load the full MassHealth surface unless the task truly crosses domains.

## Working Rules
- Keep policy claims source-backed. For user-facing legal or policy explanations, rely on retrieved policy context, official MassHealth links already embedded in the repo, or deterministic rules already implemented in code.
- Treat eligibility thresholds, FPL calculations, routing, and program determination as deterministic logic. Avoid moving them into prompts.
- Use strict machine-readable output contracts for LLM-backed endpoints whenever downstream code parses results.
- Preserve graceful degradation. If Ollama, embeddings, or DB-backed RAG is unavailable, the feature should still fail softly with a usable fallback.
- Separate MassHealth-only work from broader benefit-stack work. The repo includes both.

## Execution Tracks

### Eligibility And Application Logic
- Start with `scripts/masshealth_context_lookup.py --topic eligibility`.
- For single-program screening, inspect `lib/eligibility-engine.ts` and `lib/masshealth/aca3-eligibility-engine.ts` or `lib/masshealth/aca3ap-eligibility-engine.ts`.
- For application-specific supporting logic, inspect `lib/masshealth/application-types.ts`, `lib/masshealth/aca3-requirements.ts`, `lib/masshealth/aca3ap-requirements.ts`, and `lib/masshealth/application-checks.ts`.
- Update or add tests under `lib/masshealth/__tests__/` for every rule change.

### Chat, Intake, And Advisor Flows
- Start with `scripts/masshealth_context_lookup.py --topic chat`.
- Entry point: `app/api/chat/masshealth/route.ts`.
- Prompt builders and domain copy live in `lib/masshealth/chat-knowledge.ts`.
- Structured extraction and household inference live in `lib/masshealth/fact-extraction.ts`, `lib/masshealth/form-field-extraction.ts`, and `lib/masshealth/household-relationships.ts`.
- Keep prompts narrow by mode: intake, form assistant, benefit advisor, or general MassHealth QA.

### Appeals
- Start with `scripts/masshealth_context_lookup.py --topic appeals`.
- API route: `app/api/appeals/analyze/route.ts`.
- Prompt contract: `lib/appeals/prompts.ts`.
- UI and copy: `components/appeals/*`, `app/appeal-assistant/page.tsx`, `lib/appeals/constants.ts`, `lib/appeals/copy.ts`.
- Preserve JSON-only output shape and validate parse success before shipping prompt changes.

### Benefit Stack And Cross-Program Orchestration
- Start with `scripts/masshealth_context_lookup.py --topic benefit-stack`.
- Core engine: `lib/benefit-orchestration/orchestrator.ts`.
- Program modules live in `lib/benefit-orchestration/programs/`.
- UI lives in `components/benefit-orchestration/*` and `app/benefit-stack/page.tsx`.
- Persisted profile and results handling lives in `app/api/benefit-orchestration/*` and `lib/db/benefit-orchestration.ts`.
- Keep MassHealth program logic aligned with bundle logic so recommendations and application paths stay coherent.

### Policy RAG And Document Intelligence
- Start with `scripts/masshealth_context_lookup.py --topic rag` or `--topic documents`.
- RAG ingest and retrieval live in `lib/rag/ingest.ts`, `lib/rag/retrieve.ts`, `lib/rag/embed.ts`, and `app/api/rag/ingest/route.ts`.
- MassHealth document extraction utilities live in `lib/masshealth/extract-auto-client.ts`, `lib/masshealth/extract-workflow-client.ts`, `lib/masshealth/form-field-extraction.ts`, and `lib/pdf/masshealth-aca*.ts`.
- Keep retrieval queries task-specific. Derive them from denial reason, top candidate program, or the current form section rather than from the full user transcript.

## Output Expectations
- For product or architecture work, return:
  - the touched user flow,
  - the API boundary,
  - the deterministic logic boundary,
  - the prompt or retrieval changes,
  - the tests or evals needed.
- For AI changes, specify prompt design, retrieval strategy, and evaluation metrics explicitly.
- For eligibility changes, call out exact thresholds, household assumptions, document requirements, and fallback behavior.

## Non-Negotiable Quality Gates
- Do not present generic Medicaid advice as if it were MassHealth policy.
- Do not rely on a model alone for eligibility decisions that already have deterministic code paths.
- Do not ship prompt changes without checking parse robustness, out-of-scope handling, and multilingual behavior when relevant.
- Do not change retrieval behavior without considering latency, chunk quality, and failure fallback.
- Do not leave rule changes untested in the nearest unit or route tests.
