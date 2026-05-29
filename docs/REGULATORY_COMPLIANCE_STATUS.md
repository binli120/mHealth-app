# Regulatory Compliance Status
## HealthCompass — Legal & Regulatory Risk Assessment Response

**Author:** Bin Lee  
**Assessment Source:** HealthCompass Legal & Regulatory Risk Assessment (May 2026)  
**Last Updated:** May 2026  
**Classification:** Confidential — Internal Engineering

---

## Overview

This document tracks the engineering and operational response to each compliance domain identified in the HealthCompass Legal & Regulatory Risk Assessment. For each domain the document records the assessed risk level, the specific issues found in the codebase, the remediation applied, and any open items still requiring action.

Status key:

| Symbol | Meaning |
|---|---|
| ✅ | Implemented and verified |
| 🔧 | Fixed during this remediation cycle (May 2026) |
| ⚠️ | Requires action — owner and deadline assigned |
| 📋 | Non-code artifact required (policy, legal, ops) |

---

## 1. HIPAA & Data Privacy — Risk: HIGH
**Source:** §5, §11 Principle 2 | **Regulation:** 45 CFR §164, 201 CMR 17.00

### Issues Found

#### 1.1 Plaintext PHI columns in PostgreSQL
**Status: 🔧 Fixed**

The `applicants` table contained ten plaintext PHI columns alongside their encrypted counterparts: `first_name`, `last_name`, `dob`, `phone`, `address_line1`, `address_line2`, `city`, `state`, `zip`, `citizenship_status`. Of 174 rows, 115 had plaintext name data with no encrypted equivalent (backfill not yet run). The auth trigger `handle_new_user` was also inserting `first_name`, `last_name`, and `phone` from Supabase auth metadata on every new signup, creating a live PHI ingestion path into plaintext columns.

**Remediation applied (May 15, 2026):**
- Plaintext data nulled out across all 174 affected rows on the development database
- All ten plaintext columns dropped: `ALTER TABLE applicants DROP COLUMN IF EXISTS ...`
- `handle_new_user` trigger rewritten to insert only `user_id` + `created_at`; name/phone no longer written from auth metadata
- View `identity_pending_review` recreated referencing `first_name_encrypted` / `last_name_encrypted`
- Included in baseline schema: `supabase/migrations/20260101000000_baseline_schema.sql`

**Remaining columns:** Only `*_encrypted` (AES-256-GCM) columns and non-PHI identity metadata remain in `applicants`.

---

#### 1.2 PHI in legacy tables (household_members, incomes, applications)
**Status: 🔧 Fixed**

`household_members` had plaintext `first_name`, `last_name`, `dob`. `incomes` had plaintext `employer_name`, `monthly_amount`. `applications` had `total_monthly_income`. No application code writes to these tables (legacy schema predating the WizardState approach), but rows with legacy data existed.

**Remediation applied:**
- Plaintext PHI columns nulled in `household_members`, `incomes`, and `applications.total_monthly_income`
- These columns should be dropped in a future schema cleanup once confirmed no reporting queries depend on them

---

#### 1.3 PHI leaking into AI provider (Groq) via system prompts
**Status: 🔧 Fixed**

`summarizeCollectedFields()` in `lib/masshealth/form-sections.ts` was building a system-prompt context string that included actual values: real names ("First name: John Smith"), DOB, phone, email, full address, household member names and DOBs, and income amounts. This was sent verbatim to Groq on every form-assistant request.

Additionally, `buildIntakeHouseholdHintsMessage()` in `app/api/chat/masshealth/route.ts` was injecting actual member names ("Household member provided: Jane Smith") into the intake system prompt.

**Remediation applied:**
- `summarizeCollectedFields()` rewritten to send field-presence indicators only: `[provided]` replaces all PHI values. The LLM needs to know which fields are filled, not their content.
- `buildIntakeHouseholdHintsMessage()` changed to `[name withheld]`; only relationship is forwarded.
- SSN was already protected (zeroed out before any model call; SSN-pattern messages blocked at the API boundary).

