# AI and Policy Systems

**Status:** Canonical AI/LLM and policy-system documentation  
**Last updated:** 2026-06-06

## AI System Role

AI is used to assist, explain, extract, translate, and draft. It must not be the sole authority for eligibility decisions, benefit determinations, identity verification outcomes, or legal advice. Deterministic TypeScript engines and reviewed database state remain the source of truth for eligibility and workflow state.

## Agent Inventory

| Agent / workflow | Responsibility | Primary files |
|---|---|---|
| MassHealth chat | Policy-grounded conversational assistance and language-aware explanations. | `app/api/chat/masshealth/*`, `components/chat/masshealth-chat-widget.tsx`, `lib/masshealth/chat-knowledge.ts`. |
| Intake agent | Helps users answer ACA-3 intake questions and normalize form data. | `lib/agents/intake/*`, `components/application/aca3/*`. |
| Form assistant | Supports application field completion and clarification. | `lib/agents/form-assistant/*`, `app/api/agents/form-assistant/*`. |
| Benefit advisor | Explains benefit stack results and runs scoped tools. | `lib/agents/benefit-advisor/*`, `app/api/agents/benefit-advisor/*`. |
| Vision/document agent | Extracts structured fields from documents, IDs, and forms. | `app/api/agents/vision/*`, `lib/masshealth/document-analysis-client.ts`, `lib/pdf/*`. |
| Appeals assistant | Categorizes denial issues and drafts appeal support material. | `app/api/masshealth/appeals/*`, `lib/appeals/*`. |
| Reflection quality gate | Reviews generated responses for quality and risk. | `lib/agents/reflection/*`. |
| Policy update monitor | Checks policy changes against benefit/application context and emits notifications. | `lib/masshealth/benefit-policy-updates-client.ts`, `lib/masshealth/benefit-policy-change-notifier.ts`, `app/api/masshealth/benefit-policy-updates/*`. |

## Prompt Design Requirements

All production prompts should explicitly define:

- **Role:** The assistant is a benefits navigation helper, not a government decision maker or attorney.
- **Task:** The concrete output expected: answer, extraction JSON, explanation, checklist, draft, or classification.
- **Inputs:** User state, application facts, source snippets, document text, language preference, and known limitations.
- **Boundaries:** No definitive eligibility guarantee, no legal advice, no unsupported citations, no hidden PHI disclosure.
- **Output schema:** JSON schema or structured text contract where route handlers depend on machine-readable output.
- **Fallback behavior:** What to do when retrieval is weak, inputs are missing, model output is malformed, or service latency is too high.

Prompt template pattern:

```text
System:
You are a MassHealth benefits navigation assistant. Provide practical, plain-language help.
Do not make final eligibility decisions. Do not provide legal advice. Cite provided sources when making policy claims.

Developer:
Use deterministic facts from the application state as authoritative.
If policy context is insufficient, say what information is missing and route to a safe next step.

User/context:
- User question
- Language preference
- Application facts
- Retrieved policy snippets with source metadata
- Tool results

Output:
- Short answer
- Evidence or source references
- Next action
- Confidence / uncertainty note where relevant
```

## Retrieval Strategy

The policy retrieval strategy is RAG over curated MassHealth and benefits content stored in Postgres/pgvector.

### Retrieval Inputs

- User query
- Current page/workflow context
- Application type and relevant benefit programs
- Known household/income/document facts
- Language preference
- Appeal denial category or policy update category when available

### Retrieval Process

1. Normalize query and domain context.
2. Retrieve candidate policy chunks by embedding similarity.
3. Filter by source trust tier, document type, program tag, and recency where metadata exists.
4. Re-rank or trim to the smallest useful context window.
5. Require citation coverage for policy claims.
6. Fall back to deterministic explanation or safe uncertainty when retrieval confidence is weak.

### Retrieval Metadata Contract

| Field | Purpose |
|---|---|
| `source_url` | Human-readable policy source. |
| `title` | Source document title. |
| `trust_tier` | Relative reliability of source. |
| `program_tags` | MassHealth/benefit programs covered. |
| `issue_categories` | Appeal or policy-change categories. |
| `chunk_index` | Source traceability. |
| `score` | Retrieval similarity or rank score. |

