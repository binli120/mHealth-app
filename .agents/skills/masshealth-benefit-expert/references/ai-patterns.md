# AI Patterns

Use this file when the task touches prompts, retrieval, extraction, or AI reliability.

## Prompt Design

### Core Pattern
- Keep the system prompt role-specific and mode-specific.
- Give the model only the minimum structured context needed for the decision.
- Define a strict output contract when code parses the result.
- Add out-of-scope behavior explicitly for MassHealth-only experiences.

### Recommended Prompt Shapes In This Repo
- Chat or advisor:
  - role,
  - language requirement,
  - concise policy-backed guidance,
  - follow-up question behavior when required facts are missing,
  - optional eligibility summary or retrieved policy snippets.
- Structured extraction:
  - extractor-only role,
  - JSON schema in prompt,
  - omit unknown fields instead of inventing null-like output,
  - examples for conversions such as monthly to annual income.
- Appeals:
  - denial reason + applicant facts + retrieved policy excerpts,
  - explicit JSON schema,
  - no prose outside JSON.

### Anti-Patterns
- Do not embed threshold logic in prompts when code already owns it.
- Do not overload one prompt with intake, advisor, appeals, and general FAQ behavior.
- Do not require the model to infer missing facts silently when the product should ask follow-up questions.

## Retrieval Strategy

### When To Use RAG
- Use RAG for policy explanation, appeal support, covered services questions, and any answer that should reflect MassHealth policy language.
- Skip RAG for purely deterministic rule computation already represented in code.

### Query Construction
- Build focused queries from the active task:
  - denial reason for appeals,
  - top candidate program names for benefit advisor mode,
  - current form section for form assistance,
  - the last user question for general QA.
- Avoid passing the full transcript as the retrieval query.

### Retrieval Boundaries
- Keep `topK` small unless the prompt can truly use more context.
- Trim chunks before prompt insertion to control latency and token cost.
- Preserve graceful fallback to empty retrieval results.

## Evaluation Metrics

### Functional
- JSON parse success rate.
- Eligibility agreement against deterministic test fixtures.
- Benefit recommendation precision for known household profiles.
- Appeal output completeness: explanation, letter, checklist all present.
- Out-of-scope rejection accuracy for non-MassHealth questions.

### Retrieval
- Citation usefulness rate: retrieved chunks materially support the response.
- Retrieval hit rate on golden questions.
- Average chunk relevance score and duplicate-chunk rate.

### Product And Reliability
- P50 and P95 latency by mode.
- Ollama failure rate and timeout rate.
- Empty-RAG fallback success rate.
- Multilingual response correctness for supported languages.

### Cost And Throughput
- Tokens or prompt size by mode.
- Embedding volume per ingest run.
- Average retrieved context length.

## Preferred Architecture

### Split Deterministic And Generative Responsibilities
- Deterministic layer:
  - eligibility thresholds,
  - program routing,
  - FPL math,
  - validation,
  - ranking.
- Generative layer:
  - explanation,
  - extraction,
  - summarization,
  - appeal drafting,
  - conversational follow-up.

### Production-Ready Safeguards
- Validate request bodies with Zod before model calls.
- Parse model output defensively and reject malformed responses.
- Log server failures with route context.
- Add unit tests for prompt-parsing helpers and rule changes.

## Change Checklist
- Define the prompt contract.
- Define the retrieval input and top-K policy.
- Define fallback behavior when model or RAG fails.
- Define tests or eval fixtures.
- Define latency and parse success targets if the change affects a hot path.
