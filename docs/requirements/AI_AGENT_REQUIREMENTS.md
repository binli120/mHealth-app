# AI Agent Requirements

**Status:** Generated from current codebase  
**Baseline date:** 2026-04-15  
**Primary anchors:** `app/api/agents/**`, `lib/agents/**`, `lib/masshealth/**`, `lib/rag/**`, `docs/AI_AGENT_ARCHITECTURE_OVERVIEW.md`

## 1. Agent Inventory

| Agent | Purpose | API boundary | Core tools or modules |
|---|---|---|---|
| Supervisor | Route general messages to the right specialist. | `POST /api/agents` | `generateText`, strict intent schema |
| Chat | General MassHealth Q&A. | `POST /api/agents/chat` | `retrieve_policy`, RAG |
| Benefit Advisor | Likely eligibility explanation. | `POST /api/agents/benefit-advisor` | fact extraction, eligibility engine, RAG, memory, reflection |
| Form Assistant | Application section guidance and field extraction. | `POST /api/agents/form-assistant` | field extraction, RAG |
| Intake | One-question-at-a-time interview. | `POST /api/agents/intake` | relationship hints |
| Appeal | Appeal explanation, letter, evidence checklist. | `POST /api/agents/appeal` | RAG, reflection |
| Vision | Document and image extraction. | `POST /api/agents/vision` | PDF extraction, vision model |
| Fact Extractor | JSON eligibility fact extraction. | internal | `lib/masshealth/fact-extraction.ts` |
| Form Field Extractor | JSON form field extraction. | internal | `lib/masshealth/form-field-extraction.ts` |
| Reflection Quality Gate | Review generated appeal and eligibility text. | internal | `lib/agents/reflection/quality-gate.ts` |

## 2. Agent Design Principles

| ID | Requirement |
|---|---|
| AI-001 | Agents shall use deterministic engines for eligibility, FPL, program recommendations, and application checks. |
| AI-002 | Agents shall use LLMs for extraction, conversation, translation, summarization, drafting, and reflection only. |
| AI-003 | Agents shall expose structured UI annotations for machine-readable state changes. |
| AI-004 | Agents shall bound tool loops with explicit step limits. |
| AI-005 | Agents shall validate tool input and output with Zod or equivalent schema controls. |
| AI-006 | Agents shall fail softly when Ollama, RAG, memory, or reflection is unavailable. |
| AI-007 | Agents shall not present model-only policy claims as authoritative MassHealth determinations. |

## 3. Prompt Design Requirements

| ID | Requirement |
|---|---|
| AI-010 | System prompts shall define the agent role, permitted tool sequence, safety constraints, language behavior, and final-answer rules. |
| AI-011 | Benefit advisor prompts shall require `extract_eligibility_facts` before `check_eligibility`, `retrieve_policy` before final explanation, and `finish_eligibility_explanation` before final user-facing commitment. |
| AI-012 | Appeal prompts shall require policy retrieval before final appeal material and shall prohibit invented regulations. |
| AI-013 | Form assistant prompts shall distinguish extraction tasks from policy guidance and shall exclude SSN extraction. |
| AI-014 | Intake prompts shall keep the conversation to one question at a time and avoid asking again for household relationships already inferred. |
| AI-015 | Prompts shall support multilingual behavior where the route accepts `language`. |
| AI-016 | Prompt tests shall assert tool names, safety constraints, reflection instructions, and core workflow ordering. |

## 4. Retrieval Strategy Requirements

| ID | Requirement |
|---|---|
| AI-020 | RAG-enabled agents shall use task-specific retrieval queries, not the full transcript by default. |
| AI-021 | Chat shall retrieve policy when the user asks about eligibility rules, benefits, documents, application procedures, or appeal rights. |
| AI-022 | Benefit advisor shall retrieve policy from top program names and relevant eligibility topics returned by deterministic eligibility checks. |
| AI-023 | Form assistant shall retrieve policy only for section-specific policy or document questions. |
| AI-024 | Appeal shall retrieve policy from denial reason, program name, appeal procedures, and evidence needs. |
| AI-025 | RAG retrieval shall cap `topK` through tool schema limits to protect latency and prompt size. |
| AI-026 | RAG failures shall return empty context with a usable fallback response instead of failing the whole route. |
| AI-027 | RAG-enabled tool results and annotations shall expose `confidence`, `maxScore`, `averageScore`, chunk scores, source tiers, source URLs, source types, and citation coverage. |

