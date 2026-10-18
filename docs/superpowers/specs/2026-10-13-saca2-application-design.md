# SACA-2 Application (Seniors / Long-Term Care) — Design

Status: draft for review · Date: 2026-10-13 · Owner: Bin Lee

## 1. Goal and scope

Make **SACA-2** ("Application for Health Coverage for Seniors and People Needing
Long-Term-Care Services") a fully supported application type, at parity with ACA-3:

- guided wizard (6-language UI) with save-and-resume,
- PHI-safe draft storage,
- eligibility *screening* engine + document checklist,
- filled official PDF,
- social-worker / dashboard / mobile touchpoints,
- rollout behind a feature flag.

**Scope decision (user, 2026-10-13): full parity ("A"), delivered in phases.**
**Architecture decisions (user):** schema-driven wizard (not a clone/extension of the
ACA-3 `FormWizard`); PDF filled locally with `pdf-lib` (not the external Python
analysis service).

**Out of scope:** official eligibility determination (screening estimates only);
ACA-3 behaviour changes; MSP application (reuses the schema-driven base later);
translation of legal attestations.

### Who it serves
Applicants (65+, or any age needing long-term care) and social workers acting for
patients. Success = a user can complete SACA-2 end to end, receive a screening
result and document checklist, and download a correctly filled, signable PDF.

## 2. Current state (verified in repo, 2026-10-13)

| Area | State |
|---|---|
| Type registry | Done. `saca2` in `MASSHEALTH_APPLICATION_TYPES` (`lib/masshealth/application-types.ts`), `MassHealthApplicationType`, quick-check recommendation, 6-language copy in `app/application/type/type-copy.ts`. Form code there says `SACA-2 (03/26)`; the PDF footer says **`SACA-2_2026-08`** — store the footer value. |
| Dead end today | `application-type-page-client.tsx` creates a draft with `applicationType: "saca2"` then `router.push(buildApplicationStartHref(id))` → `/application/new`, which always renders the **ACA-3** `FormWizard`/`IntakeChat`. Users are silently put in the wrong form. Fixed in Phase 0 by a notice (hook + component under `components/application/saca2/`). |
| Question data | None. ACA-3 has `data/aca_3-0235.json`, `config/ACA-3-0325.json`; ACA-3-AP has `data/aca_3ap-0325.json` + `aca3ap-requirements.ts`. |
| Engines | `aca3-eligibility-engine.ts`, `aca3ap-eligibility-engine.ts`. The AP engine already emits `status: "REDIRECT_SACA2"`; `application-checks.ts` warns 65+ applicants "may need SACA-2". |
| Fill route | `/api/forms/aca-3-0325/fill` proxies to an external Python service (`/masshealth/fill/aca3`). No local fill logic. `pdf-lib` is already a dependency. |
| Intake chat | `components/application/aca3/intake-chat-question-builder.ts` / `-answer-parser.ts` are ACA-3-coupled. |
| Draft persistence | `lib/db/application-drafts.ts`. Server `draft_state` **strips PHI keys** (`contact`, `preApp`, `persons`); PHI lives in a client-encrypted resume token + storage blob (`lib/phi-token/`: `crypto.ts`, `phi-fields.ts`, `token.ts`, `restore.ts`). Server key list is a mirrored copy of `phi-fields.ts`. |
| Feature flags | `public.feature_flags` (+ `feature_flag_env_overrides`) tables exist (migration `20260622235959`). Reader/admin code path **not yet located** — see open items. |

## 3. Source material and verified facts

Sources (retrieved 2026-10-13):
- SACA-2 PDF, 42 PDF pages = form pages 1–40 (two unnumbered cover pages) (user-supplied):
  SACA-2 form p1–24, Supplements A–D p25–31, reference lists p32, ARD-1122 p33–36,
  IRS 4506 p37–38, MA voter form p39–40. Page numbers below are form pages.
- Eligibility Operations Memo 26-03 (March 2026, user-supplied).
- mass.gov "Eligibility for people age 65 and older and people who need long-term-care
  services" (rules summary only; no figures).
- mass.gov "Program financial guidelines for certain MassHealth applicants and members"
  (last updated Oct 1, 2026) — figures below.
- "2026 MassHealth Income Standards and Federal Poverty Guidelines" PDF, effective
  March 1, 2026 (DG-FPL_2026-03).

### 3.1 Target populations (EOM 26-03)
- 65+ living at home who is not the live-in parent of a child <19; not an adult
  relative caring for a child <19 with no parent in the home; disabled and working
  ≥40 h/month or ≥240 h in prior 6 months; **or has received CommonHealth for 10 years**.
- Any age needing long-term care in a medical institution or nursing facility.
- Eligible under certain programs to get long-term care at home (HCBS waiver).
- Married couple living together where both apply, no children <19, one spouse 65+
  and the other <65.
- 65+ parents of a child <19 (or relative caregivers) use **ACA-3** instead.

### 3.2 2026 figures (effective Jan 1 unless noted)
| Figure | Value |
|---|---|
| MassHealth asset limit — individual / married couple member | $2,000 / $3,000 |
| MSP asset limit | none (since 3/1/2024) |
| Federal benefit rate ×300% (special income limit) | $2,982/mo |
| Personal needs allowance (PNA) / institutional income standard | $72.80 |
| Max home equity | $1,130,000 |
| Community spouse resource standard | min $32,532 · max $162,660 |
| MMMNA | max $4,066.50 (1/1/2026); min $2,705.00 (7/1/2026) |
| Standard shelter expense | $811.50 (7/1/2026) |
| SNAP utility standard | heat $945.00 · no heat $575.00 (10/1/2026) |
| Avg daily nursing-facility cost (transfer penalty divisor) | $450 |
| Medicare Part B premium | $202.90/mo |
| Look-back period | 60 months (form, Step 5 and Supplement A) |
| MA SSI standards, aged individual | A $1,122.82 · B $1,033.26 · C $767.03 · E (rest home) $1,287.00 · G (assisted living) $1,448.00 |
| FPL / MassHealth income standard (eff. 3/1/2026), family of 1 | std $522 · 100% $1,330 · 133% $1,769 · 150% $1,995 · 190% $2,527 · 200% $2,660 · 300% $3,990 · 400% $5,320 (monthly). Family of 2: std $650 · 100% $1,804 · 133% $2,399 · … (full table 1–8 + per-additional-person in the source PDF; encode all). |

Note: 2026 min-MMMNA/shelter and SNAP utility figures change mid-year on fixed
dates; constants carry effective dates and the staleness guard (§5.2) accounts for them.

### 3.3 Form structure
| Part | Form pages | Content |
|---|---|---|
| Intake | 1 | Program boxes (MassHealth/HSN, LTC/HCBS Waiver, Health Connector), names, SNAP-to-DTA opt-in |
| Step 1 Person 1 | 1–6 | ~34 questions: identity, SSN, tax filing, citizenship/immigration, residency, disability/accommodation, SSI history, income (job, self-employment, other, rental, one-time), deductions, yearly income. Enrollment-assister block. |
| Step 2 Person 2 | 7–11 | Same questions, numbered 1–44 |
| Step 3 | 12 | AI/AN household screen → Supplement B |
| Step 4 | 12 | Previous medical bills (3 months) |
| Step 5 Assets | 12–15 | Bank, real estate, life insurance, securities, annuities, assisted-living deposits, vehicles, prepaid burial, trusts — 60-month look-back for LTC |
| Step 6 / 7 | 16–17 | Health insurance (Medicare, Part D, Medigap, MSP Part B help, other, employer → Supp D); HRAs (QSEHRA/ICHRA) |
| Step 8 | 17–18 | PCA screen (65+, not entering a facility) → Supplement C |
| Step 9 | 18 | Optional breast/cervical cancer, HIV (spouse <65) |
| Step 10 | 18–24 | 28 consent items; SNAP rights/penalties; voter registration; signature; emancipated-minor responsible party |
| Supp A (LTC) | 25–28 | Facility/admission, spouse living expenses, family at home, 60-month resource transfers, deposits, home/real estate, LTC insurance, tax returns |
| Supp B / C / D | 29 / 30 / 31 | AI/AN; Personal-Care Attendant (ADL grid); Health coverage from jobs |
| Reference | 32 | Eligible immigration statuses & document types; race/ethnicity lists |
| Attachments | — | ARD-1122 (Sections I–III), IRS Form 4506, MA voter registration form |

PDF facts: 1,149 AcroForm fields (733 text, 414 checkbox, 2 buttons); all names
**unique**; names are label-derived (`"2 Date of birth mmddyy"`) with `_2`, `_3`
suffixes for repeats; 259 fields have multiple widgets; PDF page index = form page + 2.

## 4. Architecture

New code lives in `lib/masshealth/saca2/` (pure, independently testable units) and
`components/application/saca2/`. ACA-3 code is not modified except the listed
integration points.

### 4.1 Units

| Unit | Responsibility | Depends on |
|---|---|---|
| `types.ts` | `Saca2Answers`: `persons[]` (Person 1 applicant, Person 2 spouse/other; one shared per-person shape), `assets` (typed repeating rows per category), `transfers[]`, `supplements` (A–D), `intake` (program boxes, SNAP opt-in), `signature` metadata (never signed by app) | — |
| `schema.ts` | Question tree as typed data: steps → sections → questions (`id`, `inputType`, `visibleWhen`, `repeat`, `phi: boolean`, `pdfRef?`) | `types` |
| `visibility.ts` | Pure fns: which steps/sections/questions apply (Supp A when LTC/HCBS; Step 8 for 65+ not entering a facility; Step 9 for married <65 spouse; Supp B/C/D triggers) | `schema`, `types` |
| `figures-2026.ts` | All §3.2 constants with effective dates + source URLs | — |
| `eligibility-engine.ts` | `evaluateSaca2Eligibility(answers, figures)` | `figures`, `types` |
| `document-checklist.ts` | answers → required-document list | `types` |
| `requirements.ts` | schema → `Aca3RequiredQuestion`-compatible flat list (for chat phase) | `schema` |
| `pdf/field-inventory.json` | committed dump of PDF fields (name, type, page, widget count) | generated |
| `pdf/pdf-field-map.ts` | `answer path → field name` + encoders (date, SSN, currency, checkbox groups) | `schema`, inventory |
| `pdf/pdf-fill.ts` | pure `(answers, templateBytes) → pdfBytes`; fills, adds overflow sheets, selects pages | `pdf-field-map`, `pdf-lib` |

### 4.2 UI
`components/application/saca2/Saca2Wizard` renders from `schema.ts` via a generic
step renderer supporting conditional sections and repeaters, with keyboard
navigation and ARIA parity with the ACA-3 wizard. `/application/new` selects the
wizard through `getApplicationTypeBaseForm()` (`aca3`→ existing, `saca2`→ new).
ACA-3 `FormWizard` is untouched.

### 4.3 Persistence (corrects earlier assumption)
- **PHI never goes in server `draft_state`.** SSNs, names, DOBs, account numbers,
  asset values, trust/annuity details, and transfer data are PHI and travel through
  the existing client-encrypted resume token + storage blob (`lib/phi-token/`).
- There is **one** shared PHI key list, `PHI_DATA_KEYS` in `lib/phi-token/phi-fields.ts`,
  imported by both the client split and the server strip (no mirrored copy). It holds
  `contact`, `preApp` (ACA-3) and the SACA-2 keys `screening`, `persons`, `aian`,
  `previousMedicalBills`, `assets`, `transfers`, `health`, `pca`, `supplements`,
  `signing`, `attachments`. Only `intake` and `signature` reach the server draft.
- Server `draft_state` holds non-PHI only: `schemaVersion: "saca2-2026-08"`, route
  flags, current step, program-box selections.
- `applications.application_type = "saca2"`; no migration expected for the
  application row. No migration is needed: the feature flag is an environment variable, not a table (§4.7).
  Implemented in Phase 1: all answer keys except intake and signature are PHI (SACA2_PHI_KEYS); the server strip and the client split share one list (lib/phi-token/phi-fields.ts). PHI is held in memory only (no localStorage copy, unlike ACA-3) until Save & Exit writes the encrypted blob. The server draft `currentStep` is the furthest step reached, capped at 9, because the draft route accepts only 1–9 and never lowers stored progress.

  Draft-type guard: `upsertApplicationDraft` refuses an ACA-3 write to a draft whose application is `saca2` (`ApplicationDraftTypeConflictError`, surfaced by the draft route as HTTP 409 with body `{ ok: false, error: <message> }`). SACA-2 writes are never refused. A stored row counts as SACA-2 when its `application_type` is `'saca2'` OR its stored `draft_state` carries a `schemaVersion`; the predicate is wrapped in `IS NOT TRUE`, so NULL stored columns evaluate to not-SACA-2 and keep ACA-3 rows writable.

  Save & Exit: the encrypted blob holds the PHI keys only. If the PHI-free server draft save fails with a non-retryable error, the dialog warns that the program selections and step progress may not be saved.

### 4.4 Eligibility engine
Contract: `{ status, findings[], rule_results[], estimates, required_documents[] }`,
reusing `EligibilityFinding` / `EligibilityRuleResult` so dashboard and
social-worker views render it unchanged.

Status vocabulary: `LIKELY_ELIGIBLE | NEEDS_REVIEW | LIKELY_INELIGIBLE |
PENDING_DOCUMENTS | REDIRECT_ACA3`. **No `APPROVED`**; UI labels every result a
screening estimate. Anything not confirmed against regulation resolves to
`NEEDS_REVIEW`, never a guess.

Rules (pure, individually tested):
1. **Residency & route** — Q14 residency; route by 65+, nursing facility, HCBS
   waiver, PACE, mixed-age couple, 10-year CommonHealth; `REDIRECT_ACA3` for parent
   of child <19 / caregiver relative.
2. **Citizenship/immigration** — against the p32 eligible-status list; checklist
   waives proof for Medicare/SSI/SSDI recipients (form p2).
3. **Countable assets** — $2,000 / $3,000; exclude primary residence (intent to
   return, or spouse/dependent living there), one vehicle, burial items; community
   spouse resource band $32,532–$162,660 when one spouse is institutionalized.
4. **Home equity** — flag > $1,130,000 unless spouse, child <21, or disabled child
   lives in the home.
5. **60-month transfers** — sum uncompensated transfers in window; estimated
   penalty days = value ÷ $450 (estimate only).
6. **Income** — vs. FPL tier by family size and the $2,982 limit; institutional
   patient-paid-amount estimate = income − $72.80 − spouse allowance − premiums.
7. **Spousal allowance (MMMNA)** — min $2,705, cap $4,066.50; excess shelter =
   (rent/mortgage + taxes + insurance + condo fee + SNAP utility standard) − $811.50,
   inputs from Supplement A Q2–4.
8. **Medicare/MSP** — flag MSP referral from Step 6; Part B $202.90.

**Policy verification gate:** figures are sourced from mass.gov; rule *logic* is
from the form and program summaries. Before Phase 3 ships, rules 3–7 are checked
against 130 CMR 519–520 and a MassHealth-knowledgeable reviewer signs off; the
spec/plan records which rules are confirmed.

Integration: the ACA-3-AP `REDIRECT_SACA2` link and `application-checks.ts` warning
route to the real SACA-2 flow; SACA-2 emits `REDIRECT_ACA3` the other way.

### 4.5 Document checklist
Derived from answers: pay stubs/pension statements; 60 months of account statements
(facility applicants); deeds, tax bills, loan balances; life-insurance first pages and
cash-surrender letter if face value > $1,500/person; annuity contracts; trust
documents; vehicle registrations/loan proof; LTC policies; 2 years of tax returns or
IRS 4506; immigration documents; Medicare cards; employer coverage (Supp D);
premium bills; **ARD-1122** when a representative signs; guardianship proof where
applicable.

### 4.6 PDF fill
- Template at `resources/forms/saca2-2026-08.pdf`, read server-side only, **pinned by
  sha256**; mismatch fails loudly.
- `scripts/saca2-extract-fields.ts` regenerates `pdf/field-inventory.json`; rerunning
  after a reissue shows exactly what changed.
- Field map is hand-authored; Person 1/2 share one question table with two name
  columns; multi-widget fields are checked individually before mapping.
- **Overflow:** rows beyond available fields (form has 2 rows per asset table) go to
  generated attachment sheets headed with Person 1 name + SSN (as the form instructs).
- **Page selection:** Supplements A–D, ARD-1122, IRS 4506 included only when triggered;
  voter form/mailing pages excluded unless needed.
- **Never auto-filled:** signatures, signature dates, SNAP/consent signatures,
  voter-registration Yes/No (unless explicitly answered).
- Output stays editable (not flattened).
- Route `POST /api/forms/saca2/fill`: `requireAuthenticatedUser`, Zod validation,
  ownership/social-worker authorization (§7), PHI never logged (ids/counts only),
  response buffered, nothing stored, rate-limited like other PDF routes.

**As built (plan `docs/superpowers/plans/2026-10-18-saca2-pdf-fill.md`):**
- **Flow:** on the last step, Finish shows a completion panel (`Saca2Download`). The
  client posts `{ applicationId, wizardState }` (the full `buildSaca2Snapshot` data,
  in memory only; `X-Acting-For-Patient` when acting for a patient). The route checks
  auth, the flag (404 when off), the rate limit, and the draft's ownership and type
  (404 / 409), then shape-checks the answers with `normalizeSaca2State` (422; the client validates step by step, the route does not re-run the step rules),
  fills the pinned template, and returns the PDF as a buffered (not streamed) attachment
  (`SACA-2-application.pdf`, `Cache-Control: no-store`). Nothing is stored; only ids
  are logged.
- **Pages:** the voter-registration pages (idx 40-41) are always kept on purpose; the blank voter form is included as a
  handout. The owner may trim them.
- **Unprintable characters:** the fill uses the standard WinAnsi font, so other characters print as "?". The route counts
  them and sets `X-Saca2-Substituted-Chars: <n>` (only when above zero); the download panel then warns the user. Embedding
  Unicode fonts is an open owner decision (`saca2-pdf-owner-decisions.md` C5).
- **Limits:** 10 downloads per user per 10 minutes (429); 200 KB body cap, checked on
  `Content-Length` and on the bytes actually read (413). Answers that cannot be placed
  on the form (the `Saca2FitError` cases) return 422 with a generic message and no
  answer content; the UI points the user at the long lists (IRS years, Supplement B
  people, Supplement D jobs) or support. Template hash mismatch is a 500.
- **Never filled:** signatures, signature dates, consents, and other signature-like
  fields are classified `NEVER_FILL` in the field map; a test fails if any such field
  is written. The completion panel says so persistently. Open per-field decisions are
  in `docs/superpowers/saca2-pdf-owner-decisions.md`.
- **Overflow and repeats:** extra rows go to generated continuation sheets headed with
  Person 1's name and SSN; Supplement B/C/D pages are duplicated for additional
  people/jobs (period-free copy field names); pages are included only when triggered.
  Output stays an editable AcroForm.

### 4.7 Rollout
Rollout flag: runtime env var `SACA2_ENABLED` (off by default), exposed to the client by the public route `GET /api/config/saca2` and the `useSaca2Enabled` hook. The unused `public.feature_flags` table is not used. A failed flag lookup fails closed to the notice. While off: the SACA-2 tile must **not** route into the ACA-3
wizard — show the official-PDF link / "coming soon" instead (this fixes the current
dead end independently of the rest of the work).

### 4.8 Chat intake and i18n
- Chat intake: new thin generic driver over `schema.ts` via `requirements.ts`
  (phase 5); ACA-3 intake untouched.
- i18n: UI chrome in the 6-language `lib/i18n` bundles; question labels/help
  machine-translated with the glossary's AI pipeline, each non-English screen
  labeled "reference translation — the official English form is submitted"; PDF
  always English; Step 10 attestations stay English with a plain-language summary.

### 4.9 Other touchpoints
`/application/new` dispatch; social-worker new/detail application pages; mobile
handoff shell; dashboard/status (labels already work via `getApplicationTypeLabel`);
`documents/parse-application`; **stretch:** prefill from an uploaded filled SACA-2 by
reading AcroForm values through the field map in reverse.

## 5. Testing

### 5.1 Unit
Every pure module: `visibility`, each engine rule, `document-checklist`,
`requirements`, encoders, `pdf-fill`.

### 5.2 Guards
- **Figures staleness** guard (pattern of the existing FPL guard), aware of
  mid-year effective dates.
- **Field-map integrity:** every mapped name exists in the inventory with matching
  type; every inventory field is mapped or on an explicit never-fill allowlist
  (signatures, office-use, buttons).
- **Template hash** equals the pinned sha256.
- **PHI keys:** the server strip and client split share `PHI_DATA_KEYS`; test that a
  SACA-2 save never leaves PHI in `draft_state`.

### 5.3 Fixtures
`data/saca2-synthetic-patient-cases.json`: single 65+ at home; couple with one spouse
in a nursing facility (spousal allowance, transfers); HCBS waiver applicant; 65+
parent of child <19 (→ `REDIRECT_ACA3`); mixed-age couple; applicant with a trust and
annuity; overflow (>2 accounts).

### 5.4 Integration / E2E
Fill → read back with `pdf-lib` and `pdftotext`; route auth/ownership cases; Playwright
journey for the nursing-facility couple, including keyboard-only navigation and
accessibility checks.

## 6. Build order (each phase shippable)

| Phase | Deliverable |
|---|---|
| 0 | `types`, step registry (`schema.ts`), `visibility`, `figures-2026` + staleness guard, synthetic cases, and a guard so SACA-2 drafts show a notice instead of the ACA-3 wizard (plan `2026-10-13-saca2-foundation.md`). Question-level schema and the `saca2_enabled` flag move to Phase 1, where the renderer and the wizard they gate are built. |
| 1 | `Saca2Wizard`, step renderer, question model/validation, flag, PHI-safe save/resume for: intake, Person 1/2, AI/AN, previous bills, who-signs (plan `2026-10-13-saca2-wizard-core.md`). **1b** is split into three plans: **1b-1** (plan `2026-10-14-saca2-remaining-steps.md`: previous-bills detail, Step 5 assets, Steps 6–7 health insurance and HRAs, Steps 8–9 PCA and additional coverage, Step 10 signer details), **1b-2** (plan `2026-10-14-saca2-supplements.md`: Supplements A–D and the ARD-1122 / IRS 4506 attachment data — done once merged), and **1b-3** (plan `2026-10-16-saca2-person-details.md`: remaining Person-block questions: optional demographics, tax/Health Connector, accommodations, pregnancy/foster care, deductions, rental/one-time/seasonal/self-employment income — done once merged), and the **pre-flag gate** (plan `2026-10-17-saca2-flag-gate.md`: the gate before the flag — done once merged). The flag stays off until 1b-3 ships and the pre-flag gate items from the Phase 1 final review are done. |
| 2 | Field inventory, `pdf-field-map`, `pdf-fill`, `/api/forms/saca2/fill`, template hash, coverage test, wizard download (plan `2026-10-18-saca2-pdf-fill.md` — done once merged) |
| 3 | `eligibility-engine`, `document-checklist`, redirects, results panel; 130 CMR confirmation of rules 3–7 |
| 4 | 6-language strings and reference translations |
| 5 | Chat intake driver |
| 6 | Social-worker, dashboard, mobile touchpoints; Playwright e2e + a11y; docs updates; flag rollout |
| Stretch | Prefill from an uploaded filled SACA-2 |

## 7. Open items (resolve in the implementation plan, in code)
1. ~~Ownership / social-worker authorization~~ — resolved: `getApplicationDraft(userId, applicationId, actingFor)` in `lib/db/application-drafts.ts` (the `X-Acting-For-Patient` path used by `GET /api/applications/[applicationId]/draft`). The fill route reuses it.
2. ~~Feature-flag reader~~ — resolved: env var `SACA2_ENABLED` + `GET /api/config/saca2` (plan 2, Task 8). Deploy workflows (`.github/workflows/deploy-staging.yml`, `deploy-prod.yml`) must pass `SACA2_ENABLED` to turn it on; leave it unset or `false` until Phase 1b ships.
3. **Policy review** — named reviewer for engine rules 3–7 (130 CMR 519–520).
4. **Form version** — confirm with MassHealth whether `2026-08` supersedes the
   March 2026 revision described in EOM 26-03; store the PDF footer value.
5. **Translation review** — who reviews machine-translated question text.

## 8. Risks
- Annual reissue of the form and mid-year figure changes → inventory script, hash
  check, effective-dated constants.
- Liability of eligibility output → screening-only labelling everywhere; unconfirmed
  rules → `NEEDS_REVIEW`.
- Size of the field map (1,149 fields) → integrity/coverage tests make gaps fail the build.
- PHI exposure via a new data shape → key-parity test, no PHI in `draft_state`,
  PHI never logged.