## Deterministic vs LLM Boundaries

| Area | Deterministic owner | LLM role |
|---|---|---|
| Eligibility and benefit stack | `lib/benefit-orchestration/*`, `lib/masshealth/*eligibility*` | Explain result and ask clarifying questions. |
| Health Safety Net | Pure evaluator / benefit engine | Plain-language explanation and chat support. |
| Insurance history | Rules diff engine | Fallback narrative when multiple factors changed. |
| Income verification | Evidence rules and reviewer decision tables | Extract document fields and summarize evidence. |
| Identity verification | AAMVA parsing and score/rule logic | Extract/normalize document fields only. |
| Appeals | Denial category rules and source-backed checklists | Draft support material with explicit legal boundaries. |
| Policy updates | Policy monitor result + dedupe hash | Summarize policy change and evidence snippets. |

## Document and Extraction Workflows

Extraction prompts must:

- Return strict JSON where route handlers require structured output.
- Include confidence and missing-field markers.
- Preserve uncertainty instead of inventing values.
- Avoid retaining raw PHI in logs or telemetry.
- Keep user confirmation before saving high-impact extracted facts.

Required extraction fields:

| Workflow | Required safeguards |
|---|---|
| Driver license | Parse AAMVA/visual fields, flag expiration, hash sensitive identifiers where needed. |
| Paystubs/income | Extract issuer, person, employer, date range, gross/net amount, frequency, confidence, review reasons. |
| Insurance notices | Extract coverage year/effective date, plan name, premium, source, and confidence. |
| ACA-3 PDFs | Map fields to known form schema and preserve unmapped/ambiguous fields for review. |

## Evaluation Metrics

| Metric | Target / interpretation |
|---|---|
| Retrieval citation coverage | Policy claims should have source-backed context. |
| Hallucination rate | Zero tolerance for unsupported eligibility/legal claims in reviewed samples. |
| JSON validity | Extraction routes should produce parseable schema-conformant JSON. |
| Field extraction precision/recall | Track per document type; prioritize SSN/income/date correctness. |
| Deterministic parity | AI explanations must not contradict deterministic engines. |
| Latency p95 | Keep chat/explanation UX responsive; use fallback for slow providers. |
| Cost per successful workflow | Monitor model choice, context size, retries, and cache hit rate. |
| Human override rate | Reviewer corrections identify weak extraction/policy areas. |
| Language quality | Multilingual glossary/chat responses should preserve meaning and avoid policy drift. |

## Reliability and Fallbacks

| Failure mode | Required behavior |
|---|---|
| LLM provider unavailable | Use local fallback where configured or deterministic explanation. |
| Retrieval returns low-confidence context | Ask clarifying question or provide general non-binding guidance. |
| Model emits invalid JSON | Retry once with repair prompt, then fail closed with user-visible error. |
| Extraction confidence low | Mark for manual review and do not auto-save high-impact fields. |
| Translation unavailable | Fall back to English definition and label missing translation. |
| Policy monitor unavailable | Defer notification and preserve prior state; do not emit speculative alert. |

## Latency and Cost Controls

- Cache glossary index and translated definitions.
- Keep RAG context small and source-ranked.
- Use deterministic templates for common insurance-history explanations.
- Prefer route-level timeouts and explicit retries over unbounded model calls.
- Log provider, model, latency, token usage where safe and available.
- Avoid sending full documents to expensive models when chunked extraction or OCR pre-processing is enough.

## Policy Update Notifications

Policy update notifications should:

- Derive benefit names from submitted applications and saved wizard state.
- Query the MassHealth analysis service first, then local monitor fallback if configured.
- Deduplicate findings by content hash.
- Include benefit tags, evidence snippets, source URLs, effective dates, and application context.
- Create in-app notifications only for user-relevant findings.
- Avoid silently changing eligibility or benefit status.

## Governance Rules

- Any new AI route must document prompt design, retrieval strategy, evaluation metrics, fallback behavior, and PHI handling.
- Any AI result that affects benefits, documents, identity, income, or appeals must be reviewable and traceable.
- Any model/vendor processing PHI in production requires security review and BAA status confirmation.
- LLM outputs should be treated as untrusted until validated by schemas, deterministic checks, or user/reviewer confirmation.

