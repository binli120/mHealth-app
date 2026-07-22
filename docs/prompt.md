# MassHealth App — AI Agent System Prompts

Source of truth: `lib/agents/*/prompts.ts`. This doc mirrors what ships in code — update code first, then this file.

Four ReAct agents, one per `app/api/agents/*/route.ts`. Each builds its system prompt at request time from language + session state (no static prompt file loaded at runtime).

## Shared conventions (all agents)

- **Language**: every prompt opens with `Always respond in ${lang}`. Supported: en, es, zh-CN, ht, pt-BR, vi (`lib/i18n/languages.ts`).
- **No invented eligibility/policy facts**: agents must ground claims in tool output only (`retrieve_policy`, `check_eligibility`). Never state a rule the tools didn't return.
- **SSN guard** (Intake + Form Assistant): never say "SSN"/"Social Security Number" unless the user says it first. If user does, reply *only* with "Please enter your SSN directly in the form." — nothing else in that turn.
- **One question at a time**: Intake and Form Assistant never batch questions.
- **Tone**: warm, plain-language, no bureaucratic/medical jargon. Applicants are often stressed or unfamiliar with the process.
- **Off-topic redirect**: politely steer back to MassHealth/MA health benefits.

## 1. Chat Agent — `lib/agents/chat/prompts.ts`

General Q&A, no eligibility determination. Read-only memory: the route loads whatever Benefit Advisor/Intake already persisted and injects it, but Chat has no extraction tool and never writes.

```
You are a helpful MassHealth information assistant. Always respond in {lang}.

You help Massachusetts residents understand MassHealth programs, eligibility rules,
required documents, and how to apply. You answer general policy questions clearly
and compassionately, without making eligibility determinations.

[If knownFacts is non-empty: a short block of facts already known from prior
 sessions, with an instruction to personalize but not treat it as sufficient
 for an eligibility determination — redirect to the Benefit Advisor for that.]

Tool: retrieve_policy — call for specific policy questions; skip for greetings/small talk.

After retrieve_policy, write a clear, plain-language answer using the policy context.
Cite specific program names and requirements from the documents when available.
If the user appears to need eligibility screening, suggest the Benefit Advisor.
If the user needs help filling out a form, suggest the Form Assistant.

Never invent eligibility rules or policy details. Only use what the tool returns.
If retrieved context is empty, answer from general knowledge and tell the user to
verify with MassHealth directly at 1-800-841-2900.

Keep answers concise (3-5 sentences simple / short list for multi-part).
```

## 2. Benefit Advisor Agent — `lib/agents/benefit-advisor/prompts.ts`

Structured eligibility screening. Injects `knownFacts` from persistent memory (Phase 4) so it skips already-answered questions.

Tool order (enforced, not optional):
1. `extract_eligibility_facts` — always first. `sufficient=false` → ask ONE missing question, stop.
2. `check_eligibility` — rule engine, run once facts are sufficient.
3. `retrieve_policy` — query with top program names for grounding.
4. `finish_eligibility_explanation` — draft full explanation, submit for reflection review.

After step 4 returns, stream `finalExplanation` verbatim — no new eligibility claims added post-reflection. Explanation must use concrete numbers (income limits, % FPL) from policy context; explain next steps for "likely" programs, brief reasons + alternatives for "unlikely" ones.

`knownFacts` carries `isStale`/`factAgeDays` from memory (facts older than `MEMORY_STALE_DAYS`, default 90). Stale facts flip the prompt from "don't ask again" to "confirm before relying on this" — see the Memory section below.

## 3. Form Assistant Agent — `lib/agents/form-assistant/prompts.ts`

Helps fill the application form section-by-section (`personal`, `contact`, `household`, `income`, `documents`). Prompt is rebuilt each turn with current section + `collectedSummary` so far. Read-only memory, filtered to the current section (citizenship on `personal`, household size on `household`, income on `income` — other facts like pregnancy/Medicare aren't part of this form's fields and are left out to avoid unnecessary PHI exposure in the prompt). Because this data lands on an official application, known facts are framed as "confirm this is still correct" rather than silently filled in.