---

#### 1.4 PHI in AI conversation messages (Groq)
**Status: ⚠️ Open — requires BAA or architectural decision**

**Owner:** Bin Lee / Legal  
**Target:** Before production launch with real applicants

The `messages` array (chat conversation history) passed to Groq contains whatever users type — names, DOBs, addresses, income figures. This is inherent to the conversational interface and cannot be filtered without breaking the chat flow. The system-prompt PHI leaks above have been fixed; this is the remaining gap.

**Options:**
1. **Sign a Business Associate Agreement (BAA) with Groq.** Groq must execute a BAA before the platform handles real applicant PHI through its API. Contact: `privacy@groq.com`. Verify Groq's current BAA availability before committing.
2. **Route PHI-containing chat flows to local Ollama.** When `GROQ_API_KEY` is absent, `getOllamaModel()` already falls back to Ollama. For sessions involving real applicant intake, disable Groq and use the on-prem Ollama instance only. This eliminates external PHI transmission entirely.
3. **Hybrid:** Use Groq for benefit advisor (general policy questions, no direct PHI) and Ollama for intake/form-assistant (where users provide personal data).

---

#### 1.5 mobile_verify_sessions extracted data TTL
**Status: 🔧 Fixed (cleanup) / ⚠️ Open (ongoing)**

`mobile_verify_sessions.extracted_data` JSONB stores `firstName`, `lastName`, `addressLine1`, `city`, `state`, `zip` from driver's license scans. Sessions older than 24 hours were cleaned in the May 2026 remediation run.

**Open item:** Schedule a nightly cleanup job (Supabase Edge Function or pg_cron) to continue clearing `extracted_data` after 24 hours:
```sql
UPDATE mobile_verify_sessions
SET extracted_data = NULL
WHERE extracted_data IS NOT NULL AND created_at < now() - INTERVAL '24 hours';
```

---

#### 1.6 Audit logging
**Status: ✅ Implemented**

PHI access events are logged to `audit_logs` via `lib/db/phi-audit.ts`. Every SSN read/write and bank account read/write records action, `user_id`, and `ip_address`. Admin audit viewer is available at `/reviewer/audit`. Covers 45 CFR §164.312(b) audit controls requirement.

---

#### 1.7 Draft state PHI isolation
**Status: ✅ Implemented**

`applications.draft_state JSONB` (the persisted WizardState) is stripped of PHI before every server write via `stripPhiFromWizardState()` in `lib/db/application-drafts.ts`. Client also strips via `buildSafeServerSnapshot()` before the PUT request (defense in depth). PHI from unfinished applications is stored exclusively in AES-256-GCM encrypted blobs in Supabase Storage, accessible only with the user's resume token (key never stored server-side).

---

#### 1.8 Written Information Security Program (201 CMR 17.00)
**Status: 📋 Policy artifact required**

**Owner:** Bin Lee / Legal / Operations  
**Target:** Before any Massachusetts resident's data is processed in production

Massachusetts 201 CMR 17.00 requires every entity handling personal information of MA residents to maintain a **Written Information Security Program (WISP)**. This is a documented organizational policy, not a code control. The WISP must cover:
- Risk assessment process
- Employee security training
- Third-party vendor management (including Supabase, Groq, Vercel)
- Incident response and breach notification procedure (notify MA AG and affected individuals)
- Physical and technical access controls

