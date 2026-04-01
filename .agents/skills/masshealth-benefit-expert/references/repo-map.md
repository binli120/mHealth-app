# Repo Map

Use this file to route MassHealth work to the smallest relevant slice of the codebase.

## Top-Level Product Areas

### MassHealth Chat And Advisor
- API entry: `app/api/chat/masshealth/route.ts`
- Prompt and domain copy: `lib/masshealth/chat-knowledge.ts`
- Fact extraction: `lib/masshealth/fact-extraction.ts`
- Form extraction: `lib/masshealth/form-field-extraction.ts`
- Household inference: `lib/masshealth/household-relationships.ts`
- Widget UI: `components/chat/masshealth-chat-widget.tsx`
- Constants: `app/api/chat/masshealth/constants.ts`, `lib/masshealth/constants.ts`

### Deterministic Eligibility
- Generic screener: `lib/eligibility-engine.ts`
- ACA-3 rules: `lib/masshealth/aca3-eligibility-engine.ts`
- ACA-3-AP rules: `lib/masshealth/aca3ap-eligibility-engine.ts`
- Application rules and checks: `lib/masshealth/aca3-requirements.ts`, `lib/masshealth/aca3ap-requirements.ts`, `lib/masshealth/application-checks.ts`, `lib/masshealth/application-types.ts`
- Shared domain types/constants: `lib/masshealth/types.ts`, `lib/masshealth/constants.ts`

### Benefit Stack
- Orchestrator: `lib/benefit-orchestration/orchestrator.ts`
- Program evaluators: `lib/benefit-orchestration/programs/*.ts`
- Shared types and FPL helpers: `lib/benefit-orchestration/types.ts`, `lib/benefit-orchestration/fpl-utils.ts`
- Persisted results: `lib/db/benefit-orchestration.ts`
- API routes: `app/api/benefit-orchestration/evaluate/route.ts`, `app/api/benefit-orchestration/profile/route.ts`
- UI: `components/benefit-orchestration/*`, `app/benefit-stack/page.tsx`

### Appeals
- Analyze route: `app/api/appeals/analyze/route.ts`
- Denial-letter extraction route: `app/api/appeals/extract-document/route.ts`
- Prompt contract: `lib/appeals/prompts.ts`
- Constants/types/copy: `lib/appeals/constants.ts`, `lib/appeals/types.ts`, `lib/appeals/copy.ts`
- UI: `components/appeals/*`, `app/appeal-assistant/page.tsx`

### Policy RAG
- Ingest pipeline: `lib/rag/ingest.ts`, `app/api/rag/ingest/route.ts`
- Retrieval: `lib/rag/retrieve.ts`
- Embeddings/constants/types: `lib/rag/embed.ts`, `lib/rag/constants.ts`, `lib/rag/types.ts`
- DB dependencies: `policy_documents`, `policy_chunks`, pgvector search in `lib/rag/retrieve.ts`

### Document Extraction And PDF Mapping
- MassHealth document clients: `lib/masshealth/extract-auto-client.ts`, `lib/masshealth/extract-workflow-client.ts`, `lib/masshealth/ollama-client.ts`
- PDF mapping and payloads: `lib/pdf/masshealth-aca.ts`, `lib/pdf/masshealth-aca-payload.ts`
- Form section definitions: `lib/masshealth/form-sections.ts`

## Data Flow Patterns

### Chat + Advisor Flow
1. `app/api/chat/masshealth/route.ts` validates request and selects a mode.
2. Fact extraction and optional household inference pull structured state from chat history.
3. Deterministic eligibility runs when the minimum facts exist.
4. RAG retrieves policy chunks using a focused query.
5. A mode-specific system prompt is built and sent to Ollama.
6. The API returns user-facing text plus optional structured facts or eligibility summaries.

### Appeals Flow
1. UI posts denial reason, user notes, and optional extracted document text.
2. Route retrieves relevant policy chunks for the denial reason.
3. `buildAppealSystemPrompt` requests strict JSON output.
4. Response is parsed and returned as structured appeal analysis.

### Benefit Stack Flow
1. Family profile is collected in the wizard UI.
2. API evaluates a normalized family profile.
3. `evaluateBenefitStack` computes FPL and runs each program evaluator.
4. Results are ranked, bundled, and optionally persisted.
5. UI renders ranked programs, bundles, and quick wins.

## Fast Routing Heuristics
- A rule threshold, FPL, age, disability, pregnancy, or citizenship question: open the relevant eligibility engine or benefit program module first.
- A prompt, hallucination, JSON parsing, multilingual, or out-of-scope issue: open the route plus prompt-builder files first.
- A policy-grounding or citation-quality issue: open RAG retrieval/ingest plus the consuming route.
- A user-flow or CTA issue: open the page plus the matching component tree and API route together.

## Tests To Touch
- MassHealth rules and helpers: `lib/masshealth/__tests__/*.test.ts`
- RAG: `lib/rag/__tests__/*.test.ts`
- Appeals UI: `components/appeals/__tests__/*.test.tsx`
- Benefit stack UI: `components/benefit-orchestration/__tests__/*.test.tsx`
- PDF mapping: `lib/pdf/__tests__/*.test.ts`