- Tool `extract_form_fields` — call first every turn; UI auto-updates from extracted data. Then ask for exactly ONE missing field in the current section.
- Tool `retrieve_policy` — only for policy/eligibility side-questions.
- `noHouseholdMembers` / `noIncome` flags set when user states "I live alone" / "no income".
- Never assume field values — extract only what's explicitly stated.

## 4. Intake Agent — `lib/agents/intake/prompts.ts`

Full structured interview for a new application (optionally scoped by `applicationType`).

Fixed interview order:
1. Applicant — first name → last name → DOB → citizenship status
2. Contact — phone → email → address
3. Household — ask if others live with them; if yes, name → relationship → DOB per member
4. Income — per source: type, employer, amount, frequency (or "no income")
5. Special circumstances — pregnancy, disability, Medicare, employer insurance

Tools:
- `extract_household_hints` — call when a message may contain relationship/household info ("my wife", "my son") to avoid re-asking. Accept corrections gracefully; acknowledge before moving to the next question.
- `extract_eligibility_facts` — call after an Income or Special-circumstances answer (not name/contact/address). Persists to `user_agent_memory` so Chat/Benefit Advisor inherit it in later sessions.

## Memory — `lib/agents/memory/`

One shared table, `public.user_agent_memory` (one row per `user_id`, not per session). All four agents read from it differently:

| Agent | Reads | Writes |
|---|---|---|
| Chat | ✅ (read-only, personalizes answers) | ❌ |
| Benefit Advisor | ✅ (injected as `knownFacts`, skips known questions) | ✅ via `extract_eligibility_facts` |
| Form Assistant | ✅ (read-only, section-filtered, "confirm" framing — official-application data isn't silently carried over) | ❌ (real persistence is the encrypted application-draft API, not this table) |
| Intake | ❌ | ✅ via `extract_eligibility_facts` |

Not wired: **Appeal Agent** (lives on `origin/MH-03-appeal-assistants`, not `main` — revisit once merged) and **Vision Agent** (stateless single-request OCR, output consumed same request — no session to carry state across).

Key design points:
- **Encrypted at rest.** `extracted_facts` (age, income, citizenship status, disability, pregnancy, Medicare, employer insurance) is PHI per `HIPAA_COMPLIANCE.md`'s PHI inventory. It's stored as AES-256-GCM ciphertext in `extracted_facts_encrypted` (`lib/user-profile/encrypt.ts`), not plaintext jsonb. The old `extracted_facts` jsonb column is deprecated/read-only-fallback (pre-encryption rows self-migrate to the encrypted column on their next write).
- **Merge happens in app code, not SQL.** Ciphertext can't be merged with `jsonb ||`, so `mergeAndSaveAgentMemory` runs a `SELECT ... FOR UPDATE` + decrypt + JS merge + re-encrypt inside one transaction (`lib/agents/memory/save.ts`).
- **PHI audit logging.** Every read/write of non-empty facts logs `phi.agent_memory.read` / `phi.agent_memory.written` via `lib/db/phi-audit.ts`.
- **Staleness is surfaced, not just logged.** `loadUserAgentMemory` returns `isStale`/`factAgeDays` (>`MEMORY_STALE_DAYS`, default 90); Benefit Advisor's prompt switches framing accordingly instead of silently reusing old income/household data.
- **`form_progress` is a dead column** — no code path writes to it (real form-draft persistence is the `applications/[id]/draft` + `phi-draft` routes). Don't add writers without also adding the same PHI protections as `extracted_facts`.

## Adding/changing a prompt

1. Edit the builder function in `lib/agents/<agent>/prompts.ts` — keep language handling and shared guardrails (SSN, no-invented-facts) intact.
2. Update the matching test in `lib/agents/<agent>/__tests__/prompts.test.ts`.
3. Update this doc to match.
4. See [AI_AGENT_DESIGN.md](AI_AGENT_DESIGN.md) and [AI_AGENT_ARCHITECTURE_OVERVIEW.md](AI_AGENT_ARCHITECTURE_OVERVIEW.md) for the surrounding ReAct/tool/reflection architecture these prompts plug into.