Engage legal counsel to draft the WISP before production launch. Reference: [Mass.gov WISP guide](https://www.mass.gov/guides/written-information-security-program-wisp-requirements).

---

#### 1.9 Business Associate Agreements
**Status: 📋 Legal action required**

**Owner:** Legal  
**Target:** Before production launch

If the platform stores or transmits applicant PHI (which it does), it is a business associate of the Navigator organization or MassHealth under HIPAA. A BAA must be executed with:
- Each Navigator organization that deploys the platform
- Supabase (for database and Storage hosting) — check current BAA status
- Groq (if used for PHI-containing conversations — see §1.4)
- Vercel (for hosting) — check current BAA status

---

## 2. Eligibility Determination Boundaries — Risk: MEDIUM-HIGH
**Source:** §4 | **Regulation:** 130 CMR

Only MassHealth/HIX has authority to make eligibility determinations. Platform outputs that say "you qualify for" or "you are eligible for" could be construed as unauthorized determinations.

### Issues Found

#### 2.1 Benefit advisor AI prompt — hard determination language
**Status: 🔧 Fixed**

The benefit advisor system prompt instructed the AI to explain "why they qualify" (hard determination framing). The fact-gathering prompt described the tool as helping users find "programs they qualify for."

**Remediation applied:**
- `lib/masshealth/chat-knowledge.ts` line 826: changed to "why they **may** qualify based on their responses"
- `lib/masshealth/chat-knowledge.ts` line 847: changed to "programs they **may** qualify for"
- The closing instruction already included the required safe-harbor: "These estimates are based on your responses. Contact MassHealth at (800) 841-2900 for official determination." — preserved.

---

#### 2.2 ACA-3AP eligibility engine success message
**Status: 🔧 Fixed**

The engine returned "All rules passed. Additional person qualifies to be added to the household case." — a definitive determination statement.

**Remediation applied:**
- `lib/masshealth/aca3ap-eligibility-engine.ts`: changed to "Pre-screening passed. This person **appears eligible** to be added to the household case. Final determination is made by MassHealth."

---

#### 2.3 Prescreener and main eligibility engine
**Status: ✅ Already compliant**

- Prescreener copy (`app/prescreener/prescreener-copy.ts`): "you **may** qualify for coverage", "This is not an official eligibility determination"
- Main eligibility engine (`lib/eligibility-engine.ts`): "you **may** qualify for coverage. Complete a full application to get an official determination."
- Benefit results disclaimer (`lib/i18n/messages.ts`): "These results are estimates... Official eligibility is determined by each program at the time of application."

---

#### 2.4 Plan recommendation restrictions (§4.3)
**Status: ✅ No violation found**

No code presents specific health plan recommendations. The platform displays plan information and factual comparisons. No directive language found.

---

## 3. Language Access Obligations — Risk: MEDIUM
**Source:** §8 | **Regulation:** ACA §1557, Title VI

### Status: ✅ Compliant

All five required LEP languages are supported:

| Language | Code | Required by Assessment |
|---|---|---|
| Spanish | `es` | ✅ |
| Brazilian Portuguese | `pt-BR` | ✅ |
| Simplified Chinese | `zh-CN` | ✅ |
| Haitian Creole | `ht` | ✅ |
| Vietnamese | `vi` | ✅ |

Appeals disclaimers ("not legal advice") are translated in all six supported languages (`lib/appeals/copy.ts`). Chat widget copy is translated for all locales (`lib/i18n/chat-widget.ts`).

**Open item:** As new applicant-facing output types are added (document checklists, eligibility summaries, status notices), translations must be provided for all five LEP languages before the feature ships. AI translation is acceptable for navigator-facing content; applicant-facing critical content (eligibility notices, rights information) requires human review of translations per §8.2.

---

## 4. Unauthorized Practice of Law — Risk: MEDIUM
**Source:** §9 | **Regulation:** Massachusetts UPL statute

### Status: ✅ Compliant (current feature set) / ⚠️ Requires gate for future SACA-2 features

**Appeals features:** All AI-generated appeal analyses include the disclaimer "This analysis is AI-generated and is not legal advice. For complex cases, consider consulting a benefits attorney or legal aid organization." — present in all six languages (`lib/appeals/copy.ts`).

**SACA-2 asset planning (future):** The assessment identifies a clear boundary between safe informational tools and risky advisory features (§9.2). If a SACA-2 spend-down calculator or asset planning tool is built, it must:
- Display countable asset totals and the gap to the $2,000 threshold (safe)
- **Never** recommend specific asset restructuring strategies, trust formation, or transfer timing
- Include a built-in referral pathway to elder law attorneys and Certified Medicaid Planners
- Be reviewed by qualified legal counsel before launch

---

## 5. HIX Automation Prohibition — Risk: MEDIUM
**Source:** §7 | **Regulation:** 45 CFR §155.220

### Status: ✅ Compliant

The platform prepares ACA-3 application data (pre-filling, validating, generating PDFs) but does not interact with MAhealthconnector.org or the HIX/IES system directly. The Navigator/caseworker performs all data entry into the official system. No scraping, auto-fill, or programmatic submission code exists.

This architecture must be preserved as new features are added. Any feature that would automate interaction with the HIX portal requires explicit written CMS/EOHHS approval before development begins.

---

## 6. Navigator Program Governance — Risk: LOW
**Source:** §3 | **Regulation:** 45 CFR §155.210

### Status: ✅ No code changes required

Platform positioning (decision-support tool for certified Navigators and CACs, not a Navigator entity itself) is a branding and marketing concern. No code in the application implies HealthCompass is itself a Navigator or acts on behalf of MassHealth.

**Ongoing:** Review all user-facing copy for language that could be interpreted as claiming Navigator authorization. Legal review recommended before public marketing materials are finalized.

---

## 7. Conflict of Interest Rules — Risk: LOW-MEDIUM
**Source:** §6 | **Regulation:** 45 CFR §155.210(d), §155.215

### Status: ✅ No code changes required

B2B SaaS revenue model does not create Navigator conflicts. No referral fee infrastructure, health plan advertising, or insurer revenue streams are present in the codebase.

**Ongoing:** Any future monetization feature (referrals, plan comparison commissions, advertising) must be reviewed against §155.210(d) and §155.215 before implementation.

---

## Open Items Summary

| # | Issue | Owner | Priority | Target |
|---|---|---|---|---|
| 1.4 | BAA with Groq OR route intake/form-assistant to Ollama | Bin Lee / Legal | **Critical** | Before prod launch |
| 1.5 | Schedule nightly `mobile_verify_sessions.extracted_data` cleanup | Engineering | High | Sprint +1 |
| 1.8 | Draft Written Information Security Program (WISP) | Legal / Operations | **Critical** | Before prod launch |
| 1.9 | Execute BAAs with Supabase, Vercel, Navigator orgs | Legal | **Critical** | Before prod launch |
| 2 | Add language translation review process for new applicant-facing outputs | Product / Engineering | Medium | Ongoing |
| 9 | SACA-2 asset planning feature gate and legal review | Legal / Product | Medium | Before SACA-2 launch |

---

## Remediation Log

| Date | Change | Files |
|---|---|---|
| 2026-05-15 | Dropped 10 plaintext PHI columns from `applicants` | `supabase/migrations/20260101000000_baseline_schema.sql` |
| 2026-05-15 | Fixed `handle_new_user` trigger — no longer writes plaintext PHI on signup | Applied via Supabase MCP |
| 2026-05-15 | Nulled PHI in `household_members`, `incomes`, `applications.total_monthly_income` | Applied via Supabase MCP |
| 2026-05-15 | Rebuilt `identity_pending_review` view on encrypted columns | Applied via Supabase MCP |
| 2026-05-15 | `summarizeCollectedFields` — replaced real values with `[provided]` markers | `lib/masshealth/form-sections.ts` |
| 2026-05-15 | Intake household hints — masked member name from Groq system prompt | `app/api/chat/masshealth/route.ts` |
| 2026-05-15 | Benefit advisor prompt — changed "why they qualify" → "may qualify" | `lib/masshealth/chat-knowledge.ts` |
| 2026-05-15 | ACA-3AP engine — changed success message to "appears eligible" + MassHealth disclaimer | `lib/masshealth/aca3ap-eligibility-engine.ts` |

---

*This document does not constitute legal advice. HealthCompass should engage qualified legal counsel specializing in health information privacy, Medicaid regulatory compliance, and Massachusetts state procurement law before finalizing product architecture and go-to-market strategy.*