## 5. RAG Quality Metadata Contract

| Field | Requirement |
|---|---|
| `query` | Original retrieval query. |
| `requestedTopK` | Requested retrieval limit after defaults. |
| `returnedChunkCount` | Number of policy chunks returned. |
| `confidence` | One of `none`, `low`, `medium`, `high`. |
| `maxScore` | Highest normalized chunk score or `null`. |
| `averageScore` | Average normalized chunk score or `null`. |
| `citationCoverage.citedChunkCount` | Number of chunks with title or URL citation metadata. |
| `citationCoverage.coverageRatio` | Cited chunk count divided by returned chunk count. |
| `citationCoverage.hasCitations` | Whether any citation metadata is available. |
| `sources[]` | Chunk id, document id, chunk index, title, URL, source type, source tier, and score. |

Source tier rules:

- `official`: `mass.gov`, `cms.gov`, or MassHealth-titled source.
- `legal_aid`: legal aid source or title.
- `community`: URL exists but is not official or legal aid.
- `unknown`: no reliable URL.

## 6. Memory Requirements

| ID | Requirement |
|---|---|
| AI-030 | Agent memory shall persist non-sensitive extracted facts in `user_agent_memory`. |
| AI-031 | Benefit advisor shall load memory before prompting and before deterministic sufficiency checks. |
| AI-032 | Newly extracted facts shall merge with known memory facts without requiring the model to restate them. |
| AI-033 | Memory writes shall be asynchronous and shall not block streaming responses. |
| AI-034 | Memory must not be the sole source for sensitive or stale official eligibility decisions. |
| AI-035 | Future memory expansion shall add retention, user control, redaction, and audit events. |

## 7. Reflection Quality Gate Requirements

| ID | Requirement |
|---|---|
| AI-040 | Appeal letters shall be reviewed for factual accuracy, layperson clarity, specific evidence, and completeness before final output. |
| AI-041 | Eligibility explanations shall be reviewed against deterministic eligibility context and retrieved policy context before final output. |
| AI-042 | Reflection output shall be schema-constrained and test-covered. |
| AI-043 | If reflection fails, the system shall return the original generated text with fallback metadata rather than blocking the workflow. |
| AI-044 | Reflection review results shall be emitted as structured annotations where the agent stream supports them. |

## 8. Evaluation Metrics

| ID | Metric | Target |
|---|---|---|
| AI-EVAL-001 | Eligibility agreement | 100 percent agreement with deterministic fixture expectations. |
| AI-EVAL-002 | Fact extraction accuracy | Track precision/recall for age, household size, income, residence, pregnancy, disability, Medicare, employer insurance, and citizenship. |
| AI-EVAL-003 | Form extraction accuracy | Track field-level exact match and duplicate suppression. |
| AI-EVAL-004 | RAG retrieval quality | Track top-k hit rate, average score, citation coverage, source-tier mix, and no-result rate. |
| AI-EVAL-005 | Appeal quality | Track reflection issue rate, revised-letter rate, evidence checklist completeness, and policy citation coverage. |
| AI-EVAL-006 | Hallucination risk | Sample generated answers for unsupported thresholds, unsupported deadlines, and uncited policy claims. |
| AI-EVAL-007 | Latency | Track P50/P95 per agent route, per tool call, and per model call. |
| AI-EVAL-008 | Reliability | Track model timeout rate, RAG failure rate, memory failure rate, reflection failure rate, and stream aborts. |

## 9. Future Agent Requirements

| ID | Requirement |
|---|---|
| AI-FUT-001 | Add an agent evaluation dashboard using route traces, RAG metadata, reflection outcomes, and fixture-based scoring. |
| AI-FUT-002 | Add citation rendering in the frontend using RAG source metadata. |
| AI-FUT-003 | Add policy document freshness checks and ingestion audit logs. |
| AI-FUT-004 | Add per-agent cost/latency budgets and circuit breakers. |
| AI-FUT-005 | Add role-sensitive prompt variants for applicant, social worker, reviewer, and admin contexts. |
| AI-FUT-006 | Add a shared agent trace schema for prompts, tools, retrieval metadata, final output, and quality gate result. |
