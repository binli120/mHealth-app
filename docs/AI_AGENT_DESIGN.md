# mHealth AI Agent Design Document

**Project:** HealthCompassMA / mHealth  
**Author:** Bin Lee  
**Date:** 2026-04-14  
**Status:** Current State Analysis + Improvement Roadmap

---

## Table of Contents

1. [Overview](#overview)
2. [Agent Inventory](#agent-inventory)
3. [Current Architecture](#current-architecture)
4. [Agent Flow Diagrams](#agent-flow-diagrams)
5. [Design Pattern Assessment](#design-pattern-assessment)
6. [Gap Analysis](#gap-analysis)
7. [Target Architecture](#target-architecture)
8. [Improvement Plan](#improvement-plan)

---

## Overview

The mHealth application contains **10 AI agents** spanning conversational assistance, structured data extraction, eligibility evaluation, appeal letter generation, and document vision processing. All agents run on a locally-hosted **Ollama** LLM (default `llama3.2` / `llava` for vision) with a **pgvector**-backed RAG system for policy document retrieval.

This document audits each agent against standard agentic AI design patterns, illustrates current and target architectures with diagrams, and provides a phased improvement plan.

---

## Agent Inventory

| # | Agent | Entry Point | LLM Used | Category |
|---|-------|-------------|----------|----------|
| 1 | **MassHealth Chat** | `route.ts → handleMassHealthChat()` | llama3.2 | Conversational Q&A |
| 2 | **Benefit Advisor** | `route.ts → handleBenefitAdvisor()` | llama3.2 | Eligibility reasoning |
| 3 | **Form Assistant** | `route.ts → handleFormAssistant()` | llama3.2 | Form guidance |
| 4 | **Application Intake** | `route.ts → handleAssistantOrIntake()` | llama3.2 | Structured interview |
| 5 | **Fact Extractor** | `lib/masshealth/fact-extraction.ts` | llama3.2 | JSON extraction |
| 6 | **Form Field Extractor** | `lib/masshealth/form-field-extraction.ts` | llama3.2 | JSON extraction |
| 7 | **Appeal Analyzer** | `app/api/appeals/analyze/route.ts` | llama3.2 | Letter generation |
| 8 | **Document Vision** | `app/api/appeals/extract-document/route.ts` | llava | OCR / image reading |
| 9 | **Eligibility Engine** | `lib/eligibility-engine.ts` | _(none — deterministic)_ | Rule engine |
| 10 | **Benefit Orchestrator** | `lib/benefit-orchestration/orchestrator.ts` | _(none — deterministic)_ | Multi-program scorer |

### Supporting Infrastructure

| Component | File | Purpose |
|-----------|------|---------|
| RAG Retrieval | `lib/rag/retrieve.ts` | pgvector cosine similarity search |
| RAG Embedding | `lib/rag/embed.ts` | nomic-embed-text via Ollama |
| RAG Ingestion | `lib/rag/ingest.ts` | Policy doc loader |
| Ollama Client | `lib/masshealth/ollama-client.ts` | Shared HTTP client |
| Prompt Builders | `lib/masshealth/chat-knowledge.ts` | System prompt templates (6 languages) |
| Session Store | `app/api/sessions/` | Collaborative social-worker sessions |

---

## Current Architecture

All chat agents are routed through a single monolithic API route. A mode switch dispatches to one of four handler functions. All LLM calls use raw `fetch()` to the Ollama HTTP API with `stream: false`.

```mermaid
graph TD
    User["👤 User / Applicant"]
    SW["👷 Social Worker"]

    subgraph "Next.js API Layer"
        ChatRoute["POST /api/chat/masshealth\n─────────────────────\nZod validation\nLanguage resolution\nMode routing"]
        AppealsRoute["POST /api/appeals/analyze"]
        VisionRoute["POST /api/appeals/extract-document"]
        SessionRoute["POST /api/sessions"]
    end

    subgraph "Mode Dispatcher (if / else switch)"
        BenefitAdvisor["handleBenefitAdvisor()"]
        FormAssistant["handleFormAssistant()"]
        AppIntake["handleAssistantOrIntake()"]
        ChatDefault["handleMassHealthChat()"]
    end

    subgraph "Extraction Agents (sub-LLM calls)"
        FactExtract["extractEligibilityFacts()\nfact-extraction.ts"]
        FormExtract["extractFormFields()\nform-field-extraction.ts"]
    end

    subgraph "Deterministic Engines"
        EligEngine["runEligibilityCheck()\neligibility-engine.ts"]
        BenefitOrch["evaluateBenefitStack()\norchestrator.ts"]
    end

    subgraph "RAG System"
        Retrieve["retrieveRelevantChunks()\nretrieve.ts"]
        Embed["generateEmbedding()\nembed.ts"]
        PGVector[("PostgreSQL\n+ pgvector")]
    end

    subgraph "LLM Backend"
        Ollama["Ollama HTTP API\nllama3.2 ── chat\nllava ──── vision"]
    end

    subgraph "Prompt Layer"
        PromptBuilders["buildXxxSystemPrompt()\nchat-knowledge.ts\n─────────────────\n🌐 EN / ZH / HT / PT / ES / VI"]
    end

    User -->|"HTTP POST + messages"| ChatRoute
    User -->|"denial details"| AppealsRoute
    User -->|"image upload"| VisionRoute
    SW -->|"create session"| SessionRoute

    ChatRoute -->|"mode=benefit_advisor"| BenefitAdvisor
    ChatRoute -->|"mode=form_assistant"| FormAssistant
    ChatRoute -->|"mode=application_intake"| AppIntake
    ChatRoute -->|"default"| ChatDefault

    BenefitAdvisor --> FactExtract
    BenefitAdvisor --> EligEngine
    BenefitAdvisor --> Retrieve
    BenefitAdvisor --> PromptBuilders
    BenefitAdvisor -->|"callOllama() — blocking"| Ollama

    FormAssistant --> FormExtract
    FormAssistant --> Retrieve
    FormAssistant --> PromptBuilders
    FormAssistant -->|"callOllama() — blocking"| Ollama

    AppIntake --> PromptBuilders
    AppIntake -->|"callOllama() — blocking"| Ollama

    ChatDefault --> Retrieve
    ChatDefault --> PromptBuilders
    ChatDefault -->|"callOllama() — blocking"| Ollama

    AppealsRoute --> Retrieve
    AppealsRoute -->|"callOllama() — blocking"| Ollama

    VisionRoute -->|"callOllama() vision — blocking"| Ollama

    FactExtract -->|"callOllama() JSON"| Ollama
    FormExtract -->|"callOllama() JSON"| Ollama

    Retrieve --> PGVector
    Embed --> PGVector

    style ChatRoute fill:#f96,stroke:#c33,color:#fff
    style Ollama fill:#4a9,stroke:#2a7,color:#fff
    style PGVector fill:#69b,stroke:#368,color:#fff
```

> **Notable problem:** The `POST /api/chat/masshealth` route is a single ~400-line file containing four agents. The LLM is only used as a text generator — the orchestration logic lives in TypeScript, not in the model's reasoning.

---

## Agent Flow Diagrams

### Agent 1 — MassHealth Chat (General Q&A)

```mermaid
flowchart TD
    A["User sends message"] --> B{"Is MassHealth topic?"}
    B -->|Yes| C["retrieveRelevantChunks()\nRAG policy lookup"]
    B -->|No| D["Return out-of-scope\nresponse (no LLM call)"]
    C --> E["buildMassHealthSystemPromptWithContext()\ninject RAG context + language"]
    E --> F["callOllama()\nllama3.2 — blocking"]
    F --> G["Return JSON\n{ok, reply}"]
```

---

### Agent 2 — Benefit Advisor

```mermaid
flowchart TD
    A["User sends message\nmode=benefit_advisor"] --> B["extractEligibilityFacts()\nSub-LLM call → JSON"]
    B --> C{"isSufficientForEvaluation?\nage + income + householdSize"}
    C -->|Sufficient| D["runEligibilityCheck()\nDeterministic rule engine"]
    D --> E["RAG query: top 3 programs"]
    C -->|Missing facts| F["RAG query: last user message"]
    E --> G["buildBenefitAdvisorSystemPrompt()\nfacts + eligibility report + RAG"]
    F --> G
    G --> H["callOllama()\nGenerate explanation — blocking"]
    H --> I["Return JSON\n{reply, factsExtracted, eligibilityResults}"]
```

---

### Agent 3 — Form Assistant

```mermaid
flowchart TD
    A["User sends message\nmode=form_assistant"] --> B["Promise.all in parallel"]
    B --> C["extractFormFields()\nSub-LLM call → structured form data"]
    B --> D{"Is MassHealth topic?"}
    D -->|Yes| E["retrieveRelevantChunks()"]
    D -->|No| F["Empty RAG context"]
    C --> G["Merge with existing fields\nDeduplicate household members"]
    E --> H["buildFormAssistantSystemPrompt()\nsection-aware + RAG context"]
    F --> H
    G --> H
    H --> I["callOllama()\nGenerate guidance — blocking"]
    I --> J["Return JSON\n{reply, extractedFields,\nnoHouseholdMembers, noIncome}"]
```

---

### Agent 4 — Application Intake

```mermaid
flowchart TD
    A["User sends message\nmode=application_intake"] --> B["extractHouseholdRelationshipHints()\nRegex-based, no LLM"]
    B --> C["buildMassHealthIntakeSystemPrompt()\nOne-question-at-a-time instructions"]
    C --> D["callOllama()\nConversational interview — blocking"]
    D --> E{"Did LLM ask about\nrelationship already stated?"}
    E -->|Yes| F["sanitizeIntakeReply()\nOverride with known relationship"]
    E -->|No| G["Return reply as-is"]
    F --> H["Return JSON {reply}"]
    G --> H
```

---

### Agent 7 — Appeal Analyzer

```mermaid
flowchart TD
    A["POST /api/appeals/analyze\n{denialReason, programName, denialDate}"] --> B["retrieveRelevantChunks()\nRAG on denial context"]
    B --> C["buildAppealSystemPrompt()\nInject denial details + policy"]
    C --> D["callOllama()\nGenerate appeal — blocking"]
    D --> E["parseJSON()\nStrip markdown fences"]
    E --> F{"Parse successful?"}
    F -->|Yes| G["Return\n{explanation, appealLetter, evidenceChecklist}"]
    F -->|No| H["Return 500 error"]
```

---

### Agent 8 — Document Vision (OCR)

```mermaid
flowchart TD
    A["POST /api/appeals/extract-document\n{imageBase64, mimeType}"] --> B["Validate file size\n< 10MB"]
    B --> C["Build vision prompt\nExtract denial reason, dates,\ncase number, appeal instructions"]
    C --> D["callOllama() — llava vision model\n30s timeout"]
    D --> E["Return {text: extractedContent}"]
```

---

### Agent 9 — Eligibility Engine (Deterministic)

```mermaid
flowchart TD
    A["runEligibilityCheck(ScreenerData)"] --> B["Compute FPL %\nfederalPovertyLevel()"]
    B --> C["Evaluate each program in parallel"]
    C --> D["MassHealth Standard"]
    C --> E["MassHealth CarePlus"]
    C --> F["ConnectorCare"]
    C --> G["SNAP / TAFDC / EAEDC"]
    C --> H["MSP / WIC / LIHEAP"]
    D & E & F & G & H --> I["Filter ineligible"]
    I --> J["Score + rank results\nconfidence × value × urgency × ease"]
    J --> K["Return EligibilityReport\n{fplPercent, results[], summary}"]
```

---

### Agent 10 — Benefit Orchestrator (Deterministic)

```mermaid
flowchart TD
    A["evaluateBenefitStack(FamilyProfile)"] --> B["computeDerivedFields()\nhouseholdSize, children counts"]
    B --> C["computeTotalMonthlyIncome()\nnormalize all income sources"]
    C --> D["Run all 10 evaluators"]
    D --> E["evaluateMassHealth()\nevaluateMSP()\nevaluateSnap()\nevaluateEITC()\nevaluateSection8()"]
    D --> F["evaluateChildcare()\nevaluateLIHEAP()\nevaluateWIC()\nevaluateTAFDC()\nevaluateEAEDC()"]
    E & F --> G["Merge → filter ineligible"]
    G --> H["computeScore()\nconfidence + value + urgency + ease"]
    H --> I["Sort by score → assign priority"]
    I --> J["buildApplicationBundles()\nDTA Bundle / MassHealth Bundle\nPregnancy Bundle"]
    J --> K["Return BenefitStack\n{results[], bundles[], quickWins[], summary}"]
```

---

### RAG System Pipeline

```mermaid
flowchart LR
    subgraph "Ingestion (one-time)"
        Docs["Policy Documents\n.txt / .md files"] --> Chunk["Split into chunks\n~500 token windows"]
        Chunk --> Embed["generateEmbedding()\nnomic-embed-text via Ollama\n768 dimensions"]
        Embed --> Store[("PostgreSQL\n+ pgvector\npolicy_chunks table")]
    end

    subgraph "Retrieval (per request)"
        Query["Agent query string"] --> QEmbed["generateEmbedding()\nsame model"]
        QEmbed --> Search["pgvector cosine similarity\nSELECT ... ORDER BY embedding <=> $1\nLIMIT top-k"]
        Store --> Search
        Search --> Format["formatChunksForPrompt()\nSource + content text"]
        Format --> Inject["Injected into system prompt\nas RAG context"]
    end
```

---

## Design Pattern Assessment

### Standard Agentic AI Patterns Evaluated

| Pattern | Description | Current Status | Score |
|---------|-------------|----------------|-------|
| **Tool Use / Function Calling** | LLM declares and calls typed tools autonomously | Not implemented — TypeScript decides all tool calls, LLM only generates final text | 0 / 5 |
| **ReAct Loop** (Reason → Act → Observe → Repeat) | Agent iterates until task is complete | Not implemented — one HTTP request = one LLM call, no iteration | 1 / 5 |
| **Structured Output** | Schema-enforced JSON generation with validation | Partial — manual JSON parsing with regex fence stripping; no schema enforcement by LLM | 3 / 5 |
| **RAG / Semantic Memory** | Vector retrieval augmenting LLM context | Good — pgvector + nomic-embed-text working well | 4 / 5 |
| **Multi-Agent Orchestration** | Supervisor routes to specialist sub-agents | Partial — mode switch exists but no formal agent boundary or inter-agent calls | 2 / 5 |
| **Streaming** | Token-by-token output to client | Not implemented — `stream: false` throughout; users wait for full completion | 0 / 5 |
| **Reflection / Self-Critique** | Agent evaluates and revises its own output | Not implemented | 0 / 5 |
| **Long-Term Memory** | User facts persist across sessions | Not implemented — stateless per request; facts re-extracted every turn | 1 / 5 |
| **Error Recovery / Retry** | Agent retries or gracefully falls back | Partial — graceful degradation to empty, no intelligent retry | 2 / 5 |
| **Observability** | Per-step traces, token counts, latency | Partial — `logChatRequest()` logs at request level, no step-level spans | 2 / 5 |

**Total Score: 15 / 50**

> The app has **excellent domain logic** — rule engines, RAG, multi-language prompts, fact extraction — but is **architecturally pre-agentic**: the LLM is used purely as a text generator, not as a reasoning engine that self-directs its tool use.

---

## Gap Analysis

### Gap 1 — LLM Does Not Control Tool Calls

**Current behavior:**

```typescript
// route.ts — TypeScript decides everything; LLM only writes final reply
const facts  = await extractEligibilityFacts(payload.messages, language)  // hardcoded
const report = runEligibilityCheck(applyFactDefaults(facts))               // hardcoded
const chunks = await retrieveRelevantChunks(ragQuery, RAG_TOP_K_ADVISOR)   // hardcoded
const reply  = await callOllama({ systemPrompt, messages })                // LLM is last step only
```

**What this means:** No matter what the user says, the same pipeline always runs. The LLM cannot decide to skip eligibility check, ask a clarifying question first, or call a tool the developer didn't anticipate.

**Target behavior:**

```typescript
import { streamText, stepCountIs } from "ai"

const result = streamText({
  model: ollama("llama3.2"),
  tools: { extract_facts, check_eligibility, retrieve_policy, ask_clarification },
  stopWhen: stepCountIs(5),   // LLM can loop: reason → call tool → observe → reason again
})
```

---

### Gap 2 — No Streaming Responses

**Current:** `callOllama({ stream: false })` — user waits 5–15 seconds for a JSON blob.

**Impact:** Poor UX, no perceived progress, mobile users on slow connections time out.

**Target:** `streamText()` → tokens flow to the browser immediately as the model generates them.

---

### Gap 3 — Monolithic Route (One God File)

**Current:** `app/api/chat/masshealth/route.ts` contains 4 agents in one ~400-line file:

```
POST /api/chat/masshealth
  ├── mode=benefit_advisor     → handleBenefitAdvisor()
  ├── mode=form_assistant      → handleFormAssistant()
  ├── mode=application_intake  → handleAssistantOrIntake()
  └── default                  → handleMassHealthChat()
```

**Impact:** Cannot be scaled, tested, or deployed independently. One bug affects all agents.

---

### Gap 4 — No Long-Term Agent Memory

**Current:** Each request re-extracts all facts from scratch. If a user told the system their age and income in turn 2, turn 10 re-extracts it from the full message history again.

**Impact:** Wasted LLM calls, inconsistent fact state, inability to personalize across sessions.

---

### Gap 5 — No Reflection Quality Gate

**Current:** Appeal letters are generated in one shot and returned directly to users with no self-evaluation.

**Impact:** LLM hallucinations in legal/medical documents go uncaught before reaching vulnerable users.

---

## Target Architecture

### High-Level Target

```mermaid
graph TD
    User["👤 User / Applicant"]
    SW["👷 Social Worker"]

    subgraph "Gateway (thin — auth + validation only)"
        API["Next.js API Routes\nZod schema validation\nAuth middleware"]
    end

    subgraph "Supervisor / Router Agent"
        Supervisor["Supervisor Agent\nClassifies user intent\nRoutes to specialist agent"]
    end

    subgraph "Specialist Agents — Vercel AI SDK streamText"
        BA["BenefitAdvisorAgent\n─────────────────\ntools:\n• extract_facts\n• check_eligibility\n• retrieve_policy\n• ask_clarification"]
        FA["FormAssistantAgent\n─────────────────\ntools:\n• extract_form_fields\n• validate_field\n• detect_section\n• retrieve_policy"]
        IA["IntakeAgent\n─────────────────\ntools:\n• extract_intake_data\n• validate_household\n• save_progress"]
        AA["AppealAgent\n─────────────────\ntools:\n• extract_denial_info\n• retrieve_appeal_policy\n• generate_letter\n• reflect_on_letter"]
        VA["VisionAgent\n─────────────────\ntools:\n• extract_from_image\n• parse_denial_letter"]
    end

    subgraph "Tool Implementations"
        T1["extract_facts()\n← fact-extraction.ts"]
        T2["check_eligibility()\n← eligibility-engine.ts"]
        T3["retrieve_policy()\n← rag/retrieve.ts"]
        T4["extract_form_fields()\n← form-field-extraction.ts"]
        T5["save_progress()\n← DB write"]
        T6["reflect_on_letter()\n← generateObject schema check"]
    end

    subgraph "Memory Layers"
        SM["Short-Term Memory\nConversation messages[]"]
        LM["Long-Term Memory\nUser profile — DB\nextracted facts persisted"]
        VM["Semantic Memory\npgvector RAG\npolicy documents"]
    end

    subgraph "LLM Backend"
        AISDK["Vercel AI SDK\nstreamText / generateObject"]
        Ollama["Ollama\nllama3.2 / llava\n(or cloud model)"]
    end

    subgraph "Observability"
        Trace["Step-level traces\ntoken counts\nlatency per tool"]
    end

    User -->|"message"| API
    SW -->|"session"| API
    API --> Supervisor
    Supervisor -->|"intent: benefit"| BA
    Supervisor -->|"intent: form"| FA
    Supervisor -->|"intent: intake"| IA
    Supervisor -->|"intent: appeal"| AA
    Supervisor -->|"intent: document"| VA

    BA --> T1 & T2 & T3
    FA --> T3 & T4
    IA --> T5
    AA --> T3 & T6

    T1 & T2 & T3 & T4 & T5 & T6 --> AISDK
    BA & FA & IA & AA & VA --> AISDK
    AISDK --> Ollama

    BA & FA & IA & AA <--> SM & LM & VM
    AISDK --> Trace

    style Supervisor fill:#e96,stroke:#c44,color:#fff
    style BA fill:#59b,stroke:#279,color:#fff
    style FA fill:#59b,stroke:#279,color:#fff
    style IA fill:#59b,stroke:#279,color:#fff
    style AA fill:#59b,stroke:#279,color:#fff
    style VA fill:#59b,stroke:#279,color:#fff
    style AISDK fill:#7b5,stroke:#4a3,color:#fff
    style Ollama fill:#5ab,stroke:#38a,color:#fff
```

---

### Target ReAct Loop for Benefit Advisor

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant A as BenefitAdvisorAgent
    participant T1 as Tool: extract_facts
    participant T2 as Tool: check_eligibility
    participant T3 as Tool: retrieve_policy
    participant LLM as AI SDK streamText

    U->>A: "I'm 34, family of 4,\nearning $3,000/month in Boston"

    A->>LLM: streamText({ tools, messages, stopWhen: stepCountIs(5) })

    Note over LLM: Step 1 — Reason: I need to extract facts

    LLM-->>A: tool_call: extract_facts(messages)
    A->>T1: execute
    T1-->>A: {age:34, householdSize:4, annualIncome:36000, livesInMA:true}
    A->>LLM: tool_result ✓

    Note over LLM: Step 2 — Reason: Facts sufficient, check eligibility

    LLM-->>A: tool_call: check_eligibility(facts)
    A->>T2: execute
    T2-->>A: EligibilityReport {MassHealth CarePlus: likely, SNAP: likely}
    A->>LLM: tool_result ✓

    Note over LLM: Step 3 — Reason: Retrieve policy for top programs

    LLM-->>A: tool_call: retrieve_policy("MassHealth CarePlus SNAP Boston")
    A->>T3: execute
    T3-->>A: [policy chunks...]
    A->>LLM: tool_result ✓

    Note over LLM: Step 4 — Generate final explanation (streaming)

    LLM-->>U: "Based on your info, you likely qualify for..." ▌ (streaming tokens)
    LLM-->>U: "...MassHealth CarePlus covers your family..." ▌
    LLM-->>U: "...SNAP provides ~$658/month in food benefits..." ▌
```

---

### Memory Architecture (Target)

```mermaid
flowchart TD
    subgraph "Short-Term Memory (per request)"
        Conv["messages[]\nLast 20 turns\nIn-memory"]
    end

    subgraph "Long-Term Memory (cross-session DB)"
        Profile["user_agent_memory table\n─────────────────────\nuserId\nextractedFacts: JSON\nformProgress: JSON\nlastSessionId\nupdatedAt"]
    end

    subgraph "Semantic Memory (vector store)"
        PGV[("pgvector\npolicy_chunks\n768-dim embeddings")]
    end

    subgraph "Session Start"
        Load["Load user profile from DB\nInject as agent context\n'Facts known so far: age=34...'"]
    end

    subgraph "Session End / Per Turn"
        Save["Persist updated facts\nMerge with existing profile"]
    end

    Conv --> Agent["Agent reasoning\n(ReAct loop)"]
    Load --> Agent
    PGV --> Agent
    Agent --> Save
    Save --> Profile
    Profile --> Load

    style Profile fill:#69b,stroke:#368,color:#fff
    style PGV fill:#7b5,stroke:#4a3,color:#fff
```

---

## Improvement Plan

### Phase 1 — Streaming (High Impact · Low Risk)

**Goal:** Users see tokens immediately instead of waiting 5–15 seconds for a full JSON blob.

**Changes:**
- Install `ai` (Vercel AI SDK) and create an Ollama-compatible provider wrapper
- Replace `callOllama({ stream: false })` with `streamText()`
- Change all chat route handlers to return `result.toUIMessageStreamResponse()`
- Update frontend chat components to use `useChat()` from `@ai-sdk/react`

**Files affected:**
- `lib/masshealth/ollama-client.ts` — add streaming variant
- `app/api/chat/masshealth/route.ts` — switch to stream response
- All chat UI components

**Before:**
```typescript
// Blocks until full completion (5–15s)
const reply = await callOllama({ stream: false, ... })
return NextResponse.json({ ok: true, reply })
```

**After:**
```typescript
const result = streamText({
  model: ollama("llama3.2"),
  system: buildBenefitAdvisorSystemPrompt(language, facts, eligibilityReport, ragContext),
  messages,
})
return result.toUIMessageStreamResponse()
```

---

### Phase 2 — Tool Use + ReAct Loop (Correct the Core Pattern)

**Goal:** The LLM decides which tools to call. Enables true agentic reasoning chains.

**New file structure:**
```
lib/agents/
  benefit-advisor/
    tools.ts       ← typed tool definitions
    prompts.ts     ← system prompt builder
    route.ts       ← streamText endpoint
  form-assistant/
    tools.ts
    prompts.ts
    route.ts
  intake/
    tools.ts
    route.ts
  appeal/
    tools.ts
    route.ts
```

**Example — Benefit Advisor tools:**
```typescript
// lib/agents/benefit-advisor/tools.ts
import { tool } from "ai"
import { z } from "zod"

export const benefitAdvisorTools = {
  extract_eligibility_facts: tool({
    description: "Extract age, income, household size, citizenship, and other eligibility facts from the conversation",
    parameters: z.object({ messages: z.array(messageSchema) }),
    execute: ({ messages }) => extractEligibilityFacts(messages, "en"),
  }),

  check_eligibility: tool({
    description: "Run the MassHealth eligibility rule engine and get program recommendations",
    parameters: screenerDataSchema,
    execute: (facts) => runEligibilityCheck(applyFactDefaults(facts)),
  }),

  retrieve_policy: tool({
    description: "Search MassHealth policy documents for relevant information",
    parameters: z.object({ query: z.string().describe("Search query about MassHealth policy") }),
    execute: ({ query }) => retrieveRelevantChunks(query, 5),
  }),

  ask_clarification: tool({
    description: "Ask the user for a specific missing piece of information",
    parameters: z.object({ question: z.string(), missingFact: z.string() }),
    // No execute — this is a UI tool that surfaces the question to the user
  }),
}
```

**Benefit advisor route:**
```typescript
// app/api/agents/benefit-advisor/route.ts
export async function POST(req: Request) {
  const { messages, language } = await req.json()

  const result = streamText({
    model: ollama("llama3.2"),
    system: buildBenefitAdvisorSystemPrompt(language),
    messages,
    tools: benefitAdvisorTools,
    stopWhen: stepCountIs(5),  // enables ReAct loop
  })

  return result.toUIMessageStreamResponse()
}
```

---

### Phase 3 — Agent Separation

**Goal:** Decompose the monolithic route into independently deployable, testable agent modules.

**New route structure:**
```
app/api/agents/
  benefit-advisor/route.ts    ← was mode=benefit_advisor
  form-assistant/route.ts     ← was mode=form_assistant
  intake/route.ts             ← was mode=application_intake
  chat/route.ts               ← was default mode
  appeal/route.ts             ← was /api/appeals/analyze
  vision/route.ts             ← was /api/appeals/extract-document
```

**Supervisor agent** (optional, for single-endpoint clients):
```typescript
// app/api/agents/route.ts — Supervisor
import { generateText, Output } from "ai"
import { z } from "zod"

const intentResult = await generateText({
  model: ollama("llama3.2"),
  output: Output.object({
    schema: z.object({
      intent: z.enum(["benefit_advisor", "form_assistant", "intake", "appeal", "general"]),
    }),
  }),
  prompt: `Classify this user message: "${lastMessage}"`,
})

// Route to appropriate specialist agent
return fetch(`/api/agents/${intentResult.object.intent}`, { method: "POST", body: req.body })
```

---

### Phase 4 — Persistent Long-Term Memory

**Goal:** Facts extracted in turn 2 are available in turn 10 without re-extraction. User profile persists across sessions.

**Schema:**
```sql
CREATE TABLE user_agent_memory (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text NOT NULL,
  session_id   text,
  extracted_facts  jsonb DEFAULT '{}',    -- ScreenerData partial
  form_progress    jsonb DEFAULT '{}',    -- FormFields partial
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
```

**Agent integration:**
```typescript
// At session start — inject known facts into system prompt
const memory = await loadUserAgentMemory(userId)
const systemPrompt = buildBenefitAdvisorSystemPrompt(language, memory.extractedFacts)

// After each turn — persist new facts
const newFacts = await extractEligibilityFacts(messages, language)
await mergeAndSaveAgentMemory(userId, { extractedFacts: newFacts })
```

---

### Phase 5 — Reflection Quality Gate

**Goal:** Appeal letters and eligibility explanations are self-evaluated before reaching users.

**Implementation:**
```typescript
// After generating appeal letter
const generated = await generateText({ model, prompt: appealPrompt })

// Reflection step — agent critiques its own output
import { generateText, Output } from "ai"

const review = await generateText({
  model: ollama("llama3.2"),
  output: Output.object({
    schema: z.object({
      factuallyAccurate: z.boolean(),
      clearToLayperson: z.boolean(),
      hasSpecificEvidence: z.boolean(),
      issues: z.array(z.string()),
      revisedLetter: z.string().optional(),
    }),
  }),
  prompt: `You are a MassHealth appeals expert. Review this appeal letter for accuracy,
           clarity, and completeness. If it has issues, provide a revised version.
           Letter: ${generated.text}`,
})

const finalLetter = review.object.revisedLetter ?? generated.text
```

---

### Improvement Roadmap Summary

```mermaid
gantt
    title mHealth Agent Improvement Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1 — Streaming
    Install Vercel AI SDK           :p1a, 2026-04-15, 2d
    Add streaming to chat routes    :p1b, after p1a, 3d
    Update frontend useChat()       :p1c, after p1b, 2d

    section Phase 2 — Tool Use
    Define tool schemas per agent   :p2a, after p1c, 3d
    Implement ReAct loop (maxSteps) :p2b, after p2a, 4d
    Test multi-step reasoning       :p2c, after p2b, 2d

    section Phase 3 — Agent Separation
    Extract agent modules           :p3a, after p2c, 4d
    Add supervisor router           :p3b, after p3a, 2d
    Update API routes               :p3c, after p3b, 2d

    section Phase 4 — Persistent Memory
    Create DB schema                :p4a, after p3c, 1d
    Implement memory load/save      :p4b, after p4a, 3d
    Inject memory into prompts      :p4c, after p4b, 2d

    section Phase 5 — Reflection
    Add reflection step to appeals  :p5a, after p4c, 2d
    Add quality gate to eligibility :p5b, after p5a, 2d
```

### Priority Matrix

| Phase | Change | User Impact | Tech Risk | Effort |
|-------|--------|-------------|-----------|--------|
| 1 — Streaming | `streamText()` + `useChat()` | High — immediate UX win | Low | Small |
| 2 — Tool Use | Typed tools + `maxSteps` ReAct | High — true agent reasoning | Medium | Medium |
| 3 — Agent Separation | Split monolithic route | Medium — maintainability | Low | Medium |
| 4 — Persistent Memory | DB-backed user profile | High — eliminates re-extraction | Medium | Medium |
| 5 — Reflection | Self-critique for appeal letters | Medium — quality gate | Low | Small |

---

## What the App Does Well (Preserve)

These patterns are well-implemented and should be kept intact during refactoring:

- **Eligibility rule engine** (`eligibility-engine.ts`) — deterministic, thorough, correct. Do not replace with LLM logic.
- **Benefit orchestrator** (`orchestrator.ts`) — scoring, ranking, and application bundling is solid.
- **RAG pipeline** — pgvector + nomic-embed-text is an appropriate choice for policy document retrieval.
- **Multi-language system prompts** — 6-language support with language-aware prompt builders.
- **Graceful degradation** — RAG and extraction failures silently degrade rather than crashing the conversation.
- **Zod validation** — all request payloads are validated; this is correct and should be extended to tool parameters.
- **Structured fact/field extraction** — the underlying extraction logic is sound; it just needs to be wrapped as formal tool definitions.

---

*Generated: 2026-04-14 | mHealth / HealthCompassMA*
