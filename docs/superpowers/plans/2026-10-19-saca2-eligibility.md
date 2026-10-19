# SACA-2 Eligibility Screening and Document Checklist (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every finished SACA-2 wizard a screening estimate (eight individually tested rules, statuses `LIKELY_ELIGIBLE | NEEDS_REVIEW | LIKELY_INELIGIBLE | PENDING_DOCUMENTS | REDIRECT_ACA3`) and a document checklist, shown in the wizard's completion panel and labelled a screening estimate. Rules not yet confirmed against 130 CMR 519–520 can never produce anything but `NEEDS_REVIEW`. The plan also connects the ACA-3 / ACA-3-AP "use SACA-2" signals and the SACA-2 "use ACA-3" signal to the real application chooser.

**Architecture:** A **visible-input reader** (`eligibility/inputs.ts`) turns `Saca2Answers` into a small typed `Saca2EligibilityInputs` object. It reads only what the wizard shows, through the same `createVisibleReader` / `isStepVisible` / `householdHasSpouse` the PDF fill uses, so stale hidden answers can never change a result. Money becomes whole cents and every income frequency becomes a monthly amount. Eight **pure rule functions** (`eligibility/rules/*.ts`) each take those inputs plus the effective-dated `SACA2_FIGURES` and return a raw verdict, findings and estimates. The **engine** (`eligibility-engine.ts`) runs the rules and applies the **policy registry** (`eligibility/policy.ts`): a rule whose `confirmed` flag is false has any pass, fail or documents verdict turned into `review`. A test keeps that flag in step with the table in `docs/superpowers/saca2-policy-review.md`. The engine then adds up the status, builds the **document checklist** and returns a result that reuses `EligibilityFinding` / `EligibilityRuleResult`. The engine runs **client-side only** in the completion panel. Nothing is persisted and there is no new server route. The engine never throws: it falls back to `NEEDS_REVIEW` with a generic message. The `SACA2_ENABLED` flag stays **off**.

**Tech Stack:** TypeScript, React (client component), Next.js `Link`, Vitest + React Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-13-saca2-application-design.md`, especially §3.1 (target populations), §3.2 (figures), §4.1 (units), §4.3 (PHI), §4.4 (engine and policy gate), §4.5 (checklist), §5.1/§5.3 (unit tests, fixtures), §6 Phase 3, §7.3, and §8. Builds on plans `2026-10-13-saca2-foundation.md` … `2026-10-18-saca2-pdf-fill.md` (all on `dev`).

## Scope and sequence

| Plan | Content | Status |
|---|---|---|
| 1 … 3 | foundation → wizard, all question content, flag gate, PDF fill | merged |
| **4 (this file)** | eligibility screening engine, document checklist, redirects, results panel, policy-review record | ready |
| 5 | i18n, chat intake, social-worker / dashboard / mobile touchpoints, Playwright journeys, flag rollout | after 4 |

## What the code looks like today (verified 2026-10-19)

- **Shared result types** (`lib/masshealth/types.ts`): `EligibilityFinding = { code; level: "error" | "warning" | "info" | "success"; message }` and `EligibilityRuleResult = { id; label; status: "pass" | "fail" | "warning"; message }`. Each engine's **result** type declares its own `status` union inline (`Aca3EligibilityResult`, `Aca3ApEligibilityResult`). So SACA-2 gets its own `Saca2EligibilityResult` with its own status union, and the shared types need **no change**. `EligibilityRuleStatus` has no "review" value. SACA-2 maps `review` / `documents` to `"warning"`.
- **Consumers of eligibility results:** `grep -rl "rule_results\|EligibilityRuleResult\|Aca3EligibilityResult\|Aca3ApEligibilityResult" app components lib hooks` finds only the two engines, `lib/masshealth/types.ts`, `components/application/aca3/types.ts` (type re-exports for the ACA-3 validation panel), and `components/application/aca3/form-wizard-submit-step.tsx`. That last file computes the ACA-3 result in component state and never stores it. **No dashboard, social-worker or mobile view renders eligibility findings for any application type**, and no result is persisted. So the consumers to update are none, and "renders unchanged" holds because SACA-2 keeps the same finding and rule-result shapes. Plan 5 decides whether any touchpoint shows a SACA-2 status.
- **ACA-3-AP redirect:** `evaluateAca3ApEligibility` sets `status = "REDIRECT_SACA2"` for age 65+ (RULE 08) but has **no UI consumer** and no link. **ACA-3 warning:** `application-checks.ts` `checkAgeThresholds` pushes `age.{i}.senior` ("may need form SACA-2 …"), rendered by `components/application/ApplicationChecksPanel.tsx` with no link. `components/application/aca3/types.ts` has no SACA-2 reference. The chooser `/application/type?recommended=<type>` already highlights a type (`app/application/type/page.tsx` → `recommendedParam`; precedent `lib/eligibility-engine.ts` `actionHref: '/application/type?recommended=hsn'`), and a SACA-2 draft opened while the flag is off shows the unavailable notice (plan 2c). That chooser URL is "the real SACA-2 flow" entry point.
- **Answers:** `Saca2Answers` (`lib/masshealth/saca2/types.ts`). Money is a JS `number` in dollars or `null`. The field component (`saca2-field.tsx` `parseNumber`) stores `Number(raw)` when finite. A restored or tampered blob could carry strings, NaN or negatives, so the engine sanitizes. Income rows are `{ kind, amount, frequency, isLoss? }` with `IncomeFrequency = weekly | every2weeks | twiceMonthly | monthly | quarterly | yearly | oneTime`. Self-employment, capital gains and farming/fishing rows carry a monthly net amount and **no frequency** (`MONTHLY_NET_KINDS` in `questions/person-income.ts`).
- **Visibility mechanism to reuse:** `createVisibleReader(answers, on)` in `lib/masshealth/saca2/pdf/visible-reader.ts` (`get` / `rows` / `isVisible`; it throws on unknown paths, naming only the path). `isStepVisible` is in `visibility.ts`. `householdHasSpouse(reader, answers, on)` is in `pdf/derived-assets.ts`. It is true only when Person 1's *visible* married answer is "yes" and the Person 2 step is visible. With no spouse, spouse-side values are absent, never "No". `pdf/derived-assets.ts` and `visible-reader.ts` have no runtime import of `pdf-fill`, `template` or `pdf-lib` (the `pdf-fill` import is `import type`), so they are safe in a client bundle.
- **Figures:** `SACA2_FIGURES`, `getFplRow`, `getEffectiveFigure` in `lib/masshealth/saca2/figures-2026.ts`. Effective-dated: `mmmnaMin` and `standardShelterExpense` switch 2026-07-01, `snapUtility.heat` / `noHeat` switch 2026-10-01. `getFplRow(n > 8)` extrapolates. `getFplRow(0)` and `getEffectiveFigure` before the first entry both throw.
- **Fixtures:** `lib/masshealth/saca2/synthetic-cases.ts` holds the seven spec §5.3 cases (there is **no** `data/saca2-synthetic-patient-cases.json`; this plan extends the TS file rather than adding a duplicate JSON). Several cases carry values the wizard would hide (income without `hasIncome: "yes"`, asset rows with unanswered gates, Supplement A transfers with unanswered transfer questions). Task 13 makes them consistent, without changing their visible steps. Complete, validated fixtures are in `lib/masshealth/saca2/__tests__/complete-answers.ts`.
- **Completion panel:** `components/application/saca2/saca2-wizard.tsx`, `section[data-testid="saca2-complete"]`, renders `<Saca2Download …>` (which has one `role="note"`; the wizard test calls `within(panel).getByRole("note")`, so the new panel **must not add another `role="note"`**).

## Answer paths each rule reads (all through the visible reader)

Person paths are read with `stepId: "person1"` and `person: 0 | 1` (the reader then gates Person 2 on the `person2` step). Root paths are absolute.

| Input | Step / path |
|---|---|
| Age (via `calculateAge`, on the screening date) | person `dateOfBirth` |
| Applying | person `applyingForCoverage` |
| Residency (Q14 / Q24) | person `residentOfMassachusetts` |
| Child < 19 caregiver, children's ages | person `caregiverOfChildUnder19`; repeater `caregiverChildren` key `dateOfBirth` |
| Citizenship / immigration | person `usCitizenOrNational`, `hasEligibleImmigrationStatus`, `immigrationStatus` (slug from `IMMIGRATION_STATUS_OPTIONS`, form p.32) |
| Proof waiver | person `hasMedicareOrSsiOrSsdi` |
| Living with Person 1 / in an institution | person `livesWithPerson1`, `inInstitution` |
| Income | person `hasIncome`; repeater `income` keys `kind`, `amount`, `frequency`, `isLoss`; repeater `rental.units` keys `amount`, `isLoss`; repeater `oneTimeIncome.thisYearItems` (count) |
| Programs | intake `intake.programs.masshealthHsn` / `longTermCare` / `hcbsWaiver` |
| Screening routes | intake `screening.disabledAndWorkingQualifies`, `screening.commonHealthTenYears` |
| Asset gates | assets `assets.gates.<category>` (12 categories) |
| Asset rows | assets `assets.bankAccounts` (`open`, `currentBalance`), `assets.primaryResidence` / `assets.otherRealEstate` (`currentValue`), `assets.lifeInsurance` (`faceValue`, `cashSurrenderValue`), `assets.securities` (`kind`, `currentValue`), `assets.annuities` (count), `assets.assistedLivingDeposits` (count), `assets.vehicles` (`fairMarketValue`, `amountOwed`), `assets.burial` (count), `assets.trusts` (`revocable`, `currentPrincipal`) |
| Supplement A route answers | suppA `supplements.a.needsNursingFacility`, `.applyingHcbsWaiver`, `.applyingPace`, `.intendsToReturnHome`, `.facility.paysGuardianshipExpenses` |
| Spouse at home expenses (Supp A Q2–4) | suppA `supplements.a.spouseMonthlyExpenses.rent`, `.mortgage`, `.homeownersInsurance`, `.realEstateTaxes`, `.condoOrCoopFee`, `.paysHeat`, `.paysUtilities`; `supplements.a.familyAtHome.hasFamily` |
| Transfers (60 months) | suppA `supplements.a.transferAnswers.{trust,income,assets,deed,addedToDeed,loanOrNote,annuity}`; repeater `transfers` keys `dateOfTransfer`, `amount` |
| Home | suppA `supplements.a.home.ownsHome`; repeater `supplements.a.home.properties` keys `ownershipType`, `fairMarketValue`; `supplements.a.home.{spouse,childUnder21,disabledChild,dependentRelative}.livesInHome` |
| Deposit, LTC insurance, tax returns | suppA `supplements.a.facilityDeposit.gaveDeposit`; repeater `supplements.a.longTermCareInsurance.policies` (count); `supplements.a.taxReturnsFiled`, `supplements.a.hasCopiesOfTaxReturns` |
| Medicare / MSP (Step 6) | healthInsurance `health.hasMedicare`; repeater `health.medicare` keys `hasPartD`, `hasMedigap`; `health.wantsPartBHelp` |
| Paperwork | signature `signature.signedBy`; ard `attachments.ard.section`; steps `suppD`, `irs4506` visible |

## Data gaps (inputs a spec rule needs that the wizard does not collect)

Each gap resolves to `NEEDS_REVIEW` or is stated in the estimate. Nothing is invented. Wizard questions are **not** added in this plan. They are owner decisions (O-items below).

| # | Rule | Gap | Behavior here |
|---|---|---|---|
| G1 | 3 | Annuity **value** (rows have owner, institution, contract number, purchase date only) | Any annuity → rule 3 `review` (`SACA2_ANNUITY_REVIEW`) |
| G2 | 3 | Asset **owner** (applicant vs spouse) except vehicles/burial | Household assets combined; spouse share not separated |
| G3 | 3, checklist | Life-insurance owner per policy (free-text `owners`) | Face-value threshold applied to the household: $1,500 × (2 with a spouse, else 1) |
| G4 | 4 | Home **equity** (no mortgage-balance question); co-owner shares | Fair-market value used as an upper bound; shared ownership over the limit → `review` |
| G5 | 6 | Medigap / Part D premium amounts; LTC-insurance premium frequency | Patient-paid-amount estimate subtracts only Part B (and only for the applicant) |
| G6 | 6 | Which Medicare row belongs to which person (`personName` is free text) | Part B premium attributed to Person 1 |
| G7 | 5 | Application / "baseline" date for the look-back | Look-back anchored to the screening date (today) |
| G8 | 7 | Family-allowance amounts for family at home | `familyAtHome = yes` → rule 7 `review` (`SACA2_FAMILY_ALLOWANCE_NOT_ESTIMATED`) |
| G9 | 3 | Refundable share of an assisted-living deposit | Any deposit → rule 3 `review` |
| G10 | 3 | Whether a trust not ticked "revocable" is really irrevocable | Any non-revocable trust → rule 3 `review`, not counted |

## Decisions made here (easy to change)

1. **Client-side, not persisted.** The completion panel computes the result from in-memory answers with `useMemo`. Nothing goes to the server, storage, logs or URLs. Reason: PHI stays where it already is (the encrypted blob and memory, spec §4.3). A server evaluation would need a new authenticated, rate-limited, no-storage route like `app/api/forms/saca2/fill/route.ts`, for no benefit, because no server consumer exists. If plan 5 wants a dashboard badge, persist only `{ status, rule ids with effective verdicts }` (no amounts, no names), and justify it there.
2. **Confirmation gating is data plus a drift test.** `SACA2_RULE_POLICY[ruleId].confirmed` is the only switch. The engine turns an unconfirmed rule's `pass` / `fail` / `documents` into `review` and appends an "unconfirmed" note. A test parses the table in `docs/superpowers/saca2-policy-review.md` and fails if the doc and the code disagree. It also fails if a gated rule (3–7) is marked confirmed without a named reviewer, an ISO date and a `130 CMR 519.x` / `520.x` citation. Flipping a rule is one line in `policy.ts` plus one table row, in the same commit.
3. **Rules 1, 2, 8 are marked confirmed (form-derived).** Spec §4.4 limits the 130 CMR gate to rules 3–7. Rules 1, 2 and 8 come from the form text and EOM 26-03 and never produce an approval on their own: rule 2 never passes a noncitizen, and rule 8 is informational. The owner can require review for them by flipping their rows to `no` (O1).
4. **Precedence:** `redirect` > `fail` > `review` > `documents` > `pass` / `notApplicable`. These map to `REDIRECT_ACA3` > `LIKELY_INELIGIBLE` > `NEEDS_REVIEW` > `PENDING_DOCUMENTS` > `LIKELY_ELIGIBLE`. `PENDING_DOCUMENTS` means every rule passed but MassHealth must see a proof before deciding (today: a citizen applicant who does not get Medicare, SSI or SSDI must prove citizenship and identity, form p.2).
5. **Over-limit income is `review`, never `fail`.** A deductible, a Medicare Savings Program or CommonHealth may still apply. An over-limit asset total is `fail` (`LIKELY_INELIGIBLE`) once rule 3 is confirmed, because missing data can only add assets.
6. **Cents everywhere.** Money is converted once to whole cents (`Math.round(x * 100)`). Rules add integers. Estimates are reported in dollars with cents.
7. **The engine never throws.** `evaluateSaca2Eligibility` wraps everything and falls back to `NEEDS_REVIEW` with `SACA2_SCREENING_ERROR` and a generic message. The panel also catches.
8. **No names in results.** Findings say "Person 1" / "Person 2". Amounts appear only in user-facing finding text and estimates, which are rendered and never logged or stored.

## Global Constraints

- Run commands from `/Users/blee/dev/masshealth-repo/mHealth-app` with Node 22: `export PATH=/Users/blee/.nvm/versions/node/v22.23.0/bin:$PATH` (the shell default cannot run vitest).
- Status vocabulary, exactly: `LIKELY_ELIGIBLE | NEEDS_REVIEW | LIKELY_INELIGIBLE | PENDING_DOCUMENTS | REDIRECT_ACA3`. There is no `APPROVED` anywhere in SACA-2 code or copy.
- Reuse `EligibilityFinding` / `EligibilityRuleResult` from `lib/masshealth/types.ts` unchanged. SACA-2-only data (`rules[]` with `confirmed`, `estimates`, `document_checklist`) lives in additional fields.
- Every surface labels the result a **screening estimate**: `result.screening_label` (constant `SACA2_SCREENING_LABEL`) and the panel heading and label.
- Anything unconfirmed resolves to `NEEDS_REVIEW` (never a guess, never an approval). Missing or invalid inputs resolve to `review`, never to a default.
- Figures come only from `SACA2_FIGURES`, `getFplRow` and `getEffectiveFigure` (`lib/masshealth/saca2/figures-2026.ts`). The engine takes `figures` and `onDate` parameters, and every effective-dated figure is read for `onDate`. The one figure this plan adds (`lifeInsuranceFaceValuePerPerson: 1500`, form Step 5 help) goes into `SACA2_FIGURES`.
- Rules read only **visible** answers, through `readSaca2EligibilityInputs` (built on `createVisibleReader`, `isStepVisible`, `householdHasSpouse`). No rule reads `Saca2Answers` directly. Spouse-side logic runs only when `householdHasSpouse` is true.
- PHI: the engine runs on in-memory answers only. It never calls `console.*`, never writes storage, never puts data in a URL, and is never sent to the server. The result is not persisted.
- Client-bundle safety: no module in the engine's import graph may have a runtime import of `pdf-lib`, `server-only`, `node:*`, `pdf/pdf-fill` or `pdf/template` (enforced by a test in Task 12).
- `SACA2_ENABLED` stays off; no workflow or env changes.
- ACA-3 and ACA-3-AP behavior is unchanged except for two **additive optional** fields (`Aca3ApEligibilityResult.redirect_href`, `ApplicationCheckResult.actionHref` / `actionLabel`) and the link the checks panel renders for them.
- Tests: Vitest + RTL in the default jsdom environment. **Never** add `// @vitest-environment node`. Tests live in `__tests__/` next to the module and import with `@/`.
- Repo style: 2-space indent, no semicolons, double quotes, and the header `/**\n * @author: Bin Lee\n * @email: blee@comura.ai\n */` on every new `.ts` / `.tsx` file (tests included).
- Git: never `git checkout` / `stash` / `reset`. Stage only the files the task lists. Leave `test-results.json`, `next-env.d.ts` and `.codex/` alone. Commit messages end with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Each line names the input or condition, the expected behavior, and the task whose tests pin it.

1. **Stale hidden answers never change an outcome.** Income rows with `hasIncome = no`, asset rows under a "No" gate, Person 2 data after "married → no", Supplement A transfers after LTC is unticked, and a married answer hidden because Person 1 is not applying are all ignored. → Task 3 (reader), Task 11 (checklist), Task 12 (engine end-to-end).
2. **Couple where only one spouse applies or is institutionalized.** Facility applicant with a spouse at home uses the community-spouse band and spousal allowance. A community couple with one spouse applying uses $3,000 with a note. Both spouses in a facility, or married and living apart, gives `review`. A Person 2 who is not a spouse is never treated as one. → Tasks 3, 6, 9, 10.
3. **Income frequencies normalized to monthly:** weekly ×52/12, every 2 weeks ×26/12, twice monthly ×2, quarterly ÷3, yearly ÷12, one-time excluded plus `review`, monthly-net kinds signed by `isLoss`, rental losses, total clamped at 0. → Tasks 1, 9, 10.
4. **Money values that are strings, NaN, negative, Infinity or over $1,000,000,000** become `invalid` → `review`. Dollars become whole cents with no float drift (0.1 + 0.2 → 30 cents). → Tasks 1, 3, 6.
5. **Ages at boundaries on the as-of date:** 64 vs 65 on the birthday (route), a child 18 vs 19 on the birthday (redirect vs conflict). → Tasks 3, 4.
6. **Transfers on the window edge:** a transfer exactly 60 months before the screening date counts, one day earlier does not, future dates are `review`, and Feb 29 clamps. Penalty days are rounded down. → Tasks 1, 8.
7. **Effective-date switches:** MMMNA minimum and shelter standard on 2026-06-30 vs 2026-07-01, SNAP utility on 2026-09-30 vs 2026-10-01, MMMNA cap. → Task 9.
8. **Family size beyond 8 and corrupt sizes:** size 9 uses the extrapolated row, size 0 is `review` and does not throw. → Task 10.
9. **An engine exception never crashes the completion panel:** malformed answers, an invalid date, or figures with no effective entry degrade to `NEEDS_REVIEW` with a generic message. → Tasks 12, 15.
10. **Screening label on every surface,** and no `APPROVED` anywhere. → Tasks 12, 15.
11. **No PHI in logs, URLs or storage:** no `console.*` calls, no storage writes, no fetch, static hrefs only, no names in the result. → Tasks 12, 14, 15.
12. **Confirmation cannot drift:** doc vs code mismatch fails. A gated rule confirmed without a reviewer, date and citation fails. Removing a rule from the gated list fails. → Tasks 2, 12.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/masshealth/saca2/eligibility/types.ts` | All eligibility types: rule ids, verdicts, statuses, routes, inputs, estimates, result, document ids |
| `lib/masshealth/saca2/eligibility/money.ts` | Dollars → cents sanitizing, frequency → monthly, totals, formatting |
| `lib/masshealth/saca2/eligibility/dates.ts` | ISO day, 60-month look-back start, ISO date check |
| `lib/masshealth/saca2/eligibility/outcome.ts` | `finding`, `outcome`, `worstVerdict` |
| `lib/masshealth/saca2/eligibility/policy.ts` | Rule labels and `confirmed` flags; gated rule list; doc path |
| `lib/masshealth/saca2/eligibility/inputs.ts` | `readSaca2EligibilityInputs(answers, on)` (visible answers only) |
| `lib/masshealth/saca2/eligibility/routes.ts` | `determineRoutes(inputs)` |
| `lib/masshealth/saca2/eligibility/income-sum.ts` | `monthlyIncomeOf(person)` |
| `lib/masshealth/saca2/eligibility/rules/residency-route.ts` | Rule 1 |
| `lib/masshealth/saca2/eligibility/rules/citizenship.ts` | Rule 2 |
| `lib/masshealth/saca2/eligibility/rules/assets.ts` | Rule 3 |
| `lib/masshealth/saca2/eligibility/rules/home-equity.ts` | Rule 4 |
| `lib/masshealth/saca2/eligibility/rules/transfers.ts` | Rule 5 |
| `lib/masshealth/saca2/eligibility/rules/income.ts` | Rule 6 |
| `lib/masshealth/saca2/eligibility/rules/spousal-allowance.ts` | Rule 7 |
| `lib/masshealth/saca2/eligibility/rules/medicare.ts` | Rule 8 |
| `lib/masshealth/saca2/document-checklist.ts` | `buildSaca2DocumentChecklist(inputs, figures)` |
| `lib/masshealth/saca2/eligibility-engine.ts` | `evaluateSaca2Eligibility(answers, figures, onDate, options)`, fallback, label |
| `lib/masshealth/saca2/synthetic-cases.ts` (modify) | Consistent answers + `expectedScreening` per case |
| `lib/applications/navigation.ts` (modify) | `buildRecommendedApplicationTypeHref(type)` |
| `lib/masshealth/aca3ap-eligibility-engine.ts`, `lib/masshealth/types.ts` (modify) | `redirect_href` on `REDIRECT_SACA2` |
| `lib/masshealth/application-checks.ts`, `components/application/ApplicationChecksPanel.tsx` (modify) | Senior warning links to the SACA-2 chooser |
| `components/application/saca2/saca2-screening-result.tsx` | Results panel |
| `components/application/saca2/saca2-wizard.tsx` (modify) | Render the panel in `saca2-complete` |
| `docs/superpowers/saca2-policy-review.md` | Policy-verification record (rules 1–8) |

---

### Task 1: Shared eligibility primitives (types, money, dates, outcomes)

**Files:**
- Create: `lib/masshealth/saca2/eligibility/types.ts`
- Create: `lib/masshealth/saca2/eligibility/money.ts`
- Create: `lib/masshealth/saca2/eligibility/dates.ts`
- Create: `lib/masshealth/saca2/eligibility/outcome.ts`
- Test: `lib/masshealth/saca2/eligibility/__tests__/money.test.ts`
- Test: `lib/masshealth/saca2/eligibility/__tests__/dates.test.ts`
- Test: `lib/masshealth/saca2/eligibility/__tests__/outcome.test.ts`

**Interfaces:**
- Consumes: `IncomeFrequency`, `AssetCategory`, `YesNo` (`lib/masshealth/saca2/types.ts`); `SACA2_FIGURES` (type only); `isRealIsoDate` (`questions/validate.ts`); `EligibilityFinding`, `EligibilityFindingLevel`, `EligibilityRuleResult` (`lib/masshealth/types.ts`).
- Produces (exact names used by every later task):
  - `types.ts`: `Saca2Figures`, `SACA2_RULE_IDS`, `Saca2RuleId`, `Saca2RuleVerdict`, `Saca2ScreeningStatus`, `Saca2Route`, `Saca2IncomeLine`, `Saca2PersonInputs`, `SACA2_TRANSFER_KEYS`, `Saca2TransferKey`, `Saca2SpouseExpenses`, `Saca2SuppAInputs`, `Saca2AssetInputs`, `Saca2EligibilityInputs`, `Saca2Estimates`, `emptyEstimates()`, `Saca2RuleOutcome`, `Saca2RuleReport`, `Saca2DocumentId`, `Saca2DocumentItem`, `Saca2EligibilityResult`.
  - `money.ts`: `INVALID_AMOUNT`, `AmountInput`, `MAX_DOLLARS`, `toCents(value: unknown): AmountInput`, `dollarsToCents(n: number): number`, `centsToDollars(c: number): number`, `isRecurringFrequency(v: unknown)`, `toMonthlyCents(cents: number, frequency: unknown): number | null`, `totalCents(values: readonly AmountInput[]): { total: number; missing: number; invalid: number }`, `formatDollars(cents: number): string`.
  - `dates.ts`: `isoDay(on: Date): string`, `isoMonthsBefore(on: Date, months: number): string`, `isIsoDate(value: unknown): value is string`.
  - `outcome.ts`: `finding(code, level, message): EligibilityFinding`, `outcome(id, verdict, message, findings?, estimates?): Saca2RuleOutcome`, `worstVerdict(verdicts): Saca2RuleVerdict`.

- [ ] **Step 1: Write the failing tests**

`lib/masshealth/saca2/eligibility/__tests__/money.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import {
  INVALID_AMOUNT,
  centsToDollars,
  dollarsToCents,
  formatDollars,
  toCents,
  toMonthlyCents,
  totalCents,
} from "@/lib/masshealth/saca2/eligibility/money"

describe("toCents", () => {
  it("converts finite non-negative dollars to whole cents", () => {
    expect(toCents(0)).toBe(0)
    expect(toCents(12.34)).toBe(1234)
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents(1_000_000_000)).toBe(100_000_000_000)
  })

  it("treats null and undefined as missing", () => {
    expect(toCents(null)).toBeNull()
    expect(toCents(undefined)).toBeNull()
  })

  it("marks strings, NaN, Infinity, negatives and huge values invalid", () => {
    expect(toCents("1200")).toBe(INVALID_AMOUNT)
    expect(toCents(Number.NaN)).toBe(INVALID_AMOUNT)
    expect(toCents(Number.POSITIVE_INFINITY)).toBe(INVALID_AMOUNT)
    expect(toCents(-1)).toBe(INVALID_AMOUNT)
    expect(toCents(1_000_000_000.01)).toBe(INVALID_AMOUNT)
    expect(toCents({})).toBe(INVALID_AMOUNT)
  })
})

describe("toMonthlyCents", () => {
  it("normalizes every recurring frequency to a monthly amount", () => {
    expect(toMonthlyCents(25_000, "weekly")).toBe(108_333)
    expect(toMonthlyCents(40_000, "every2weeks")).toBe(86_667)
    expect(toMonthlyCents(50_000, "twiceMonthly")).toBe(100_000)
    expect(toMonthlyCents(100_000, "monthly")).toBe(100_000)
    expect(toMonthlyCents(300_000, "quarterly")).toBe(100_000)
    expect(toMonthlyCents(1_200_000, "yearly")).toBe(100_000)
  })

  it("returns null for one-time, missing, unknown and prototype keys", () => {
    expect(toMonthlyCents(100_000, "oneTime")).toBeNull()
    expect(toMonthlyCents(100_000, null)).toBeNull()
    expect(toMonthlyCents(100_000, "daily")).toBeNull()
    expect(toMonthlyCents(100_000, "__proto__")).toBeNull()
    expect(toMonthlyCents(100_000, "constructor")).toBeNull()
  })
})

describe("totalCents", () => {
  it("adds numbers and counts missing and invalid entries", () => {
    expect(totalCents([100, null, INVALID_AMOUNT, 250])).toEqual({ total: 350, missing: 1, invalid: 1 })
    expect(totalCents([])).toEqual({ total: 0, missing: 0, invalid: 0 })
  })
})

describe("dollar helpers", () => {
  it("round-trips and formats", () => {
    expect(dollarsToCents(4066.5)).toBe(406_650)
    expect(centsToDollars(406_650)).toBe(4066.5)
    expect(formatDollars(320_000)).toBe("$3,200")
    expect(formatDollars(276_650)).toBe("$2,766.50")
  })
})
```

`lib/masshealth/saca2/eligibility/__tests__/dates.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { isIsoDate, isoDay, isoMonthsBefore } from "@/lib/masshealth/saca2/eligibility/dates"

describe("dates", () => {
  it("isoDay uses the UTC calendar day", () => {
    expect(isoDay(new Date("2026-10-13T12:00:00Z"))).toBe("2026-10-13")
  })

  it("isoMonthsBefore keeps the day and clamps to the month's last day", () => {
    expect(isoMonthsBefore(new Date("2026-10-13T12:00:00Z"), 60)).toBe("2021-10-13")
    expect(isoMonthsBefore(new Date("2028-02-29T12:00:00Z"), 60)).toBe("2023-02-28")
    expect(isoMonthsBefore(new Date("2026-03-31T12:00:00Z"), 1)).toBe("2026-02-28")
    expect(isoMonthsBefore(new Date("2026-01-15T12:00:00Z"), 13)).toBe("2024-12-15")
  })

  it("isIsoDate accepts only real YYYY-MM-DD strings", () => {
    expect(isIsoDate("2024-02-29")).toBe(true)
    expect(isIsoDate("2026-02-30")).toBe(false)
    expect(isIsoDate("03/15/2024")).toBe(false)
    expect(isIsoDate(null)).toBe(false)
    expect(isIsoDate(20240315)).toBe(false)
  })
})
```

`lib/masshealth/saca2/eligibility/__tests__/outcome.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { finding, outcome, worstVerdict } from "@/lib/masshealth/saca2/eligibility/outcome"
import { SACA2_RULE_IDS, emptyEstimates } from "@/lib/masshealth/saca2/eligibility/types"

describe("outcome helpers", () => {
  it("orders verdicts redirect > fail > review > documents > pass > notApplicable", () => {
    expect(worstVerdict(["pass", "documents"])).toBe("documents")
    expect(worstVerdict(["documents", "review", "pass"])).toBe("review")
    expect(worstVerdict(["review", "fail"])).toBe("fail")
    expect(worstVerdict(["fail", "redirect", "pass"])).toBe("redirect")
    expect(worstVerdict(["notApplicable", "pass"])).toBe("pass")
    expect(worstVerdict([])).toBe("notApplicable")
  })

  it("builds findings and outcomes with empty defaults", () => {
    expect(finding("X", "info", "m")).toEqual({ code: "X", level: "info", message: "m" })
    expect(outcome("SACA2_R8_MEDICARE_MSP", "pass", "ok")).toEqual({
      id: "SACA2_R8_MEDICARE_MSP",
      verdict: "pass",
      message: "ok",
      findings: [],
      estimates: {},
    })
  })

  it("lists the eight rule ids in order and empty estimates are all null", () => {
    expect(SACA2_RULE_IDS).toEqual([
      "SACA2_R1_RESIDENCY_ROUTE",
      "SACA2_R2_CITIZENSHIP",
      "SACA2_R3_ASSETS",
      "SACA2_R4_HOME_EQUITY",
      "SACA2_R5_TRANSFERS",
      "SACA2_R6_INCOME",
      "SACA2_R7_SPOUSAL_ALLOWANCE",
      "SACA2_R8_MEDICARE_MSP",
    ])
    const e = emptyEstimates()
    expect(e.routes).toEqual([])
    expect(Object.entries(e).filter(([k]) => k !== "routes").every(([, v]) => v === null)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/masshealth/saca2/eligibility`
Expected: FAIL with "Failed to resolve import" for the four new modules.

- [ ] **Step 3: Implement**

`lib/masshealth/saca2/eligibility/types.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding, EligibilityRuleResult } from "@/lib/masshealth/types"
import type { SACA2_FIGURES } from "../figures-2026"
import type { AssetCategory, YesNo } from "../types"
import type { AmountInput } from "./money"

type Widen<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : T extends object
        ? { readonly [K in keyof T]: Widen<T[K]> }
        : T

/** The figures table the engine reads (`SACA2_FIGURES` widened so tests can pass a modified copy). */
export type Saca2Figures = Widen<typeof SACA2_FIGURES>

export const SACA2_RULE_IDS = [
  "SACA2_R1_RESIDENCY_ROUTE",
  "SACA2_R2_CITIZENSHIP",
  "SACA2_R3_ASSETS",
  "SACA2_R4_HOME_EQUITY",
  "SACA2_R5_TRANSFERS",
  "SACA2_R6_INCOME",
  "SACA2_R7_SPOUSAL_ALLOWANCE",
  "SACA2_R8_MEDICARE_MSP",
] as const
export type Saca2RuleId = (typeof SACA2_RULE_IDS)[number]

/** What one rule concludes on its own, before confirmation gating. */
export type Saca2RuleVerdict = "pass" | "fail" | "review" | "documents" | "redirect" | "notApplicable"

export type Saca2ScreeningStatus =
  | "LIKELY_ELIGIBLE"
  | "NEEDS_REVIEW"
  | "LIKELY_INELIGIBLE"
  | "PENDING_DOCUMENTS"
  | "REDIRECT_ACA3"

export type Saca2Route =
  | "senior"
  | "nursingFacility"
  | "hcbsWaiver"
  | "pace"
  | "mixedAgeCouple"
  | "disabledWorking"
  | "commonHealthTenYears"

export interface Saca2IncomeLine {
  kind: string | null
  amount: AmountInput
  frequency: string | null
  isLoss: boolean
}

/** One person block as the wizard shows it. `null` = hidden or unanswered. */
export interface Saca2PersonInputs {
  index: 0 | 1
  age: number | null
  applying: boolean
  resident: YesNo | null
  caregiverOfChildUnder19: YesNo | null
  /** Ages on the screening date of the children listed under the caregiver question (null = no valid date). */
  childAges: Array<number | null>
  citizen: YesNo | null
  hasEligibleImmigrationStatus: YesNo | null
  immigrationStatus: string | null
  hasMedicareOrSsiOrSsdi: YesNo | null
  livesWithPerson1: YesNo | null
  inInstitution: YesNo | null
  hasIncome: YesNo | null
  income: Saca2IncomeLine[]
  rental: Array<{ amount: AmountInput; isLoss: boolean }>
  oneTimeIncomeThisYear: number
}

export const SACA2_TRANSFER_KEYS = ["trust", "income", "assets", "deed", "addedToDeed", "loanOrNote", "annuity"] as const
export type Saca2TransferKey = (typeof SACA2_TRANSFER_KEYS)[number]

export interface Saca2SpouseExpenses {
  rent: AmountInput
  mortgage: AmountInput
  homeownersInsurance: AmountInput
  realEstateTaxes: AmountInput
  condoOrCoopFee: AmountInput
  paysHeat: YesNo | null
  paysUtilities: YesNo | null
}

export interface Saca2SuppAInputs {
  needsNursingFacility: YesNo | null
  applyingHcbsWaiver: YesNo | null
  applyingPace: YesNo | null
  intendsToReturnHome: YesNo | null
  paysGuardianshipExpenses: YesNo | null
  /** Null when the spouse-expense questions are hidden (no facility need, or no Person 2). */
  spouseExpenses: Saca2SpouseExpenses | null
  familyAtHome: YesNo | null
  transferAnswers: Record<Saca2TransferKey, YesNo | null>
  transfers: Array<{ date: string | null; amount: AmountInput }>
  gaveFacilityDeposit: YesNo | null
  ownsHome: YesNo | null
  homes: Array<{ ownershipType: string | null; fairMarketValue: AmountInput }>
  occupants: { spouse: boolean; childUnder21: boolean; disabledChild: boolean; dependentRelative: boolean }
  ltcPolicies: number
  taxReturnsFiled: "bothYears" | "oneYear" | "neither" | null
  hasCopiesOfTaxReturns: YesNo | null
}

export interface Saca2AssetInputs {
  gates: Record<AssetCategory, YesNo | null>
  bankAccounts: Array<{ open: boolean; balance: AmountInput }>
  primaryResidence: AmountInput[]
  otherRealEstate: AmountInput[]
  lifeInsurance: Array<{ faceValue: AmountInput; cashSurrenderValue: AmountInput }>
  securities: Array<{ kind: string | null; value: AmountInput }>
  annuities: number
  deposits: number
  vehicles: Array<{ fairMarketValue: AmountInput; amountOwed: AmountInput }>
  burial: number
  trusts: Array<{ revocable: boolean | null; principal: AmountInput }>
}

export interface Saca2EligibilityInputs {
  /** Person 1, then Person 2 only when the Person 2 step is visible. */
  persons: Saca2PersonInputs[]
  /** `householdHasSpouse`: Person 1's visible married answer is yes and the Person 2 step is visible. */
  hasSpouse: boolean
  /** Community household size: 1, or 2 when the spouse lives with Person 1. */
  householdSize: number
  programs: { masshealthHsn: boolean; longTermCare: boolean; hcbsWaiver: boolean }
  screening: { disabledAndWorkingQualifies: YesNo | null; commonHealthTenYears: YesNo | null }
  /** Null when Supplement A is hidden. */
  suppA: Saca2SuppAInputs | null
  assets: Saca2AssetInputs
  health: { hasMedicare: boolean; medigapOrPartD: boolean; wantsPartBHelp: YesNo | null; employerCoverageSupplement: boolean }
  paperwork: {
    signedBy: "applicant" | "authorizedRepresentative" | "responsibleParty" | null
    ardSection: "applicantDesignates" | "cannotDesignate" | "appointedByLaw" | null
    irs4506Needed: boolean
  }
}

/** Dollar amounts (two decimals). Every value is an estimate, never a decision. */
export interface Saca2Estimates {
  routes: Saca2Route[]
  householdSize: number | null
  monthlyIncome: number | null
  fplPercent: number | null
  incomeLimit: { kind: "fpl100" | "specialIncomeLimit"; monthly: number } | null
  countableAssets: number | null
  assetLimit: number | null
  communitySpouseResource: { min: number; max: number } | null
  homeEquityOverLimit: boolean | null
  transfersInWindow: { count: number; total: number; penaltyDays: number; lookBackStart: string } | null
  spousalAllowance: { mmmna: number; excessShelter: number; allowance: number } | null
  patientPaidAmount: number | null
  partBPremium: number | null
}

export function emptyEstimates(): Saca2Estimates {
  return {
    routes: [],
    householdSize: null,
    monthlyIncome: null,
    fplPercent: null,
    incomeLimit: null,
    countableAssets: null,
    assetLimit: null,
    communitySpouseResource: null,
    homeEquityOverLimit: null,
    transfersInWindow: null,
    spousalAllowance: null,
    patientPaidAmount: null,
    partBPremium: null,
  }
}

export interface Saca2RuleOutcome {
  id: Saca2RuleId
  verdict: Saca2RuleVerdict
  message: string
  findings: EligibilityFinding[]
  estimates: Partial<Saca2Estimates>
}

export interface Saca2RuleReport {
  id: Saca2RuleId
  label: string
  /** From the policy registry; false until a named reviewer confirms the rule (rules 3–7). */
  confirmed: boolean
  verdict: Saca2RuleVerdict
  /** The verdict after gating: an unconfirmed pass / fail / documents becomes review. */
  effective_verdict: Saca2RuleVerdict
}

export type Saca2DocumentId =
  | "payStubs"
  | "benefitStatements"
  | "rentalIncome"
  | "accountStatements"
  | "realEstate"
  | "lifeInsurance"
  | "cashSurrenderLetter"
  | "securities"
  | "annuities"
  | "trusts"
  | "vehicles"
  | "burial"
  | "facilityDeposit"
  | "transfers"
  | "spouseExpenses"
  | "familyIncome"
  | "ltcInsurance"
  | "taxReturns"
  | "irs4506"
  | "guardianshipExpenses"
  | "immigration"
  | "citizenshipIdentity"
  | "medicareCard"
  | "premiumBills"
  | "employerCoverage"
  | "ard1122"
  | "legalAuthority"

export interface Saca2DocumentItem {
  id: Saca2DocumentId
  label: string
  reason: string
}

export interface Saca2EligibilityResult {
  status: Saca2ScreeningStatus
  screening_label: string
  findings: EligibilityFinding[]
  rule_results: EligibilityRuleResult[]
  rules: Saca2RuleReport[]
  estimates: Saca2Estimates
  required_documents: string[]
  document_checklist: Saca2DocumentItem[]
  /** Present only for REDIRECT_ACA3: the application chooser with ACA-3 highlighted (no applicant data). */
  redirect_href?: string
}
```

`lib/masshealth/saca2/eligibility/money.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { IncomeFrequency } from "../types"

export const INVALID_AMOUNT = "invalid" as const
/** Whole cents; `null` = not answered or not visible; INVALID_AMOUNT = not a usable amount. */
export type AmountInput = number | null | typeof INVALID_AMOUNT

/** Anything larger is treated as a typo or tampering, not a real amount. */
export const MAX_DOLLARS = 1_000_000_000

export function toCents(value: unknown): AmountInput {
  if (value === null || value === undefined) return null
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_DOLLARS) return INVALID_AMOUNT
  return Math.round(value * 100)
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100
}

type RecurringFrequency = Exclude<IncomeFrequency, "oneTime">

/** [numerator, denominator] that turn one payment into a monthly amount. */
const MONTHLY_FACTOR: Record<RecurringFrequency, readonly [number, number]> = {
  weekly: [52, 12],
  every2weeks: [26, 12],
  twiceMonthly: [2, 1],
  monthly: [1, 1],
  quarterly: [1, 3],
  yearly: [1, 12],
}

export function isRecurringFrequency(value: unknown): value is RecurringFrequency {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MONTHLY_FACTOR, value)
}

/** Monthly equivalent in cents, or null when the frequency is one-time, missing, or unknown. */
export function toMonthlyCents(cents: number, frequency: unknown): number | null {
  if (!isRecurringFrequency(frequency)) return null
  const [numerator, denominator] = MONTHLY_FACTOR[frequency]
  return Math.round((cents * numerator) / denominator)
}

export function totalCents(values: readonly AmountInput[]): { total: number; missing: number; invalid: number } {
  let total = 0
  let missing = 0
  let invalid = 0
  for (const value of values) {
    if (value === null) missing += 1
    else if (value === INVALID_AMOUNT) invalid += 1
    else total += value
  }
  return { total, missing, invalid }
}

export function formatDollars(cents: number): string {
  const whole = Math.round(cents) % 100 === 0
  return `$${(Math.round(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}
```

`lib/masshealth/saca2/eligibility/dates.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { isRealIsoDate } from "../questions/validate"

export function isoDay(on: Date): string {
  return on.toISOString().slice(0, 10)
}

/** The same calendar day `months` months earlier (UTC), clamped to the last day of a shorter month. */
export function isoMonthsBefore(on: Date, months: number): string {
  const monthIndex = on.getUTCFullYear() * 12 + on.getUTCMonth() - months
  const year = Math.floor(monthIndex / 12)
  const month = monthIndex - year * 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(on.getUTCDate(), lastDay)
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && isRealIsoDate(value)
}
```

`lib/masshealth/saca2/eligibility/outcome.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding, EligibilityFindingLevel } from "@/lib/masshealth/types"
import type { Saca2Estimates, Saca2RuleId, Saca2RuleOutcome, Saca2RuleVerdict } from "./types"

export function finding(code: string, level: EligibilityFindingLevel, message: string): EligibilityFinding {
  return { code, level, message }
}

export function outcome(
  id: Saca2RuleId,
  verdict: Saca2RuleVerdict,
  message: string,
  findings: EligibilityFinding[] = [],
  estimates: Partial<Saca2Estimates> = {},
): Saca2RuleOutcome {
  return { id, verdict, message, findings, estimates }
}

const RANK: Record<Saca2RuleVerdict, number> = {
  notApplicable: 0,
  pass: 1,
  documents: 2,
  review: 3,
  fail: 4,
  redirect: 5,
}

export function worstVerdict(verdicts: readonly Saca2RuleVerdict[]): Saca2RuleVerdict {
  return verdicts.reduce<Saca2RuleVerdict>((worst, verdict) => (RANK[verdict] > RANK[worst] ? verdict : worst), "notApplicable")
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/masshealth/saca2/eligibility && npx tsc --noEmit -p tsconfig.json`
Expected: PASS; tsc reports no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/eligibility/types.ts lib/masshealth/saca2/eligibility/money.ts lib/masshealth/saca2/eligibility/dates.ts lib/masshealth/saca2/eligibility/outcome.ts lib/masshealth/saca2/eligibility/__tests__/money.test.ts lib/masshealth/saca2/eligibility/__tests__/dates.test.ts lib/masshealth/saca2/eligibility/__tests__/outcome.test.ts
git commit -m "feat(saca2): add eligibility types, cents money helpers, and look-back dates

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Policy registry, policy-review record, and the drift gate

**Files:**
- Create: `lib/masshealth/saca2/eligibility/policy.ts`
- Create: `docs/superpowers/saca2-policy-review.md`
- Test: `lib/masshealth/saca2/eligibility/__tests__/policy.test.ts`

**Interfaces:**
- Consumes: `SACA2_RULE_IDS`, `Saca2RuleId` (Task 1).
- Produces: `Saca2RulePolicyEntry = { label: string; confirmed: boolean }`, `Saca2RulePolicy = Record<Saca2RuleId, Saca2RulePolicyEntry>`, `SACA2_RULE_POLICY`, `SACA2_POLICY_GATED_RULES: readonly Saca2RuleId[]` (rules 3–7), `SACA2_POLICY_REVIEW_DOC = "docs/superpowers/saca2-policy-review.md"`.

- [ ] **Step 1: Write the failing test**

`lib/masshealth/saca2/eligibility/__tests__/policy.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  SACA2_POLICY_GATED_RULES,
  SACA2_POLICY_REVIEW_DOC,
  SACA2_RULE_POLICY,
} from "@/lib/masshealth/saca2/eligibility/policy"
import { SACA2_RULE_IDS } from "@/lib/masshealth/saca2/eligibility/types"

interface PolicyRow {
  id: string
  confirmed: string
  reviewer: string
  date: string
  regulation: string
}

const START = "<!-- policy-table:start -->"
const END = "<!-- policy-table:end -->"
const PLACEHOLDERS = new Set(["", "-", "—", "pending", "tbd", "n/a (form-derived)"])

function parsePolicyTable(markdown: string): PolicyRow[] {
  const start = markdown.indexOf(START)
  const end = markdown.indexOf(END)
  if (start < 0 || end < start) throw new Error("policy table markers are missing")
  const lines = markdown
    .slice(start + START.length, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
  const [header, , ...body] = lines
  const columns = header.split("|").slice(1, -1).map((cell) => cell.trim())
  const column = (name: string) => {
    const index = columns.indexOf(name)
    if (index < 0) throw new Error(`policy table has no "${name}" column`)
    return index
  }
  return body.map((line) => {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim())
    return {
      id: cells[column("Rule id")],
      confirmed: cells[column("Confirmed")],
      reviewer: cells[column("Reviewer")],
      date: cells[column("Date")],
      regulation: cells[column("Regulation checked")],
    }
  })
}

const rows = parsePolicyTable(readFileSync(path.join(process.cwd(), SACA2_POLICY_REVIEW_DOC), "utf8"))

describe("SACA-2 policy confirmation gate", () => {
  it("has exactly one table row per rule id", () => {
    expect(rows.map((row) => row.id).sort()).toEqual([...SACA2_RULE_IDS].sort())
  })

  it("keeps rules 3-7 behind the 130 CMR review gate (spec §4.4)", () => {
    expect(SACA2_POLICY_GATED_RULES).toEqual([
      "SACA2_R3_ASSETS",
      "SACA2_R4_HOME_EQUITY",
      "SACA2_R5_TRANSFERS",
      "SACA2_R6_INCOME",
      "SACA2_R7_SPOUSAL_ALLOWANCE",
    ])
  })

  it.each(SACA2_RULE_IDS)("%s: the doc's Confirmed column matches the code", (id) => {
    const row = rows.find((r) => r.id === id)
    expect(row?.confirmed === "yes" || row?.confirmed === "no", `Confirmed must be yes or no for ${id}`).toBe(true)
    expect(row?.confirmed === "yes").toBe(SACA2_RULE_POLICY[id].confirmed)
  })

  it.each(SACA2_POLICY_GATED_RULES)("%s: a confirmed gated rule names a reviewer, a date, and a 130 CMR citation", (id) => {
    const row = rows.find((r) => r.id === id)
    if (!SACA2_RULE_POLICY[id].confirmed) return
    expect(PLACEHOLDERS.has((row?.reviewer ?? "").toLowerCase())).toBe(false)
    expect(row?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(row?.regulation).toMatch(/130 CMR 5(19|20)\.\d+/)
  })

  it("gives every rule a non-empty label", () => {
    for (const id of SACA2_RULE_IDS) expect(SACA2_RULE_POLICY[id].label.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/policy.test.ts`
Expected: FAIL with "Failed to resolve import ... eligibility/policy".

- [ ] **Step 3: Implement the registry and the record**

`lib/masshealth/saca2/eligibility/policy.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2RuleId } from "./types"

export interface Saca2RulePolicyEntry {
  label: string
  /**
   * True only once the rule's logic is confirmed. Rules 3-7 need a named MassHealth-knowledgeable reviewer
   * and a 130 CMR 519-520 citation recorded in docs/superpowers/saca2-policy-review.md (a test keeps the
   * two in step). While false, the engine turns this rule's pass / fail / documents into review.
   */
  confirmed: boolean
}

export type Saca2RulePolicy = Record<Saca2RuleId, Saca2RulePolicyEntry>

export const SACA2_POLICY_REVIEW_DOC = "docs/superpowers/saca2-policy-review.md"

/** Spec §4.4: these rules must be checked against 130 CMR 519-520 before they can be confirmed. */
export const SACA2_POLICY_GATED_RULES: readonly Saca2RuleId[] = [
  "SACA2_R3_ASSETS",
  "SACA2_R4_HOME_EQUITY",
  "SACA2_R5_TRANSFERS",
  "SACA2_R6_INCOME",
  "SACA2_R7_SPOUSAL_ALLOWANCE",
]

export const SACA2_RULE_POLICY: Saca2RulePolicy = {
  SACA2_R1_RESIDENCY_ROUTE: { label: "Residency and application route", confirmed: true },
  SACA2_R2_CITIZENSHIP: { label: "Citizenship and immigration", confirmed: true },
  SACA2_R3_ASSETS: { label: "Countable assets", confirmed: false },
  SACA2_R4_HOME_EQUITY: { label: "Home equity", confirmed: false },
  SACA2_R5_TRANSFERS: { label: "Transfers in the 60-month look-back", confirmed: false },
  SACA2_R6_INCOME: { label: "Income", confirmed: false },
  SACA2_R7_SPOUSAL_ALLOWANCE: { label: "Spousal allowance (MMMNA)", confirmed: false },
  SACA2_R8_MEDICARE_MSP: { label: "Medicare and Medicare Savings Programs", confirmed: true },
}
```

`docs/superpowers/saca2-policy-review.md` (exact content; keep `|` out of cell text, because the test splits on it):

```markdown
# SACA-2 screening rules: policy-verification record

The SACA-2 eligibility engine (`lib/masshealth/saca2/eligibility-engine.ts`) gives a **screening estimate**,
never a decision. Spec §4.4 requires that rules 3–7 be checked against **130 CMR 519–520** by a named
MassHealth-knowledgeable reviewer before they count. Until then the engine turns any result from those
rules into `NEEDS_REVIEW`.

## How to confirm a rule

1. The reviewer reads the rule's logic below and in its file (`lib/masshealth/saca2/eligibility/rules/*.ts`),
   checks it against the regulation, and lists any corrections. Corrections are code changes with tests, made first.
2. In **one commit**: set the row's `Confirmed` to `yes`, fill `Reviewer` (full name and role), `Date` (YYYY-MM-DD)
   and `Regulation checked` (for example `130 CMR 520.003`), and set `confirmed: true` for the same id in
   `lib/masshealth/saca2/eligibility/policy.ts`.
3. `npx vitest run lib/masshealth/saca2/eligibility/__tests__/policy.test.ts` must pass. It fails if the table and
   the code disagree, or if a rule from 3–7 is marked confirmed without a reviewer, a date and a 130 CMR citation.

To withdraw a confirmation, set both back to `no` / `false` in one commit.

## Status

<!-- policy-table:start -->
| Rule id | Rule | Logic source | Regulation checked | Confirmed | Reviewer | Date | Notes |
|---|---|---|---|---|---|---|---|
| SACA2_R1_RESIDENCY_ROUTE | Residency and application route | Form Q14 and Q24 (residency); EOM 26-03 target populations (spec §3.1) | — (not gated, spec §4.4) | yes | n/a (form-derived) | 2026-10-19 | Never approves on its own; redirect to ACA-3 for a child-under-19 caregiver not needing facility care |
| SACA2_R2_CITIZENSHIP | Citizenship and immigration | Form Q12–13; eligible-status list form p.32; proof waiver form p.2 | — (not gated, spec §4.4) | yes | n/a (form-derived) | 2026-10-19 | Never passes a noncitizen; MassHealth decides coverage type |
| SACA2_R3_ASSETS | Countable assets | Spec §4.4 rule 3; form Step 5 help text | pending (130 CMR 520) | no | — | — | See rule 3 below |
| SACA2_R4_HOME_EQUITY | Home equity | Spec §4.4 rule 4; Supplement A Q8–16 | pending (130 CMR 520) | no | — | — | Uses value, not equity (data gap G4) |
| SACA2_R5_TRANSFERS | Transfers in the 60-month look-back | Spec §4.4 rule 5; Supplement A Q6 | pending (130 CMR 520) | no | — | — | Penalty days are an estimate |
| SACA2_R6_INCOME | Income | Spec §4.4 rule 6; DG-FPL_2026-03 | pending (130 CMR 519–520) | no | — | — | See rule 6 below |
| SACA2_R7_SPOUSAL_ALLOWANCE | Spousal allowance (MMMNA) | Spec §4.4 rule 7; Supplement A Q2–4 | pending (130 CMR 520) | no | — | — | Family allowance not estimated |
| SACA2_R8_MEDICARE_MSP | Medicare and Medicare Savings Programs | Form Step 6; figures §3.2 | — (not gated, spec §4.4) | yes | n/a (form-derived) | 2026-10-19 | Informational only |
<!-- policy-table:end -->

Named reviewer: **open (spec §7.3).** The owner names the reviewer.

## Rule logic to review (plain words)

Figures are from `lib/masshealth/saca2/figures-2026.ts` and are read for the screening date.
"Review" means the result becomes `NEEDS_REVIEW`.

### Rule 1: residency and route (confirmed, form-derived)
- No one applying gives review. A child-under-19 caregiver (no facility need) gives a redirect to ACA-3. A child-under-19 caregiver who needs facility care gives review. A caregiver whose listed children are all 19 or older gives review.
- If no one applying lives in Massachusetts, the rule fails. If only some do, or an answer is missing, it gives review.
- Routes: 65+ applicant; nursing facility (LTC program box or Supplement A need); HCBS waiver; PACE; mixed-age married couple living together, both applying, one 65+ and no child caregiver; disabled and working; CommonHealth 10 years. No route gives review (ACA-3 may fit).

### Rule 2: citizenship and immigration (confirmed, form-derived)
- A citizen passes when they get Medicare, SSI or SSDI. Otherwise they need "documents" (proof of citizenship and identity).
- A noncitizen always gives review: a status on the p.32 list means MassHealth decides the coverage type, and no eligible status means limited coverage or the Health Safety Net may apply.

### Rule 3: countable assets (UNCONFIRMED)
- Counted: open bank and retirement accounts (current balance), other real estate, securities, the cash-surrender value of life insurance when total face value is over $1,500 per person (household: ×2 with a spouse), every vehicle except the one with the highest equity (value minus amount owed), and revocable trusts.
- Excluded: closed accounts, burial arrangements (all, per spec), and the primary residence unless the applicant is in a facility, does not intend to return, and no spouse, child under 21, disabled child or dependent relative lives there.
- Review: unanswered asset gates; missing or invalid amounts; any annuity (value not collected); any facility deposit; any trust not marked revocable.
- Limits: $2,000 single. $3,000 for a married couple living together (with a note when only one applies). Facility applicant with a spouse at home: pass up to $32,532 + $2,000, fail over $162,660 + $2,000, review in between. Both spouses in a facility, or married and living apart, gives review.
- Questions for the reviewer: Are IRAs, Keogh and pension funds countable as entered? Is all burial property excludable as the spec says, or only up to limits? Is $3,000 right when only one spouse applies? Is the community-spouse band right for Massachusetts (min/max standard)? Does the applicant's $2,000 come on top of the community-spouse amount?

### Rule 4: home equity (UNCONFIRMED)
- Applies to nursing-facility and HCBS-waiver applicants who own a home (Supplement A).
- Fails when a home's **fair-market value** is over $1,130,000, unless a spouse, child under 21 or disabled child lives there (then pass with a note). Gives review when the home is held in tenancy in common, joint tenancy or a life estate, or a value is missing.
- Questions: The wizard asks value, not equity (no mortgage balance). Should PACE be included? How should a co-owner's share be handled?

### Rule 5: transfers (UNCONFIRMED)
- Applies when Supplement A is shown. The window runs from 60 months before the screening date (inclusive) to the screening date.
- An unanswered transfer question gives review. A Yes to trust, deed, added-to-deed, loan or note, or annuity gives review. A missing date or amount, or a future date, gives review.
- Transfers in the window are summed. Estimated penalty days = total ÷ $450, rounded down. Any total over 0 gives review.
- Questions: Should the window be anchored to the application date or the date of institutionalization (data gap G7)? Rounding of penalty days? Which transfers are compensated?

### Rule 6: income (UNCONFIRMED)
- Monthly income: weekly ×52/12, every two weeks ×26/12, twice a month ×2, quarterly ÷3, yearly ÷12. Self-employment, capital gains and farming/fishing are monthly net, minus when a loss. Rental income is monthly net. One-time income is not counted and gives review. The total is floored at 0.
- Nursing facility, HCBS waiver or PACE: Person 1's income against the $2,982 special income limit. Over the limit gives review (a deductible may apply). Nursing facility: patient-paid amount = income − $72.80 − spousal allowance (rule 7) − Medicare Part B $202.90 (when Medicare is reported), floored at 0.
- Community: Person 1 plus a spouse living together, against 100% FPL for household size 1 or 2. Over the limit gives review (an MSP, CommonHealth or a deductible may apply).
- Review: missing income answers; a Person 2 who applies but is not a spouse; both spouses applying with long-term care.
- Questions: Are the FPL tier and the 100% threshold right for each 65+ community route? Are the deductions (pre-tax, Medigap and LTC premiums) right? Should PACE use the special income limit?

### Rule 7: spousal allowance (UNCONFIRMED)
- Applies when the applicant is in a nursing facility, has a spouse (householdHasSpouse) who is not in a facility, and the Supplement A spouse-expense questions are shown.
- Shelter = rent + mortgage + homeowner's insurance + real-estate taxes + condo or co-op fee + SNAP utility standard ($945 if the spouse pays heat, $575 if utilities but not heat, from 2026-10-01; earlier values before that date).
- Excess shelter = shelter − standard shelter expense ($811.50 from 2026-07-01). MMMNA = min($4,066.50, minimum MMMNA ($2,705.00 from 2026-07-01) + excess shelter). Allowance = MMMNA − spouse's own monthly income, floored at 0.
- Review: heat or utility answers missing; an invalid amount; spouse income unknown; family living with the spouse (family allowance not estimated).
- Questions: Is assisted-living room and board part of shelter? Family allowance formula?

### Rule 8: Medicare and MSP (confirmed, form-derived)
- No Medicare reported means the rule does not apply. With Medicare: an informational note about the Medicare Savings Programs (no asset limit), and a referral note when Part B help was requested. The Part B premium ($202.90 a month) is used in the rule 6 estimate.

## Data gaps (wizard does not collect)
G1 annuity value; G2 asset owner (except vehicles and burial); G3 life-insurance owner; G4 home equity and co-owner share;
G5 Medigap, Part D and LTC premium amounts; G6 which Medicare entry is whose; G7 application date for the look-back;
G8 family-allowance amounts; G9 refundable share of a facility deposit; G10 trusts not marked revocable.
Each one resolves to review or is stated in the estimate. Adding questions is an owner decision.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/policy.test.ts`
Expected: PASS. Sanity-check that the gate bites: temporarily set `SACA2_R3_ASSETS: { …, confirmed: true }` and re-run. Expected: FAIL in "%s: the doc's Confirmed column matches the code". Revert, then re-run: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/eligibility/policy.ts lib/masshealth/saca2/eligibility/__tests__/policy.test.ts docs/superpowers/saca2-policy-review.md
git commit -m "feat(saca2): add the screening-rule policy registry and its review record

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Visible-input reader and rule-test fixtures

**Files:**
- Create: `lib/masshealth/saca2/eligibility/inputs.ts`
- Create: `lib/masshealth/saca2/eligibility/__tests__/helpers.ts` (fixture builders used by Tasks 4–12; not a test file)
- Test: `lib/masshealth/saca2/eligibility/__tests__/inputs.test.ts`

**Interfaces:**
- Consumes: `createVisibleReader`, `VisibleReader` (`pdf/visible-reader.ts`); `householdHasSpouse` (`pdf/derived-assets.ts`); `isStepVisible`; `calculateAge`; `toCents`; the Task 1 input types.
- Produces: `readSaca2EligibilityInputs(answers: Saca2Answers, on: Date): Saca2EligibilityInputs`. Test helpers: `ON`, `cents(dollars)`, `incomeLine(kind, dollars, frequency?, isLoss?)`, `makePerson(overrides?)`, `makeAssets(overrides?)`, `makeSuppA(overrides?)`, `makeInputs(overrides?)`, `facilityCouple(overrides?)`.

- [ ] **Step 1: Write the fixture helpers and the failing test**

`lib/masshealth/saca2/eligibility/__tests__/helpers.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type {
  Saca2AssetInputs,
  Saca2EligibilityInputs,
  Saca2IncomeLine,
  Saca2PersonInputs,
  Saca2SuppAInputs,
} from "@/lib/masshealth/saca2/eligibility/types"

/** Fixed screening date for rule tests (fabricated data only). */
export const ON = new Date("2026-10-13T12:00:00Z")

export const cents = (dollars: number) => Math.round(dollars * 100)

export function incomeLine(kind: string, dollars: number, frequency: string | null = "monthly", isLoss = false): Saca2IncomeLine {
  return { kind, amount: cents(dollars), frequency, isLoss }
}

export function makePerson(overrides: Partial<Saca2PersonInputs> = {}): Saca2PersonInputs {
  return {
    index: 0,
    age: 70,
    applying: true,
    resident: "yes",
    caregiverOfChildUnder19: "no",
    childAges: [],
    citizen: "yes",
    hasEligibleImmigrationStatus: null,
    immigrationStatus: null,
    hasMedicareOrSsiOrSsdi: "yes",
    livesWithPerson1: null,
    inInstitution: "no",
    hasIncome: "no",
    income: [],
    rental: [],
    oneTimeIncomeThisYear: 0,
    ...overrides,
  }
}

export function makeAssets(overrides: Partial<Saca2AssetInputs> = {}): Saca2AssetInputs {
  return {
    gates: {
      bankAccounts: "no",
      retirementAccounts: "no",
      closedAccounts: "no",
      primaryResidence: "no",
      otherRealEstate: "no",
      lifeInsurance: "no",
      securities: "no",
      annuities: "no",
      assistedLivingDeposit: "no",
      vehicles: "no",
      burial: "no",
      trusts: "no",
    },
    bankAccounts: [],
    primaryResidence: [],
    otherRealEstate: [],
    lifeInsurance: [],
    securities: [],
    annuities: 0,
    deposits: 0,
    vehicles: [],
    burial: 0,
    trusts: [],
    ...overrides,
  }
}

export function makeSuppA(overrides: Partial<Saca2SuppAInputs> = {}): Saca2SuppAInputs {
  return {
    needsNursingFacility: "no",
    applyingHcbsWaiver: "no",
    applyingPace: "no",
    intendsToReturnHome: null,
    paysGuardianshipExpenses: null,
    spouseExpenses: null,
    familyAtHome: null,
    transferAnswers: { trust: "no", income: "no", assets: "no", deed: "no", addedToDeed: "no", loanOrNote: "no", annuity: "no" },
    transfers: [],
    gaveFacilityDeposit: "no",
    ownsHome: "no",
    homes: [],
    occupants: { spouse: false, childUnder21: false, disabledChild: false, dependentRelative: false },
    ltcPolicies: 0,
    taxReturnsFiled: null,
    hasCopiesOfTaxReturns: null,
    ...overrides,
  }
}

export function makeInputs(overrides: Partial<Saca2EligibilityInputs> = {}): Saca2EligibilityInputs {
  return {
    persons: [makePerson()],
    hasSpouse: false,
    householdSize: 1,
    programs: { masshealthHsn: true, longTermCare: false, hcbsWaiver: false },
    screening: { disabledAndWorkingQualifies: null, commonHealthTenYears: null },
    suppA: null,
    assets: makeAssets(),
    health: { hasMedicare: false, medigapOrPartD: false, wantsPartBHelp: null, employerCoverageSupplement: false },
    paperwork: { signedBy: "applicant", ardSection: null, irs4506Needed: false },
    ...overrides,
  }
}

/** Person 1 (82) in a nursing facility, spouse (80) at home and not applying; $900 rent, pays heat. */
export function facilityCouple(overrides: Partial<Saca2EligibilityInputs> = {}): Saca2EligibilityInputs {
  return makeInputs({
    persons: [
      makePerson({ age: 82, inInstitution: "yes", hasIncome: "yes", income: [incomeLine("socialSecurity", 2700)] }),
      makePerson({
        index: 1,
        age: 80,
        applying: false,
        resident: null,
        caregiverOfChildUnder19: null,
        citizen: null,
        hasMedicareOrSsiOrSsdi: null,
        livesWithPerson1: "no",
        inInstitution: "no",
        hasIncome: "yes",
        income: [incomeLine("socialSecurity", 1000)],
      }),
    ],
    hasSpouse: true,
    householdSize: 1,
    programs: { masshealthHsn: false, longTermCare: true, hcbsWaiver: false },
    suppA: makeSuppA({
      needsNursingFacility: "yes",
      spouseExpenses: {
        rent: cents(900),
        mortgage: null,
        homeownersInsurance: null,
        realEstateTaxes: null,
        condoOrCoopFee: null,
        paysHeat: "yes",
        paysUtilities: "yes",
      },
    }),
    ...overrides,
  })
}
```

`lib/masshealth/saca2/eligibility/__tests__/inputs.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { completeFacilityCouple, completeSingleSenior } from "@/lib/masshealth/saca2/__tests__/complete-answers"
import { readSaca2EligibilityInputs } from "@/lib/masshealth/saca2/eligibility/inputs"
import { INVALID_AMOUNT } from "@/lib/masshealth/saca2/eligibility/money"
import type { BankAccountRow } from "@/lib/masshealth/saca2/types"
import { ON } from "./helpers"

const bank = (overrides: Partial<BankAccountRow>): BankAccountRow => ({
  ownerName: "Test Person",
  accountType: "savings",
  institution: "Example Bank",
  accountNumber: "0001",
  currentBalance: 1000,
  balanceOnAdmissionDate: null,
  open: true,
  closedOn: null,
  balanceWhenClosed: null,
  ...overrides,
})

describe("readSaca2EligibilityInputs: what the wizard shows", () => {
  it("reads a single senior: one person, no spouse, household of one", () => {
    const inputs = readSaca2EligibilityInputs(completeSingleSenior(), ON)
    expect(inputs.persons).toHaveLength(1)
    expect(inputs.persons[0]).toMatchObject({ index: 0, age: 76, applying: true, resident: "yes", citizen: "yes", hasIncome: "no" })
    expect(inputs.hasSpouse).toBe(false)
    expect(inputs.householdSize).toBe(1)
    expect(inputs.suppA).toBeNull()
    expect(inputs.programs).toEqual({ masshealthHsn: true, longTermCare: false, hcbsWaiver: false })
  })

  it("reads the facility couple: spouse present, Supplement A values, assets, Medicare, ARD", () => {
    const inputs = readSaca2EligibilityInputs(completeFacilityCouple(), ON)
    expect(inputs.persons).toHaveLength(2)
    expect(inputs.hasSpouse).toBe(true)
    expect(inputs.householdSize).toBe(1)
    expect(inputs.persons[0]).toMatchObject({ age: 82, applying: true, inInstitution: "yes" })
    // Person 2 is not applying, so their residency question is hidden even though the fixture holds "yes".
    expect(inputs.persons[1]).toMatchObject({ index: 1, applying: false, resident: null, livesWithPerson1: "no" })
    expect(inputs.suppA).toMatchObject({
      needsNursingFacility: "yes",
      transfers: [{ date: "2024-03-15", amount: 3_000_000 }],
      homes: [{ ownershipType: "individual", fairMarketValue: 45_000_000 }],
      occupants: { spouse: false, childUnder21: false, disabledChild: false, dependentRelative: false },
      ownsHome: "yes",
    })
    expect(inputs.suppA?.spouseExpenses).toMatchObject({ rent: 120_000, mortgage: null, paysHeat: "yes", paysUtilities: "yes" })
    expect(inputs.assets.bankAccounts).toEqual([{ open: true, balance: 5_400_000 }])
    expect(inputs.assets.annuities).toBe(1)
    expect(inputs.health).toMatchObject({ hasMedicare: true, medigapOrPartD: true, wantsPartBHelp: "no" })
    expect(inputs.paperwork).toEqual({ signedBy: "authorizedRepresentative", ardSection: "applicantDesignates", irs4506Needed: false })
  })
})

describe("readSaca2EligibilityInputs: stale hidden answers are ignored", () => {
  it("drops income rows when hasIncome is No", () => {
    const a = completeSingleSenior()
    a.persons[0].hasIncome = "no"
    a.persons[0].income = [{ kind: "wages", amount: 9000, frequency: "monthly" }]
    expect(readSaca2EligibilityInputs(a, ON).persons[0].income).toEqual([])
  })

  it("drops bank rows when every bank gate is No", () => {
    const a = completeSingleSenior()
    a.assets.bankAccounts = [bank({ currentBalance: 50_000 })]
    expect(readSaca2EligibilityInputs(a, ON).assets.bankAccounts).toEqual([])
  })

  it("does not treat a remaining Person 2 as a spouse after married -> No", () => {
    const a = completeFacilityCouple()
    a.persons[0].isLegallyMarried = "no"
    const inputs = readSaca2EligibilityInputs(a, ON)
    expect(inputs.persons).toHaveLength(2) // Person 2 still holds data, so the step stays
    expect(inputs.hasSpouse).toBe(false)
    expect(inputs.householdSize).toBe(1)
  })

  it("does not treat Person 2 as a spouse when Person 1 is not applying (married question hidden)", () => {
    const a = completeFacilityCouple()
    a.persons[0].applyingForCoverage = "no"
    expect(readSaca2EligibilityInputs(a, ON).hasSpouse).toBe(false)
  })

  it("returns no Supplement A (and so no transfers) when long-term care is no longer selected", () => {
    const a = completeFacilityCouple()
    a.intake.programs.longTermCare = false
    a.supplements.a.needsNursingFacility = "no"
    expect(readSaca2EligibilityInputs(a, ON).suppA).toBeNull()
  })
})

describe("readSaca2EligibilityInputs: values", () => {
  it("marks a string amount invalid instead of trusting it", () => {
    const a = completeSingleSenior()
    a.persons[0].hasIncome = "yes"
    a.persons[0].income = [{ kind: "socialSecurity", amount: "1200" as unknown as number, frequency: "monthly" }]
    expect(readSaca2EligibilityInputs(a, ON).persons[0].income[0].amount).toBe(INVALID_AMOUNT)
  })

  it("computes ages on the screening date at the 64/65 and 18/19 boundaries", () => {
    const a = completeSingleSenior()
    a.persons[0].dateOfBirth = "1961-10-13"
    expect(readSaca2EligibilityInputs(a, ON).persons[0].age).toBe(65)
    a.persons[0].dateOfBirth = "1961-10-14"
    expect(readSaca2EligibilityInputs(a, ON).persons[0].age).toBe(64)

    a.persons[0].caregiverOfChildUnder19 = "yes"
    a.persons[0].caregiverChildren = [
      { name: "Test Child", dateOfBirth: "2007-10-13" },
      { name: "Test Child Two", dateOfBirth: "2007-10-14" },
    ]
    expect(readSaca2EligibilityInputs(a, ON).persons[0].childAges).toEqual([19, 18])
  })

  it("reads a closed account as closed with no current balance", () => {
    const a = completeSingleSenior()
    a.assets.gates.closedAccounts = "yes"
    a.assets.bankAccounts = [bank({ open: false, currentBalance: 700, closedOn: "2025-01-01", balanceWhenClosed: 700 })]
    expect(readSaca2EligibilityInputs(a, ON).assets.bankAccounts).toEqual([{ open: false, balance: null }])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/inputs.test.ts`
Expected: FAIL with "Failed to resolve import ... eligibility/inputs".

- [ ] **Step 3: Implement**

`lib/masshealth/saca2/eligibility/inputs.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { calculateAge } from "../age"
import { householdHasSpouse } from "../pdf/derived-assets"
import { createVisibleReader, type VisibleReader } from "../pdf/visible-reader"
import type { Saca2StepId } from "../schema"
import type { AssetCategory, Saca2Answers, YesNo } from "../types"
import { isStepVisible } from "../visibility"
import { toCents } from "./money"
import {
  SACA2_TRANSFER_KEYS,
  type Saca2AssetInputs,
  type Saca2EligibilityInputs,
  type Saca2PersonInputs,
  type Saca2SuppAInputs,
  type Saca2TransferKey,
} from "./types"

const ASSET_CATEGORIES: readonly AssetCategory[] = [
  "bankAccounts",
  "retirementAccounts",
  "closedAccounts",
  "primaryResidence",
  "otherRealEstate",
  "lifeInsurance",
  "securities",
  "annuities",
  "assistedLivingDeposit",
  "vehicles",
  "burial",
  "trusts",
]

interface View {
  answer(path: string): unknown
  rows(path: string): number
  cell(path: string, index: number, key: string): unknown
}

function rootView(reader: VisibleReader, stepId: Saca2StepId): View {
  return {
    answer: (path) => reader.get({ kind: "answer", stepId, path }),
    rows: (path) => reader.rows(stepId, path),
    cell: (path, index, key) => reader.get({ kind: "row", stepId, path, index, key }),
  }
}

/** Person blocks share one content table; `person` selects the block and its step gate. */
function personView(reader: VisibleReader, person: 0 | 1): View {
  return {
    answer: (path) => reader.get({ kind: "answer", stepId: "person1", path, person }),
    rows: (path) => reader.rows("person1", path, person),
    cell: (path, index, key) => reader.get({ kind: "row", stepId: "person1", path, index, key, person }),
  }
}

const yesNo = (value: unknown): YesNo | null => (value === "yes" || value === "no" ? value : null)
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null)
const indexes = (count: number): number[] => Array.from({ length: count }, (_, index) => index)

function readPerson(reader: VisibleReader, index: 0 | 1, on: Date): Saca2PersonInputs {
  const p = personView(reader, index)
  return {
    index,
    age: calculateAge(text(p.answer("dateOfBirth")), on),
    applying: p.answer("applyingForCoverage") === "yes",
    resident: yesNo(p.answer("residentOfMassachusetts")),
    caregiverOfChildUnder19: yesNo(p.answer("caregiverOfChildUnder19")),
    childAges: indexes(p.rows("caregiverChildren")).map((i) => calculateAge(text(p.cell("caregiverChildren", i, "dateOfBirth")), on)),
    citizen: yesNo(p.answer("usCitizenOrNational")),
    hasEligibleImmigrationStatus: yesNo(p.answer("hasEligibleImmigrationStatus")),
    immigrationStatus: text(p.answer("immigrationStatus")),
    hasMedicareOrSsiOrSsdi: yesNo(p.answer("hasMedicareOrSsiOrSsdi")),
    livesWithPerson1: yesNo(p.answer("livesWithPerson1")),
    inInstitution: yesNo(p.answer("inInstitution")),
    hasIncome: yesNo(p.answer("hasIncome")),
    income: indexes(p.rows("income")).map((i) => ({
      kind: text(p.cell("income", i, "kind")),
      amount: toCents(p.cell("income", i, "amount")),
      frequency: text(p.cell("income", i, "frequency")),
      isLoss: p.cell("income", i, "isLoss") === true,
    })),
    rental: indexes(p.rows("rental.units")).map((i) => ({
      amount: toCents(p.cell("rental.units", i, "amount")),
      isLoss: p.cell("rental.units", i, "isLoss") === true,
    })),
    oneTimeIncomeThisYear: p.rows("oneTimeIncome.thisYearItems"),
  }
}

function readSuppA(reader: VisibleReader, answers: Saca2Answers, on: Date): Saca2SuppAInputs | null {
  if (!isStepVisible("suppA", answers, on)) return null
  const s = rootView(reader, "suppA")
  const a = (path: string) => s.answer(`supplements.a.${path}`)
  const expensesShown = reader.isVisible({ kind: "answer", stepId: "suppA", path: "supplements.a.spouseMonthlyExpenses.paysHeat" })
  const livesInHome = (key: string) => a(`home.${key}.livesInHome`) === "yes"
  const filed = a("taxReturnsFiled")
  const HOMES = "supplements.a.home.properties"
  return {
    needsNursingFacility: yesNo(a("needsNursingFacility")),
    applyingHcbsWaiver: yesNo(a("applyingHcbsWaiver")),
    applyingPace: yesNo(a("applyingPace")),
    intendsToReturnHome: yesNo(a("intendsToReturnHome")),
    paysGuardianshipExpenses: yesNo(a("facility.paysGuardianshipExpenses")),
    spouseExpenses: expensesShown
      ? {
          rent: toCents(a("spouseMonthlyExpenses.rent")),
          mortgage: toCents(a("spouseMonthlyExpenses.mortgage")),
          homeownersInsurance: toCents(a("spouseMonthlyExpenses.homeownersInsurance")),
          realEstateTaxes: toCents(a("spouseMonthlyExpenses.realEstateTaxes")),
          condoOrCoopFee: toCents(a("spouseMonthlyExpenses.condoOrCoopFee")),
          paysHeat: yesNo(a("spouseMonthlyExpenses.paysHeat")),
          paysUtilities: yesNo(a("spouseMonthlyExpenses.paysUtilities")),
        }
      : null,
    familyAtHome: yesNo(a("familyAtHome.hasFamily")),
    transferAnswers: Object.fromEntries(
      SACA2_TRANSFER_KEYS.map((key) => [key, yesNo(a(`transferAnswers.${key}`))]),
    ) as Record<Saca2TransferKey, YesNo | null>,
    transfers: indexes(s.rows("transfers")).map((i) => ({
      date: text(s.cell("transfers", i, "dateOfTransfer")),
      amount: toCents(s.cell("transfers", i, "amount")),
    })),
    gaveFacilityDeposit: yesNo(a("facilityDeposit.gaveDeposit")),
    ownsHome: yesNo(a("home.ownsHome")),
    homes: indexes(s.rows(HOMES)).map((i) => ({
      ownershipType: text(s.cell(HOMES, i, "ownershipType")),
      fairMarketValue: toCents(s.cell(HOMES, i, "fairMarketValue")),
    })),
    occupants: {
      spouse: livesInHome("spouse"),
      childUnder21: livesInHome("childUnder21"),
      disabledChild: livesInHome("disabledChild"),
      dependentRelative: livesInHome("dependentRelative"),
    },
    ltcPolicies: s.rows("supplements.a.longTermCareInsurance.policies"),
    taxReturnsFiled: filed === "bothYears" || filed === "oneYear" || filed === "neither" ? filed : null,
    hasCopiesOfTaxReturns: yesNo(a("hasCopiesOfTaxReturns")),
  }
}

function readAssets(reader: VisibleReader): Saca2AssetInputs {
  const s = rootView(reader, "assets")
  const each = <T>(path: string, read: (i: number) => T): T[] => indexes(s.rows(path)).map(read)
  return {
    gates: Object.fromEntries(
      ASSET_CATEGORIES.map((category) => [category, yesNo(s.answer(`assets.gates.${category}`))]),
    ) as Record<AssetCategory, YesNo | null>,
    bankAccounts: each("assets.bankAccounts", (i) => ({
      open: s.cell("assets.bankAccounts", i, "open") !== false,
      balance: toCents(s.cell("assets.bankAccounts", i, "currentBalance")),
    })),
    primaryResidence: each("assets.primaryResidence", (i) => toCents(s.cell("assets.primaryResidence", i, "currentValue"))),
    otherRealEstate: each("assets.otherRealEstate", (i) => toCents(s.cell("assets.otherRealEstate", i, "currentValue"))),
    lifeInsurance: each("assets.lifeInsurance", (i) => ({
      faceValue: toCents(s.cell("assets.lifeInsurance", i, "faceValue")),
      cashSurrenderValue: toCents(s.cell("assets.lifeInsurance", i, "cashSurrenderValue")),
    })),
    securities: each("assets.securities", (i) => ({
      kind: text(s.cell("assets.securities", i, "kind")),
      value: toCents(s.cell("assets.securities", i, "currentValue")),
    })),
    annuities: s.rows("assets.annuities"),
    deposits: s.rows("assets.assistedLivingDeposits"),
    vehicles: each("assets.vehicles", (i) => ({
      fairMarketValue: toCents(s.cell("assets.vehicles", i, "fairMarketValue")),
      amountOwed: toCents(s.cell("assets.vehicles", i, "amountOwed")),
    })),
    burial: s.rows("assets.burial"),
    trusts: each("assets.trusts", (i) => {
      const revocable = s.cell("assets.trusts", i, "revocable")
      return {
        revocable: typeof revocable === "boolean" ? revocable : null,
        principal: toCents(s.cell("assets.trusts", i, "currentPrincipal")),
      }
    }),
  }
}

/**
 * The answers every screening rule may use, read exactly as the wizard shows them: a value is present only
 * when its step, person block, question (and repeater row) are visible, so stale answers behind a flipped
 * gate never change a result. Spouse-side values exist only when `householdHasSpouse` holds. Throws only on
 * a mapping bug (unknown path); the engine turns that into a NEEDS_REVIEW fallback.
 */
export function readSaca2EligibilityInputs(answers: Saca2Answers, on: Date): Saca2EligibilityInputs {
  const reader = createVisibleReader(answers, on)
  const persons: Saca2PersonInputs[] = [readPerson(reader, 0, on)]
  if (isStepVisible("person2", answers, on) && answers.persons[1] !== undefined) persons.push(readPerson(reader, 1, on))
  const hasSpouse = householdHasSpouse(reader, answers, on)
  const spouse = hasSpouse ? persons[1] : undefined
  const intake = rootView(reader, "intake")
  const health = rootView(reader, "healthInsurance")
  const medicareRows = indexes(health.rows("health.medicare"))
  const signedBy = reader.get({ kind: "answer", stepId: "signature", path: "signature.signedBy" })
  const ardSection = reader.get({ kind: "answer", stepId: "ard", path: "attachments.ard.section" })
  return {
    persons,
    hasSpouse,
    householdSize: 1 + (spouse?.livesWithPerson1 === "yes" ? 1 : 0),
    programs: {
      masshealthHsn: intake.answer("intake.programs.masshealthHsn") === true,
      longTermCare: intake.answer("intake.programs.longTermCare") === true,
      hcbsWaiver: intake.answer("intake.programs.hcbsWaiver") === true,
    },
    screening: {
      disabledAndWorkingQualifies: yesNo(intake.answer("screening.disabledAndWorkingQualifies")),
      commonHealthTenYears: yesNo(intake.answer("screening.commonHealthTenYears")),
    },
    suppA: readSuppA(reader, answers, on),
    assets: readAssets(reader),
    health: {
      hasMedicare: health.answer("health.hasMedicare") === true,
      medigapOrPartD: medicareRows.some(
        (i) => health.cell("health.medicare", i, "hasPartD") === "yes" || health.cell("health.medicare", i, "hasMedigap") === "yes",
      ),
      wantsPartBHelp: yesNo(health.answer("health.wantsPartBHelp")),
      employerCoverageSupplement: isStepVisible("suppD", answers, on),
    },
    paperwork: {
      signedBy:
        signedBy === "applicant" || signedBy === "authorizedRepresentative" || signedBy === "responsibleParty" ? signedBy : null,
      ardSection:
        ardSection === "applicantDesignates" || ardSection === "cannotDesignate" || ardSection === "appointedByLaw" ? ardSection : null,
      irs4506Needed: isStepVisible("irs4506", answers, on),
    },
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/masshealth/saca2/eligibility && npx tsc --noEmit -p tsconfig.json`
Expected: PASS. If the reader throws `No question at path …`, the path in `inputs.ts` is wrong. Compare it with the question file named in the "Answer paths" table, and do not change question files.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/eligibility/inputs.ts lib/masshealth/saca2/eligibility/__tests__/helpers.ts lib/masshealth/saca2/eligibility/__tests__/inputs.test.ts
git commit -m "feat(saca2): read screening inputs from visible answers only

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Routes and Rule 1 (residency, route, redirect to ACA-3)

**Files:**
- Create: `lib/masshealth/saca2/eligibility/routes.ts`
- Create: `lib/masshealth/saca2/eligibility/rules/residency-route.ts`
- Test: `lib/masshealth/saca2/eligibility/__tests__/residency-route.test.ts`

**Interfaces:**
- Consumes: `Saca2EligibilityInputs`, `Saca2Route` (Task 1); `finding`, `outcome` (Task 1); helpers (Task 3).
- Produces: `determineRoutes(inputs): Saca2Route[]`, `LONG_TERM_CARE_ROUTES: readonly Saca2Route[]` (`nursingFacility`, `hcbsWaiver`, `pace`), `hasAnyRoute(routes, wanted): boolean`, `evaluateResidencyRoute(inputs): Saca2RuleOutcome` (id `SACA2_R1_RESIDENCY_ROUTE`; sets `estimates.routes`).

- [ ] **Step 1: Write the failing test**

`lib/masshealth/saca2/eligibility/__tests__/residency-route.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { determineRoutes } from "@/lib/masshealth/saca2/eligibility/routes"
import { evaluateResidencyRoute } from "@/lib/masshealth/saca2/eligibility/rules/residency-route"
import { facilityCouple, makeInputs, makePerson, makeSuppA } from "./helpers"

const codes = (o: { findings: Array<{ code: string }> }) => o.findings.map((f) => f.code)

describe("determineRoutes", () => {
  it("is senior at 65 but not at 64", () => {
    expect(determineRoutes(makeInputs({ persons: [makePerson({ age: 65 })] }))).toEqual(["senior"])
    expect(determineRoutes(makeInputs({ persons: [makePerson({ age: 64 })] }))).toEqual([])
  })

  it("adds facility, HCBS, PACE and screening routes", () => {
    const inputs = makeInputs({
      persons: [makePerson({ age: 50 })],
      programs: { masshealthHsn: false, longTermCare: true, hcbsWaiver: true },
      suppA: makeSuppA({ applyingPace: "yes" }),
      screening: { disabledAndWorkingQualifies: "yes", commonHealthTenYears: "yes" },
    })
    expect(determineRoutes(inputs)).toEqual(["nursingFacility", "hcbsWaiver", "pace", "disabledWorking", "commonHealthTenYears"])
  })

  it("detects a mixed-age married couple living together, both applying", () => {
    const inputs = makeInputs({
      persons: [makePerson({ age: 71 }), makePerson({ index: 1, age: 58, livesWithPerson1: "yes" })],
      hasSpouse: true,
      householdSize: 2,
    })
    expect(determineRoutes(inputs)).toEqual(["senior", "mixedAgeCouple"])
    expect(determineRoutes({ ...inputs, hasSpouse: false })).toEqual(["senior"])
  })
})

describe("evaluateResidencyRoute", () => {
  it("passes a Massachusetts resident aged 65 and reports the routes", () => {
    const o = evaluateResidencyRoute(makeInputs({ persons: [makePerson({ age: 65 })] }))
    expect(o.verdict).toBe("pass")
    expect(o.estimates.routes).toEqual(["senior"])
  })

  it("asks for review when a 64-year-old has no SACA-2 route", () => {
    const o = evaluateResidencyRoute(makeInputs({ persons: [makePerson({ age: 64 })] }))
    expect(o.verdict).toBe("review")
    expect(codes(o)).toContain("SACA2_ROUTE_UNCLEAR")
  })

  it("asks for review when the age is unknown and nothing else gives a route", () => {
    expect(codes(evaluateResidencyRoute(makeInputs({ persons: [makePerson({ age: null })] })))).toContain("SACA2_AGE_UNKNOWN")
  })

  it("redirects a caregiver of a child who is 18 on the screening date, or with no dates listed", () => {
    const eighteen = makeInputs({ persons: [makePerson({ caregiverOfChildUnder19: "yes", childAges: [18] })] })
    expect(evaluateResidencyRoute(eighteen).verdict).toBe("redirect")
    const noDates = makeInputs({ persons: [makePerson({ caregiverOfChildUnder19: "yes", childAges: [] })] })
    expect(evaluateResidencyRoute(noDates).verdict).toBe("redirect")
  })

  it("asks for review when every listed child is already 19", () => {
    const o = evaluateResidencyRoute(makeInputs({ persons: [makePerson({ caregiverOfChildUnder19: "yes", childAges: [19, 25] })] }))
    expect(o.verdict).toBe("review")
    expect(codes(o)).toContain("SACA2_CHILD_AGE_CONFLICT")
  })

  it("does not redirect a caregiver who needs nursing-facility care", () => {
    const inputs = facilityCouple()
    inputs.persons[0].caregiverOfChildUnder19 = "yes"
    inputs.persons[0].childAges = [10]
    const o = evaluateResidencyRoute(inputs)
    expect(o.verdict).toBe("review")
    expect(codes(o)).toContain("SACA2_CAREGIVER_LONG_TERM_CARE")
  })

  it("fails when no one applying lives in Massachusetts, reviews when only some do or the answer is missing", () => {
    expect(evaluateResidencyRoute(makeInputs({ persons: [makePerson({ resident: "no" })] })).verdict).toBe("fail")
    const mixed = makeInputs({
      persons: [makePerson({ resident: "yes" }), makePerson({ index: 1, resident: "no", livesWithPerson1: "yes" })],
      hasSpouse: true,
      householdSize: 2,
    })
    expect(codes(evaluateResidencyRoute(mixed))).toContain("SACA2_SOME_NOT_RESIDENT")
    expect(codes(evaluateResidencyRoute(makeInputs({ persons: [makePerson({ resident: null })] })))).toContain("SACA2_RESIDENCY_MISSING")
  })

  it("ignores a Person 2 who is not applying", () => {
    const inputs = facilityCouple()
    expect(inputs.persons[1].resident).toBeNull()
    expect(evaluateResidencyRoute(inputs).verdict).toBe("pass")
  })

  it("reviews when no one is applying", () => {
    expect(codes(evaluateResidencyRoute(makeInputs({ persons: [makePerson({ applying: false })] })))).toContain("SACA2_NO_APPLICANT")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/residency-route.test.ts`
Expected: FAIL with "Failed to resolve import ... eligibility/routes".

- [ ] **Step 3: Implement**

`lib/masshealth/saca2/eligibility/routes.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2EligibilityInputs, Saca2Route } from "./types"

const SENIOR_AGE = 65

export const LONG_TERM_CARE_ROUTES: readonly Saca2Route[] = ["nursingFacility", "hcbsWaiver", "pace"]

export function hasAnyRoute(routes: readonly Saca2Route[], wanted: readonly Saca2Route[]): boolean {
  return wanted.some((route) => routes.includes(route))
}

/** The SACA-2 target populations (spec §3.1, EOM 26-03) that the visible answers place the application in. */
export function determineRoutes(inputs: Saca2EligibilityInputs): Saca2Route[] {
  const applicants = inputs.persons.filter((p) => p.applying)
  const s = inputs.suppA
  const routes: Saca2Route[] = []
  if (applicants.some((p) => p.age !== null && p.age >= SENIOR_AGE)) routes.push("senior")
  if (inputs.programs.longTermCare || s?.needsNursingFacility === "yes") routes.push("nursingFacility")
  if (inputs.programs.hcbsWaiver || s?.applyingHcbsWaiver === "yes") routes.push("hcbsWaiver")
  if (s?.applyingPace === "yes") routes.push("pace")
  const [p1, p2] = inputs.persons
  if (
    inputs.hasSpouse &&
    p2 !== undefined &&
    p1.applying &&
    p2.applying &&
    p2.livesWithPerson1 === "yes" &&
    p1.age !== null &&
    p2.age !== null &&
    p1.age >= SENIOR_AGE !== p2.age >= SENIOR_AGE &&
    inputs.persons.every((p) => p.caregiverOfChildUnder19 !== "yes")
  ) {
    routes.push("mixedAgeCouple")
  }
  if (inputs.screening.disabledAndWorkingQualifies === "yes") routes.push("disabledWorking")
  if (inputs.screening.commonHealthTenYears === "yes") routes.push("commonHealthTenYears")
  return routes
}
```

`lib/masshealth/saca2/eligibility/rules/residency-route.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding } from "@/lib/masshealth/types"
import { finding, outcome } from "../outcome"
import { determineRoutes } from "../routes"
import type { Saca2EligibilityInputs, Saca2RuleOutcome } from "../types"

const ID = "SACA2_R1_RESIDENCY_ROUTE"
const CHILD_AGE_LIMIT = 19

/** Rule 1: Massachusetts residency (Q14 / Q24) and which SACA-2 route applies; ACA-3 redirect for child caregivers. */
export function evaluateResidencyRoute(inputs: Saca2EligibilityInputs): Saca2RuleOutcome {
  const applicants = inputs.persons.filter((p) => p.applying)
  const routes = determineRoutes(inputs)
  if (applicants.length === 0) {
    return outcome(ID, "review", "No one on this application says they are applying for coverage.", [
      finding("SACA2_NO_APPLICANT", "warning", "No one on this application says they are applying for coverage. Check the \"applying for coverage\" answers."),
    ], { routes })
  }

  const caregivers = applicants.filter((p) => p.caregiverOfChildUnder19 === "yes")
  if (caregivers.length > 0) {
    const ages = caregivers.flatMap((p) => p.childAges)
    if (ages.length > 0 && ages.every((age) => age !== null && age >= CHILD_AGE_LIMIT)) {
      return outcome(ID, "review", "The caregiver answer and the children's dates of birth disagree.", [
        finding("SACA2_CHILD_AGE_CONFLICT", "warning", "You said you care for a child under 19, but the children listed are 19 or older. Check these answers."),
      ], { routes })
    }
    if (routes.includes("nursingFacility")) {
      return outcome(ID, "review", "A long-term-care applicant who cares for a child under 19 needs review.", [
        finding("SACA2_CAREGIVER_LONG_TERM_CARE", "warning", "You need long-term care and you care for a child under 19. MassHealth decides which application fits; you may be asked to use ACA-3."),
      ], { routes })
    }
    return outcome(ID, "redirect", "People who live with and care for a child under 19 apply with ACA-3.", [
      finding("SACA2_REDIRECT_ACA3", "warning", "You live with and care for a child under 19. People in this situation usually apply with the ACA-3 application instead of SACA-2."),
    ], { routes })
  }

  const nonResidents = applicants.filter((p) => p.resident === "no")
  if (nonResidents.length === applicants.length) {
    return outcome(ID, "fail", "No one applying lives in Massachusetts.", [
      finding("SACA2_NOT_RESIDENT", "error", "MassHealth is for people who live in Massachusetts. Based on your answers, no one applying lives here."),
    ], { routes })
  }

  const findings: EligibilityFinding[] = []
  if (nonResidents.length > 0) {
    findings.push(finding("SACA2_SOME_NOT_RESIDENT", "warning", "One person applying does not live in Massachusetts. MassHealth reviews each person."))
  }
  if (applicants.some((p) => p.resident === null)) {
    findings.push(finding("SACA2_RESIDENCY_MISSING", "warning", "The Massachusetts residency question is not answered for everyone applying."))
  }
  if (routes.length === 0) {
    findings.push(
      applicants.some((p) => p.age === null)
        ? finding("SACA2_AGE_UNKNOWN", "warning", "We need a date of birth for everyone applying to tell whether SACA-2 fits.")
        : finding("SACA2_ROUTE_UNCLEAR", "warning", "SACA-2 is for people 65 or older and people who need long-term care. If no one applying is 65 or older or needs long-term care, the ACA-3 application may fit better."),
    )
  }
  if (findings.length > 0) return outcome(ID, "review", "Residency or the application route needs review.", findings, { routes })
  return outcome(ID, "pass", "Your answers show Massachusetts residency and a SACA-2 route.", [], { routes })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/residency-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/eligibility/routes.ts lib/masshealth/saca2/eligibility/rules/residency-route.ts lib/masshealth/saca2/eligibility/__tests__/residency-route.test.ts
git commit -m "feat(saca2): add screening rule 1 (residency, route, ACA-3 redirect)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rule 2 (citizenship and immigration)

**Files:**
- Create: `lib/masshealth/saca2/eligibility/rules/citizenship.ts`
- Test: `lib/masshealth/saca2/eligibility/__tests__/citizenship.test.ts`

**Interfaces:**
- Consumes: `IMMIGRATION_STATUS_OPTIONS` (`questions/immigration-options.ts`); `finding`, `outcome`, `worstVerdict`; helpers.
- Produces: `evaluateCitizenship(inputs): Saca2RuleOutcome` (id `SACA2_R2_CITIZENSHIP`).

- [ ] **Step 1: Write the failing test**

`lib/masshealth/saca2/eligibility/__tests__/citizenship.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { evaluateCitizenship } from "@/lib/masshealth/saca2/eligibility/rules/citizenship"
import { makeInputs, makePerson } from "./helpers"

const run = (...people: Parameters<typeof makePerson>[0][]) =>
  evaluateCitizenship(makeInputs({ persons: people.map((p, i) => makePerson({ index: i as 0 | 1, ...p })) }))

describe("evaluateCitizenship", () => {
  it("passes a citizen who gets Medicare, SSI, or SSDI (proof waived, form p.2)", () => {
    expect(run({ citizen: "yes", hasMedicareOrSsiOrSsdi: "yes" }).verdict).toBe("pass")
  })

  it("asks for proof from a citizen without Medicare, SSI, or SSDI (answer No or blank)", () => {
    const no = run({ citizen: "yes", hasMedicareOrSsiOrSsdi: "no" })
    expect(no.verdict).toBe("documents")
    expect(no.findings[0].code).toBe("SACA2_CITIZENSHIP_PROOF")
    expect(run({ citizen: "yes", hasMedicareOrSsiOrSsdi: null }).verdict).toBe("documents")
  })

  it("reviews a noncitizen with a status from the p.32 list", () => {
    const o = run({ citizen: "no", hasEligibleImmigrationStatus: "yes", immigrationStatus: "lawful-permanent-resident" })
    expect(o.verdict).toBe("review")
    expect(o.findings[0].code).toBe("SACA2_IMMIGRATION_STATUS_REVIEW")
  })

  it("reviews a noncitizen with an unknown status slug or no eligible status", () => {
    expect(run({ citizen: "no", hasEligibleImmigrationStatus: "yes", immigrationStatus: "made-up" }).findings[0].code).toBe("SACA2_IMMIGRATION_MISSING")
    expect(run({ citizen: "no", hasEligibleImmigrationStatus: "no" }).findings[0].code).toBe("SACA2_IMMIGRATION_LIMITED")
  })

  it("reviews a missing citizenship answer", () => {
    expect(run({ citizen: null }).findings[0].code).toBe("SACA2_CITIZENSHIP_MISSING")
  })

  it("takes the worst verdict across applicants and labels people by number, not name", () => {
    const o = run({ citizen: "yes", hasMedicareOrSsiOrSsdi: "yes" }, { citizen: "no", hasEligibleImmigrationStatus: "no" })
    expect(o.verdict).toBe("review")
    expect(o.findings[0].message).toMatch(/^Person 2:/)
  })

  it("ignores a Person 2 who is not applying and is notApplicable with no applicants", () => {
    expect(run({ citizen: "yes", hasMedicareOrSsiOrSsdi: "yes" }, { applying: false, citizen: null }).verdict).toBe("pass")
    expect(run({ applying: false }).verdict).toBe("notApplicable")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/citizenship.test.ts`
Expected: FAIL with "Failed to resolve import ... rules/citizenship".

- [ ] **Step 3: Implement**

`lib/masshealth/saca2/eligibility/rules/citizenship.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding } from "@/lib/masshealth/types"
import { IMMIGRATION_STATUS_OPTIONS } from "../../questions/immigration-options"
import { finding, outcome, worstVerdict } from "../outcome"
import type { Saca2EligibilityInputs, Saca2RuleOutcome, Saca2RuleVerdict } from "../types"

const ID = "SACA2_R2_CITIZENSHIP"
/** The eligible immigration statuses printed on form p.32. */
const P32_STATUSES: ReadonlySet<string> = new Set(IMMIGRATION_STATUS_OPTIONS.map((option) => option.value))

/** Rule 2: citizenship / immigration (form Q12-13, p.32 list); proof waiver for Medicare / SSI / SSDI (form p.2). */
export function evaluateCitizenship(inputs: Saca2EligibilityInputs): Saca2RuleOutcome {
  const applicants = inputs.persons.filter((p) => p.applying)
  if (applicants.length === 0) return outcome(ID, "notApplicable", "No one is applying.")

  const verdicts: Saca2RuleVerdict[] = []
  const findings: EligibilityFinding[] = []
  for (const p of applicants) {
    const who = `Person ${p.index + 1}`
    if (p.citizen === "yes") {
      if (p.hasMedicareOrSsiOrSsdi === "yes") {
        verdicts.push("pass")
      } else {
        verdicts.push("documents")
        findings.push(finding("SACA2_CITIZENSHIP_PROOF", "info", `${who}: send proof of US citizenship and identity. People who get Medicare, SSI, or SSDI usually do not need to.`))
      }
    } else if (p.citizen === "no") {
      verdicts.push("review")
      if (p.hasEligibleImmigrationStatus === "yes" && p.immigrationStatus !== null && P32_STATUSES.has(p.immigrationStatus)) {
        findings.push(finding("SACA2_IMMIGRATION_STATUS_REVIEW", "info", `${who}: the immigration status you chose is on the form's list. MassHealth decides which coverage it allows.`))
      } else if (p.hasEligibleImmigrationStatus === "no") {
        findings.push(finding("SACA2_IMMIGRATION_LIMITED", "warning", `${who}: without an eligible immigration status, MassHealth may offer limited coverage or the Health Safety Net.`))
      } else {
        findings.push(finding("SACA2_IMMIGRATION_MISSING", "warning", `${who}: the immigration status answer is missing or not on the form's list.`))
      }
    } else {
      verdicts.push("review")
      findings.push(finding("SACA2_CITIZENSHIP_MISSING", "warning", `${who}: the citizenship question is not answered.`))
    }
  }

  const verdict = worstVerdict(verdicts)
  const message =
    verdict === "pass"
      ? "Your answers show US citizenship."
      : verdict === "documents"
        ? "Proof of citizenship and identity is needed."
        : "Citizenship or immigration status needs review."
  return outcome(ID, verdict, message, findings)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/citizenship.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/eligibility/rules/citizenship.ts lib/masshealth/saca2/eligibility/__tests__/citizenship.test.ts
git commit -m "feat(saca2): add screening rule 2 (citizenship and immigration)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Rule 3 (countable assets) and the life-insurance figure

**Files:**
- Modify: `lib/masshealth/saca2/figures-2026.ts` (add `lifeInsuranceFaceValuePerPerson: 1500` inside `SACA2_FIGURES`, after `medicarePartBPremiumMonthly`)
- Modify: `lib/masshealth/saca2/__tests__/figures-2026.test.ts` (one expectation)
- Create: `lib/masshealth/saca2/eligibility/rules/assets.ts`
- Test: `lib/masshealth/saca2/eligibility/__tests__/assets.test.ts`

**Interfaces:**
- Consumes: `determineRoutes` (Task 4); money helpers (Task 1); helpers (Task 3).
- Produces: `evaluateAssets(inputs, figures: Saca2Figures): Saca2RuleOutcome` (id `SACA2_R3_ASSETS`; estimates `countableAssets`, `assetLimit` or `communitySpouseResource`); `SACA2_FIGURES.lifeInsuranceFaceValuePerPerson` (also used by Task 11).

- [ ] **Step 1: Write the failing tests**

Add to the first `it` in `lib/masshealth/saca2/__tests__/figures-2026.test.ts` (after the `lookBackMonths` line):

```ts
    expect(SACA2_FIGURES.lifeInsuranceFaceValuePerPerson).toBe(1500)
```

`lib/masshealth/saca2/eligibility/__tests__/assets.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { INVALID_AMOUNT } from "@/lib/masshealth/saca2/eligibility/money"
import { evaluateAssets } from "@/lib/masshealth/saca2/eligibility/rules/assets"
import type { Saca2AssetInputs, Saca2EligibilityInputs } from "@/lib/masshealth/saca2/eligibility/types"
import { cents, facilityCouple, makeAssets, makeInputs, makePerson, makeSuppA } from "./helpers"

const run = (inputs: Saca2EligibilityInputs) => evaluateAssets(inputs, SACA2_FIGURES)
const single = (assets: Partial<Saca2AssetInputs>) => makeInputs({ assets: makeAssets(assets) })
const codes = (o: { findings: Array<{ code: string }> }) => o.findings.map((f) => f.code)
const bank = (...dollars: number[]) => dollars.map((d) => ({ open: true, balance: cents(d) }))

describe("evaluateAssets: single applicant ($2,000)", () => {
  it("counts open accounts only and passes at the limit", () => {
    const o = run(single({ bankAccounts: [...bank(1500), { open: false, balance: null }] }))
    expect(o.verdict).toBe("pass")
    expect(o.estimates).toMatchObject({ countableAssets: 1500, assetLimit: 2000 })
    expect(run(single({ bankAccounts: bank(2000) })).verdict).toBe("pass")
  })

  it("fails one cent over the limit", () => {
    const o = run(single({ bankAccounts: bank(2000.01) }))
    expect(o.verdict).toBe("fail")
    expect(codes(o)).toContain("SACA2_ASSETS_OVER_LIMIT")
  })

  it("reviews unanswered gates and missing or invalid amounts", () => {
    const gates = { ...makeAssets().gates, securities: null }
    expect(codes(run(single({ gates })))).toContain("SACA2_ASSET_ANSWERS_MISSING")
    expect(run(single({ bankAccounts: [{ open: true, balance: null }] })).verdict).toBe("review")
    expect(run(single({ bankAccounts: [{ open: true, balance: INVALID_AMOUNT }] })).verdict).toBe("review")
  })

  it("keeps a fail even when other data is missing (missing data can only add assets)", () => {
    expect(run(single({ bankAccounts: [...bank(5000), { open: true, balance: null }] })).verdict).toBe("fail")
  })

  it("excludes the vehicle with the highest equity and counts the rest", () => {
    const o = run(single({
      vehicles: [
        { fairMarketValue: cents(9000), amountOwed: cents(0) },
        { fairMarketValue: cents(4000), amountOwed: cents(1000) },
      ],
    }))
    expect(o.estimates.countableAssets).toBe(3000)
    expect(o.verdict).toBe("fail")
  })

  it("counts life-insurance cash value only when total face value is over $1,500 per person", () => {
    const at = run(single({ lifeInsurance: [{ faceValue: cents(1500), cashSurrenderValue: cents(800) }] }))
    expect(at.estimates.countableAssets).toBe(0)
    const over = run(single({ lifeInsurance: [{ faceValue: cents(1500.01), cashSurrenderValue: cents(800) }] }))
    expect(over.estimates.countableAssets).toBe(800)
    expect(run(single({ lifeInsurance: [{ faceValue: cents(5000), cashSurrenderValue: null }] })).verdict).toBe("review")
  })

  it("counts revocable trusts and reviews others; reviews annuities and deposits; excludes burial", () => {
    expect(run(single({ trusts: [{ revocable: true, principal: cents(5000) }] })).verdict).toBe("fail")
    const irrevocable = run(single({ trusts: [{ revocable: false, principal: cents(90000) }] }))
    expect(irrevocable.verdict).toBe("review")
    expect(irrevocable.estimates.countableAssets).toBe(0)
    expect(codes(run(single({ annuities: 1 })))).toContain("SACA2_ANNUITY_REVIEW")
    expect(codes(run(single({ deposits: 1 })))).toContain("SACA2_DEPOSIT_REVIEW")
    const burial = run(single({ burial: 2 }))
    expect(burial.verdict).toBe("pass")
    expect(codes(burial)).toContain("SACA2_BURIAL_EXCLUDED")
  })

  it("does not count the home of someone living in the community", () => {
    expect(run(single({ primaryResidence: [cents(300000)] })).verdict).toBe("pass")
  })
})

describe("evaluateAssets: facility applicant's home", () => {
  const facilitySingle = (suppA: Parameters<typeof makeSuppA>[0]) =>
    makeInputs({
      persons: [makePerson({ inInstitution: "yes" })],
      programs: { masshealthHsn: false, longTermCare: true, hcbsWaiver: false },
      suppA: makeSuppA({ needsNursingFacility: "yes", ...suppA }),
      assets: makeAssets({ primaryResidence: [cents(300000)] }),
    })

  it("counts the home when the applicant does not intend to return and no relative lives there", () => {
    const o = run(facilitySingle({ intendsToReturnHome: "no" }))
    expect(o.verdict).toBe("fail")
    expect(codes(o)).toContain("SACA2_HOME_COUNTED")
  })

  it("excludes the home with intent to return or a dependent relative living there", () => {
    expect(run(facilitySingle({ intendsToReturnHome: "yes" })).verdict).toBe("pass")
    const occupants = { spouse: false, childUnder21: false, disabledChild: false, dependentRelative: true }
    expect(run(facilitySingle({ intendsToReturnHome: "no", occupants })).verdict).toBe("pass")
  })
})

describe("evaluateAssets: couples", () => {
  const communityCouple = (spouseApplying: boolean, dollars: number) =>
    makeInputs({
      persons: [makePerson(), makePerson({ index: 1, applying: spouseApplying, livesWithPerson1: "yes" })],
      hasSpouse: true,
      householdSize: 2,
      assets: makeAssets({ bankAccounts: bank(dollars) }),
    })

  it("uses $3,000 for a couple living together and notes when only one spouse applies", () => {
    expect(run(communityCouple(true, 3000)).verdict).toBe("pass")
    expect(run(communityCouple(true, 3000.01)).verdict).toBe("fail")
    const one = run(communityCouple(false, 2900))
    expect(one.estimates.assetLimit).toBe(3000)
    expect(codes(one)).toContain("SACA2_ONE_SPOUSE_APPLYING")
  })

  it("uses the community-spouse band when the applicant is in a facility and the spouse is at home", () => {
    const at = (dollars: number) => run(facilityCouple({ assets: makeAssets({ bankAccounts: bank(dollars) }) }))
    expect(at(34532).verdict).toBe("pass")
    const middle = at(34532.01)
    expect(middle.verdict).toBe("review")
    expect(middle.estimates.communitySpouseResource).toEqual({ min: 32532, max: 162660 })
    expect(middle.estimates.assetLimit).toBeUndefined()
    expect(at(164660).verdict).toBe("review")
    expect(at(164660.01).verdict).toBe("fail")
  })

  it("reviews when both spouses are in a facility or the spouse lives elsewhere", () => {
    const both = facilityCouple()
    both.persons[1].inInstitution = "yes"
    expect(codes(run(both))).toContain("SACA2_BOTH_SPOUSES_IN_FACILITY")
    const apart = makeInputs({ persons: [makePerson(), makePerson({ index: 1, livesWithPerson1: "no" })], hasSpouse: true })
    expect(codes(run(apart))).toContain("SACA2_SPOUSE_LIVES_APART")
  })

  it("doubles the life-insurance threshold with a spouse", () => {
    const o = run(communityCouple(true, 0))
    expect(o.verdict).toBe("pass")
    const withPolicy = communityCouple(true, 0)
    withPolicy.assets.lifeInsurance = [{ faceValue: cents(3000), cashSurrenderValue: cents(2500) }]
    expect(run(withPolicy).estimates.countableAssets).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/assets.test.ts lib/masshealth/saca2/__tests__/figures-2026.test.ts`
Expected: FAIL. The rule module is missing, and the figures test fails on `lifeInsuranceFaceValuePerPerson`.

- [ ] **Step 3: Implement**

In `lib/masshealth/saca2/figures-2026.ts`, inside `SACA2_FIGURES` after `medicarePartBPremiumMonthly: 202.9,`:

```ts
  /**
   * Life insurance: a cash-surrender-value letter is needed (and the cash value counts) when total face value
   * is more than this per person. Source: SACA-2 form Step 5 (life insurance) instructions.
   */
  lifeInsuranceFaceValuePerPerson: 1500,
```

`lib/masshealth/saca2/eligibility/rules/assets.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding } from "@/lib/masshealth/types"
import { INVALID_AMOUNT, centsToDollars, dollarsToCents, formatDollars, totalCents, type AmountInput } from "../money"
import { finding, outcome } from "../outcome"
import { determineRoutes } from "../routes"
import type {
  Saca2AssetInputs,
  Saca2EligibilityInputs,
  Saca2Estimates,
  Saca2Figures,
  Saca2RuleOutcome,
  Saca2RuleVerdict,
} from "../types"

const ID = "SACA2_R3_ASSETS"

function vehicleEquities(vehicles: Saca2AssetInputs["vehicles"]): AmountInput[] {
  return vehicles.map((v) => {
    if (v.fairMarketValue === null || v.fairMarketValue === INVALID_AMOUNT) return v.fairMarketValue
    if (v.amountOwed === INVALID_AMOUNT) return INVALID_AMOUNT
    return Math.max(0, v.fairMarketValue - (v.amountOwed ?? 0))
  })
}

/** The home is not counted unless a facility applicant will not return and no protected relative lives there. */
function isHomeExcluded(inputs: Saca2EligibilityInputs): boolean {
  const s = inputs.suppA
  if (s === null) return true
  const o = s.occupants
  return s.intendsToReturnHome === "yes" || o.spouse || o.childUnder21 || o.disabledChild || o.dependentRelative
}

/** Rule 3 (UNCONFIRMED): countable assets against $2,000 / $3,000, or the community-spouse band. */
export function evaluateAssets(inputs: Saca2EligibilityInputs, figures: Saca2Figures): Saca2RuleOutcome {
  const { assets } = inputs
  const institutional = determineRoutes(inputs).includes("nursingFacility")
  const findings: EligibilityFinding[] = []
  let needsReview = false
  const flag = (code: string, message: string) => {
    needsReview = true
    findings.push(finding(code, "warning", message))
  }

  if (Object.values(assets.gates).some((gate) => gate === null)) flag("SACA2_ASSET_ANSWERS_MISSING", "Some asset questions are not answered.")

  const counted: AmountInput[] = []
  for (const account of assets.bankAccounts) if (account.open) counted.push(account.balance)
  counted.push(...assets.otherRealEstate, ...assets.securities.map((holding) => holding.value))

  if (assets.primaryResidence.length > 0 && institutional && !isHomeExcluded(inputs)) {
    counted.push(...assets.primaryResidence)
    findings.push(finding("SACA2_HOME_COUNTED", "warning", "Your home may count as an asset because you do not plan to return to it and no spouse or dependent relative lives there."))
  }

  const faces = totalCents(assets.lifeInsurance.map((policy) => policy.faceValue))
  const faceLimit = dollarsToCents(figures.lifeInsuranceFaceValuePerPerson) * (inputs.hasSpouse ? 2 : 1)
  if (faces.missing + faces.invalid > 0) flag("SACA2_LIFE_INSURANCE_VALUE_MISSING", "A life-insurance face value is missing or not a valid number.")
  else if (faces.total > faceLimit) counted.push(...assets.lifeInsurance.map((policy) => policy.cashSurrenderValue))

  const equities = vehicleEquities(assets.vehicles)
  const known = equities.filter((e): e is number => typeof e === "number").sort((a, b) => b - a)
  counted.push(...equities.filter((e) => typeof e !== "number"), ...known.slice(1))

  for (const trust of assets.trusts) if (trust.revocable === true) counted.push(trust.principal)
  if (assets.trusts.some((trust) => trust.revocable !== true)) flag("SACA2_TRUST_REVIEW", "MassHealth reviews trusts that are not revocable; this screening does not count them.")
  if (assets.annuities > 0) flag("SACA2_ANNUITY_REVIEW", "MassHealth reviews annuities; this screening cannot value them.")
  if (assets.deposits > 0) flag("SACA2_DEPOSIT_REVIEW", "A deposit held by a care facility may count as an asset; MassHealth reviews it.")
  if (assets.burial > 0) findings.push(finding("SACA2_BURIAL_EXCLUDED", "info", "Prepaid burial arrangements are not counted in this estimate."))

  const total = totalCents(counted)
  if (total.missing + total.invalid > 0) flag("SACA2_ASSET_VALUE_MISSING", "Some asset amounts are missing or not valid numbers.")
  const countable = total.total
  const estimates: Partial<Saca2Estimates> = { countableAssets: centsToDollars(countable) }
  const spouse = inputs.hasSpouse ? inputs.persons[1] : undefined
  let verdict: Saca2RuleVerdict
  let limitCents: number | null = null

  if (institutional && inputs.hasSpouse && spouse?.inInstitution !== "yes") {
    const { min, max } = figures.communitySpouseResource
    const keep = dollarsToCents(figures.assetLimit.individual)
    estimates.communitySpouseResource = { min, max }
    limitCents = dollarsToCents(max) + keep
    if (countable <= dollarsToCents(min) + keep) {
      verdict = "pass"
    } else if (countable > limitCents) {
      verdict = "fail"
    } else {
      verdict = "review"
      findings.push(finding("SACA2_COMMUNITY_SPOUSE_RANGE", "info", `Your countable assets of about ${formatDollars(countable)} fall in the range a spouse at home may be allowed to keep (${formatDollars(dollarsToCents(min))} to ${formatDollars(dollarsToCents(max))}). MassHealth works out the exact amount.`))
    }
  } else if (institutional && inputs.hasSpouse) {
    verdict = "review"
    findings.push(finding("SACA2_BOTH_SPOUSES_IN_FACILITY", "warning", "Both spouses live in a facility. MassHealth reviews assets for each spouse."))
  } else if (inputs.hasSpouse && spouse?.livesWithPerson1 === "yes") {
    limitCents = dollarsToCents(figures.assetLimit.marriedCoupleMember)
    estimates.assetLimit = figures.assetLimit.marriedCoupleMember
    if (!spouse.applying) findings.push(finding("SACA2_ONE_SPOUSE_APPLYING", "info", "Only one spouse is applying. This estimate uses the limit for a married couple living together; MassHealth confirms the limit."))
    verdict = countable <= limitCents ? "pass" : "fail"
  } else if (inputs.hasSpouse) {
    verdict = "review"
    findings.push(finding("SACA2_SPOUSE_LIVES_APART", "warning", "You are married but do not live with your spouse and are not in a facility. MassHealth reviews how your spouse's assets count."))
  } else {
    limitCents = dollarsToCents(figures.assetLimit.individual)
    estimates.assetLimit = figures.assetLimit.individual
    verdict = countable <= limitCents ? "pass" : "fail"
  }

  if (verdict === "pass" && needsReview) verdict = "review"
  if (verdict === "fail" && limitCents !== null) {
    findings.push(finding("SACA2_ASSETS_OVER_LIMIT", "error", `Countable assets of about ${formatDollars(countable)} are over the ${formatDollars(limitCents)} limit used in this estimate.`))
  }
  const message = verdict === "pass" ? "Countable assets are within the limit." : verdict === "fail" ? "Countable assets are over the limit." : "Assets need review."
  return outcome(ID, verdict, message, findings, estimates)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/assets.test.ts lib/masshealth/saca2/__tests__/figures-2026.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/figures-2026.ts lib/masshealth/saca2/__tests__/figures-2026.test.ts lib/masshealth/saca2/eligibility/rules/assets.ts lib/masshealth/saca2/eligibility/__tests__/assets.test.ts
git commit -m "feat(saca2): add screening rule 3 (countable assets)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rule 4 (home equity)

**Files:**
- Create: `lib/masshealth/saca2/eligibility/rules/home-equity.ts`
- Test: `lib/masshealth/saca2/eligibility/__tests__/home-equity.test.ts`

**Interfaces:**
- Consumes: `determineRoutes`, `hasAnyRoute`; money helpers; helpers.
- Produces: `evaluateHomeEquity(inputs, figures: Saca2Figures): Saca2RuleOutcome` (id `SACA2_R4_HOME_EQUITY`; estimate `homeEquityOverLimit`).

- [ ] **Step 1: Write the failing test**

`lib/masshealth/saca2/eligibility/__tests__/home-equity.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { INVALID_AMOUNT } from "@/lib/masshealth/saca2/eligibility/money"
import { evaluateHomeEquity } from "@/lib/masshealth/saca2/eligibility/rules/home-equity"
import type { Saca2SuppAInputs } from "@/lib/masshealth/saca2/eligibility/types"
import { cents, makeInputs, makeSuppA } from "./helpers"

const ltc = (suppA: Partial<Saca2SuppAInputs>, hcbs = false) =>
  evaluateHomeEquity(
    makeInputs({
      programs: { masshealthHsn: false, longTermCare: !hcbs, hcbsWaiver: hcbs },
      suppA: makeSuppA({ needsNursingFacility: hcbs ? "no" : "yes", ownsHome: "yes", ...suppA }),
    }),
    SACA2_FIGURES,
  )
const home = (dollars: number, ownershipType = "individual") => ({ ownershipType, fairMarketValue: cents(dollars) })

describe("evaluateHomeEquity", () => {
  it("does not apply to community applicants or when no home is owned", () => {
    expect(evaluateHomeEquity(makeInputs(), SACA2_FIGURES).verdict).toBe("notApplicable")
    expect(ltc({ ownsHome: "no" }).verdict).toBe("notApplicable")
  })

  it("passes at exactly $1,130,000 and fails one cent over", () => {
    expect(ltc({ homes: [home(1_130_000)] })).toMatchObject({ verdict: "pass", estimates: { homeEquityOverLimit: false } })
    const over = ltc({ homes: [home(1_130_000.01)] })
    expect(over.verdict).toBe("fail")
    expect(over.findings[0].code).toBe("SACA2_HOME_EQUITY_OVER")
  })

  it("applies to HCBS-waiver applicants too", () => {
    expect(ltc({ homes: [home(2_000_000)] }, true).verdict).toBe("fail")
  })

  it("passes with a note when a spouse, child under 21, or disabled child lives there", () => {
    const occupants = { spouse: false, childUnder21: true, disabledChild: false, dependentRelative: false }
    const o = ltc({ homes: [home(2_000_000)], occupants })
    expect(o.verdict).toBe("pass")
    expect(o.findings[0].code).toBe("SACA2_HOME_EQUITY_EXEMPT")
  })

  it("does not exempt for a dependent relative who is not a spouse or child", () => {
    const occupants = { spouse: false, childUnder21: false, disabledChild: false, dependentRelative: true }
    expect(ltc({ homes: [home(2_000_000)], occupants }).verdict).toBe("fail")
  })

  it("reviews shared ownership over the limit and missing or invalid values", () => {
    expect(ltc({ homes: [home(2_000_000, "jointTenancy")] }).findings[0].code).toBe("SACA2_HOME_SHARED_OWNERSHIP")
    expect(ltc({ homes: [{ ownershipType: "individual", fairMarketValue: null }] }).verdict).toBe("review")
    expect(ltc({ homes: [{ ownershipType: "individual", fairMarketValue: INVALID_AMOUNT }] }).verdict).toBe("review")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/home-equity.test.ts`
Expected: FAIL with "Failed to resolve import ... rules/home-equity".

- [ ] **Step 3: Implement**

`lib/masshealth/saca2/eligibility/rules/home-equity.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { dollarsToCents, formatDollars } from "../money"
import { finding, outcome } from "../outcome"
import { determineRoutes, hasAnyRoute } from "../routes"
import type { Saca2EligibilityInputs, Saca2Figures, Saca2RuleOutcome } from "../types"

const ID = "SACA2_R4_HOME_EQUITY"
const SHARED_OWNERSHIP: ReadonlySet<string> = new Set(["tenancyInCommon", "jointTenancy", "lifeEstate"])

/**
 * Rule 4 (UNCONFIRMED): home value over the equity limit for long-term-care applicants, unless a spouse,
 * child under 21, or disabled child lives there. Uses fair-market value (the wizard does not ask equity).
 */
export function evaluateHomeEquity(inputs: Saca2EligibilityInputs, figures: Saca2Figures): Saca2RuleOutcome {
  const s = inputs.suppA
  if (!hasAnyRoute(determineRoutes(inputs), ["nursingFacility", "hcbsWaiver"]) || s === null || s.ownsHome !== "yes") {
    return outcome(ID, "notApplicable", "The home-equity limit applies to long-term-care applicants who own a home.")
  }
  if (s.homes.some((h) => typeof h.fairMarketValue !== "number")) {
    return outcome(ID, "review", "A home value is missing.", [finding("SACA2_HOME_VALUE_MISSING", "warning", "A home value is missing or not a valid number.")])
  }
  const limit = dollarsToCents(figures.maxHomeEquity)
  const over = s.homes.filter((h) => (h.fairMarketValue as number) > limit)
  if (over.length === 0) {
    return outcome(ID, "pass", `Home value is within the ${formatDollars(limit)} limit.`, [], { homeEquityOverLimit: false })
  }
  if (s.occupants.spouse || s.occupants.childUnder21 || s.occupants.disabledChild) {
    return outcome(ID, "pass", "The home-equity limit does not apply.", [
      finding("SACA2_HOME_EQUITY_EXEMPT", "info", "Your home is worth more than the equity limit, but a spouse, a child under 21, or a disabled child lives there, so the limit does not apply."),
    ], { homeEquityOverLimit: true })
  }
  if (over.some((h) => h.ownershipType === null || SHARED_OWNERSHIP.has(h.ownershipType))) {
    return outcome(ID, "review", "A shared home over the limit needs review.", [
      finding("SACA2_HOME_SHARED_OWNERSHIP", "warning", "Your home is worth more than the equity limit and is owned with others. MassHealth works out your share."),
    ], { homeEquityOverLimit: true })
  }
  return outcome(ID, "fail", "Home value is over the home-equity limit.", [
    finding("SACA2_HOME_EQUITY_OVER", "error", `Your home's value is over the ${formatDollars(limit)} home-equity limit for long-term-care services. This screening uses the value you entered, not your equity after any mortgage.`),
  ], { homeEquityOverLimit: true })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/home-equity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/eligibility/rules/home-equity.ts lib/masshealth/saca2/eligibility/__tests__/home-equity.test.ts
git commit -m "feat(saca2): add screening rule 4 (home equity)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Rule 5 (60-month transfers)

**Files:**
- Create: `lib/masshealth/saca2/eligibility/rules/transfers.ts`
- Test: `lib/masshealth/saca2/eligibility/__tests__/transfers.test.ts`

**Interfaces:**
- Consumes: `isoDay`, `isoMonthsBefore`, `isIsoDate` (Task 1); `SACA2_TRANSFER_KEYS`; money helpers; helpers.
- Produces: `evaluateTransfers(inputs, figures: Saca2Figures, on: Date): Saca2RuleOutcome` (id `SACA2_R5_TRANSFERS`; estimate `transfersInWindow`).

- [ ] **Step 1: Write the failing test**

`lib/masshealth/saca2/eligibility/__tests__/transfers.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { INVALID_AMOUNT } from "@/lib/masshealth/saca2/eligibility/money"
import { evaluateTransfers } from "@/lib/masshealth/saca2/eligibility/rules/transfers"
import type { Saca2SuppAInputs } from "@/lib/masshealth/saca2/eligibility/types"
import { ON, cents, makeInputs, makeSuppA } from "./helpers"

const run = (suppA: Partial<Saca2SuppAInputs> | null, on = ON) =>
  evaluateTransfers(makeInputs({ suppA: suppA === null ? null : makeSuppA(suppA) }), SACA2_FIGURES, on)
const codes = (o: { findings: Array<{ code: string }> }) => o.findings.map((f) => f.code)

describe("evaluateTransfers", () => {
  it("does not apply without Supplement A", () => {
    expect(run(null).verdict).toBe("notApplicable")
  })

  it("passes with no transfers and reports the look-back start", () => {
    const o = run({})
    expect(o.verdict).toBe("pass")
    expect(o.estimates.transfersInWindow).toEqual({ count: 0, total: 0, penaltyDays: 0, lookBackStart: "2021-10-13" })
  })

  it("counts a transfer exactly 60 months back and ignores one a day earlier", () => {
    const o = run({
      transfers: [
        { date: "2021-10-13", amount: cents(900) },
        { date: "2021-10-12", amount: cents(5000) },
      ],
    })
    expect(o.verdict).toBe("review")
    expect(o.estimates.transfersInWindow).toEqual({ count: 1, total: 900, penaltyDays: 2, lookBackStart: "2021-10-13" })
    expect(codes(o)).toContain("SACA2_TRANSFER_PENALTY_ESTIMATE")
  })

  it("rounds penalty days down ($450 a day)", () => {
    const days = (dollars: number) => run({ transfers: [{ date: "2024-03-15", amount: cents(dollars) }] }).estimates.transfersInWindow?.penaltyDays
    expect(days(1000)).toBe(2)
    expect(days(450)).toBe(1)
    expect(days(449.99)).toBe(0)
    expect(days(30000)).toBe(66)
  })

  it("reviews future dates and missing or invalid details without counting them", () => {
    const future = run({ transfers: [{ date: "2026-10-14", amount: cents(100) }] })
    expect(codes(future)).toContain("SACA2_TRANSFER_DETAILS_MISSING")
    expect(future.estimates.transfersInWindow?.total).toBe(0)
    expect(run({ transfers: [{ date: null, amount: cents(100) }] }).verdict).toBe("review")
    expect(run({ transfers: [{ date: "2024-02-30", amount: cents(100) }] }).verdict).toBe("review")
    expect(run({ transfers: [{ date: "2024-03-15", amount: INVALID_AMOUNT }] }).verdict).toBe("review")
  })

  it("reviews complex transfer answers and unanswered transfer questions", () => {
    const base = makeSuppA().transferAnswers
    expect(codes(run({ transferAnswers: { ...base, deed: "yes" } }))).toContain("SACA2_TRANSFER_COMPLEX")
    expect(codes(run({ transferAnswers: { ...base, loanOrNote: null } }))).toContain("SACA2_TRANSFER_ANSWERS_MISSING")
  })

  it("clamps the look-back start on a leap day", () => {
    expect(run({}, new Date("2028-02-29T12:00:00Z")).estimates.transfersInWindow?.lookBackStart).toBe("2023-02-28")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/transfers.test.ts`
Expected: FAIL with "Failed to resolve import ... rules/transfers".

- [ ] **Step 3: Implement**

`lib/masshealth/saca2/eligibility/rules/transfers.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding } from "@/lib/masshealth/types"
import { isIsoDate, isoDay, isoMonthsBefore } from "../dates"
import { centsToDollars, dollarsToCents, formatDollars } from "../money"
import { finding, outcome } from "../outcome"
import { SACA2_TRANSFER_KEYS, type Saca2EligibilityInputs, type Saca2Figures, type Saca2RuleOutcome, type Saca2TransferKey } from "../types"

const ID = "SACA2_R5_TRANSFERS"
/** Transfers whose effect depends on documents a caseworker must read. */
const COMPLEX_KEYS: readonly Saca2TransferKey[] = ["trust", "deed", "addedToDeed", "loanOrNote", "annuity"]

/**
 * Rule 5 (UNCONFIRMED): uncompensated transfers in the 60-month look-back ending on the screening date
 * (inclusive). Estimated penalty days = total ÷ average daily nursing-facility cost, rounded down.
 */
export function evaluateTransfers(inputs: Saca2EligibilityInputs, figures: Saca2Figures, on: Date): Saca2RuleOutcome {
  const s = inputs.suppA
  if (s === null) return outcome(ID, "notApplicable", "The 60-month look-back applies to long-term-care applicants.")

  const findings: EligibilityFinding[] = []
  let review = false
  if (SACA2_TRANSFER_KEYS.some((key) => s.transferAnswers[key] === null)) {
    review = true
    findings.push(finding("SACA2_TRANSFER_ANSWERS_MISSING", "warning", "Some resource-transfer questions are not answered."))
  }
  if (COMPLEX_KEYS.some((key) => s.transferAnswers[key] === "yes")) {
    review = true
    findings.push(finding("SACA2_TRANSFER_COMPLEX", "warning", "You reported a trust, deed, loan, or annuity change in the past 60 months. MassHealth reviews these."))
  }

  const lookBackStart = isoMonthsBefore(on, figures.lookBackMonths)
  const today = isoDay(on)
  let total = 0
  let count = 0
  let unusable = 0
  for (const transfer of s.transfers) {
    if (!isIsoDate(transfer.date) || typeof transfer.amount !== "number" || transfer.date > today) {
      unusable += 1
      continue
    }
    if (transfer.date < lookBackStart) continue
    total += transfer.amount
    count += 1
  }
  if (unusable > 0) {
    review = true
    findings.push(finding("SACA2_TRANSFER_DETAILS_MISSING", "warning", "A transfer is missing its date or amount, or its date is in the future."))
  }

  const dailyCost = dollarsToCents(figures.nursingFacilityDailyCost)
  const penaltyDays = Math.floor(total / dailyCost)
  const estimates = { transfersInWindow: { count, total: centsToDollars(total), penaltyDays, lookBackStart } }
  if (total > 0) {
    review = true
    findings.push(finding("SACA2_TRANSFER_PENALTY_ESTIMATE", "warning", `Transfers of about ${formatDollars(total)} in the past 60 months could delay payment for long-term care by an estimated ${penaltyDays} days (${formatDollars(total)} divided by ${formatDollars(dailyCost)} a day). MassHealth decides whether a penalty applies.`))
  }
  return review
    ? outcome(ID, "review", "Resource transfers in the past 60 months need review.", findings, estimates)
    : outcome(ID, "pass", "No resource transfers reported in the past 60 months.", findings, estimates)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/transfers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/eligibility/rules/transfers.ts lib/masshealth/saca2/eligibility/__tests__/transfers.test.ts
git commit -m "feat(saca2): add screening rule 5 (60-month transfers)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Monthly income helper and Rule 7 (spousal allowance / MMMNA)

**Files:**
- Modify: `lib/masshealth/saca2/questions/person-income.ts` (export the existing `MONTHLY_NET_KINDS`: change `const MONTHLY_NET_KINDS` to `export const MONTHLY_NET_KINDS`; nothing else)
- Create: `lib/masshealth/saca2/eligibility/income-sum.ts`
- Create: `lib/masshealth/saca2/eligibility/rules/spousal-allowance.ts`
- Test: `lib/masshealth/saca2/eligibility/__tests__/income-sum.test.ts`
- Test: `lib/masshealth/saca2/eligibility/__tests__/spousal-allowance.test.ts`

**Interfaces:**
- Consumes: `MONTHLY_NET_KINDS`; `toMonthlyCents`; `getEffectiveFigure`; `determineRoutes`; helpers.
- Produces: `monthlyIncomeOf(person: Saca2PersonInputs): { cents: number | null; oneTimeIncome: boolean }` (`cents: null` = unknown); `evaluateSpousalAllowance(inputs, figures: Saca2Figures, on: Date): Saca2RuleOutcome` (id `SACA2_R7_SPOUSAL_ALLOWANCE`; estimate `spousalAllowance` in dollars, read by the engine in Task 12 and passed to rule 6).

- [ ] **Step 1: Write the failing tests**

`lib/masshealth/saca2/eligibility/__tests__/income-sum.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { monthlyIncomeOf } from "@/lib/masshealth/saca2/eligibility/income-sum"
import { INVALID_AMOUNT } from "@/lib/masshealth/saca2/eligibility/money"
import { cents, incomeLine, makePerson } from "./helpers"

describe("monthlyIncomeOf", () => {
  it("is 0 for No income and unknown for an unanswered income question", () => {
    expect(monthlyIncomeOf(makePerson({ hasIncome: "no" }))).toEqual({ cents: 0, oneTimeIncome: false })
    expect(monthlyIncomeOf(makePerson({ hasIncome: null })).cents).toBeNull()
  })

  it("adds recurring income normalized to monthly", () => {
    const p = makePerson({
      hasIncome: "yes",
      income: [incomeLine("wages", 250, "weekly"), incomeLine("pension", 3000, "quarterly"), incomeLine("investment", 1200, "yearly")],
    })
    expect(monthlyIncomeOf(p).cents).toBe(108_333 + 100_000 + 10_000)
  })

  it("subtracts monthly-net losses and rental losses, never below 0", () => {
    const p = makePerson({
      hasIncome: "yes",
      income: [incomeLine("socialSecurity", 1000), incomeLine("selfEmployment", 300, null, true)],
      rental: [{ amount: cents(200), isLoss: false }],
    })
    expect(monthlyIncomeOf(p).cents).toBe(90_000)
    const loss = makePerson({ hasIncome: "yes", income: [incomeLine("selfEmployment", 300, null, true)] })
    expect(monthlyIncomeOf(loss).cents).toBe(0)
  })

  it("skips one-time income but flags it, including listed one-time payments", () => {
    const p = makePerson({ hasIncome: "yes", income: [incomeLine("lottery", 5000, "oneTime"), incomeLine("socialSecurity", 1000)] })
    expect(monthlyIncomeOf(p)).toEqual({ cents: 100_000, oneTimeIncome: true })
    expect(monthlyIncomeOf(makePerson({ hasIncome: "yes", oneTimeIncomeThisYear: 1 })).oneTimeIncome).toBe(true)
  })

  it("is unknown when an amount or a recurring frequency is missing or invalid", () => {
    expect(monthlyIncomeOf(makePerson({ hasIncome: "yes", income: [incomeLine("pension", 100, null)] })).cents).toBeNull()
    expect(monthlyIncomeOf(makePerson({ hasIncome: "yes", income: [{ kind: "pension", amount: null, frequency: "monthly", isLoss: false }] })).cents).toBeNull()
    expect(monthlyIncomeOf(makePerson({ hasIncome: "yes", rental: [{ amount: INVALID_AMOUNT, isLoss: false }] })).cents).toBeNull()
  })
})
```

`lib/masshealth/saca2/eligibility/__tests__/spousal-allowance.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { INVALID_AMOUNT } from "@/lib/masshealth/saca2/eligibility/money"
import { evaluateSpousalAllowance } from "@/lib/masshealth/saca2/eligibility/rules/spousal-allowance"
import type { Saca2EligibilityInputs, Saca2SpouseExpenses } from "@/lib/masshealth/saca2/eligibility/types"
import { ON, cents, facilityCouple } from "./helpers"

const at = (iso: string) => new Date(`${iso}T12:00:00Z`)
const run = (inputs: Saca2EligibilityInputs, on = ON) => evaluateSpousalAllowance(inputs, SACA2_FIGURES, on)
function withExpenses(patch: Partial<Saca2SpouseExpenses>): Saca2EligibilityInputs {
  const inputs = facilityCouple()
  const suppA = inputs.suppA
  if (!suppA?.spouseExpenses) throw new Error("facilityCouple fixture must have spouse expenses")
  inputs.suppA = { ...suppA, spouseExpenses: { ...suppA.spouseExpenses, ...patch } }
  return inputs
}

describe("evaluateSpousalAllowance", () => {
  it("estimates the allowance on 2026-10-13 (heat standard $945, shelter $811.50, minimum $2,705)", () => {
    const o = run(facilityCouple())
    expect(o.verdict).toBe("pass")
    expect(o.estimates.spousalAllowance).toEqual({ mmmna: 3738.5, excessShelter: 1033.5, allowance: 2738.5 })
  })

  it("switches the SNAP utility standard on 2026-10-01", () => {
    expect(run(facilityCouple(), at("2026-09-30")).estimates.spousalAllowance).toEqual({ mmmna: 3707.5, excessShelter: 1002.5, allowance: 2707.5 })
    expect(run(facilityCouple(), at("2026-10-01")).estimates.spousalAllowance?.allowance).toBe(2738.5)
  })

  it("switches the minimum MMMNA and shelter standard on 2026-07-01", () => {
    expect(run(facilityCouple(), at("2026-06-30")).estimates.spousalAllowance).toEqual({ mmmna: 3664.62, excessShelter: 1020.87, allowance: 2664.62 })
    expect(run(facilityCouple(), at("2026-07-01")).estimates.spousalAllowance).toEqual({ mmmna: 3707.5, excessShelter: 1002.5, allowance: 2707.5 })
  })

  it("caps the MMMNA at $4,066.50", () => {
    expect(run(withExpenses({ rent: cents(3000) })).estimates.spousalAllowance?.mmmna).toBe(4066.5)
  })

  it("uses the no-heat standard when the spouse pays utilities but not heat, and none when neither", () => {
    expect(run(withExpenses({ paysHeat: "no" })).estimates.spousalAllowance?.excessShelter).toBe(663.5)
    expect(run(withExpenses({ paysHeat: "no", paysUtilities: "no" })).estimates.spousalAllowance?.excessShelter).toBe(88.5)
  })

  it("never goes below 0 when the spouse's income is high", () => {
    const inputs = facilityCouple()
    inputs.persons[1].income = [{ kind: "pension", amount: cents(9000), frequency: "monthly", isLoss: false }]
    expect(run(inputs).estimates.spousalAllowance?.allowance).toBe(0)
  })

  it("reviews missing heat answers, invalid amounts, unknown spouse income, and family at home", () => {
    expect(run(withExpenses({ paysHeat: null })).findings[0].code).toBe("SACA2_UTILITY_ANSWERS_MISSING")
    expect(run(withExpenses({ mortgage: INVALID_AMOUNT })).findings[0].code).toBe("SACA2_SHELTER_VALUE_INVALID")
    const noIncome = facilityCouple()
    noIncome.persons[1].hasIncome = null
    expect(run(noIncome).findings[0].code).toBe("SACA2_SPOUSE_INCOME_MISSING")
    const family = withExpenses({})
    if (family.suppA) family.suppA = { ...family.suppA, familyAtHome: "yes" }
    const o = run(family)
    expect(o.verdict).toBe("review")
    expect(o.estimates.spousalAllowance?.allowance).toBe(2738.5)
  })

  it("does not apply without a spouse (householdHasSpouse), when the spouse is in a facility, or for community applicants", () => {
    expect(run({ ...facilityCouple(), hasSpouse: false }).verdict).toBe("notApplicable")
    const both = facilityCouple()
    both.persons[1].inInstitution = "yes"
    expect(run(both).verdict).toBe("notApplicable")
    expect(run({ ...facilityCouple(), programs: { masshealthHsn: true, longTermCare: false, hcbsWaiver: false }, suppA: null }).verdict).toBe("notApplicable")
  })
})
```

Arithmetic check for the no-heat cases (2026-10-13): $900 + $575 − $811.50 = $663.50. With no utility: $900 − $811.50 = $88.50.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/income-sum.test.ts lib/masshealth/saca2/eligibility/__tests__/spousal-allowance.test.ts`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Implement**

In `lib/masshealth/saca2/questions/person-income.ts` change exactly this line:

```ts
const MONTHLY_NET_KINDS: readonly unknown[] = ["selfEmployment", "capitalGains", "farmingFishing"]
```

to:

```ts
export const MONTHLY_NET_KINDS: readonly unknown[] = ["selfEmployment", "capitalGains", "farmingFishing"]
```

`lib/masshealth/saca2/eligibility/income-sum.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { MONTHLY_NET_KINDS } from "../questions/person-income"
import { toMonthlyCents } from "./money"
import type { Saca2PersonInputs } from "./types"

export interface MonthlyIncome {
  /** Monthly countable income in cents (floored at 0), or null when it cannot be worked out. */
  cents: number | null
  /** One-time income was reported; it is not counted monthly and needs review. */
  oneTimeIncome: boolean
}

/** One person's monthly income from their visible income rows and rental units. */
export function monthlyIncomeOf(person: Saca2PersonInputs): MonthlyIncome {
  if (person.hasIncome === "no") return { cents: 0, oneTimeIncome: false }
  let oneTimeIncome = person.oneTimeIncomeThisYear > 0
  if (person.hasIncome !== "yes") return { cents: null, oneTimeIncome }
  let total = 0
  for (const line of person.income) {
    if (typeof line.amount !== "number") return { cents: null, oneTimeIncome }
    if (MONTHLY_NET_KINDS.includes(line.kind)) {
      total += line.isLoss ? -line.amount : line.amount
      continue
    }
    if (line.frequency === "oneTime") {
      oneTimeIncome = true
      continue
    }
    const monthly = toMonthlyCents(line.amount, line.frequency)
    if (monthly === null) return { cents: null, oneTimeIncome }
    total += monthly
  }
  for (const unit of person.rental) {
    if (typeof unit.amount !== "number") return { cents: null, oneTimeIncome }
    total += unit.isLoss ? -unit.amount : unit.amount
  }
  return { cents: Math.max(0, total), oneTimeIncome }
}
```

`lib/masshealth/saca2/eligibility/rules/spousal-allowance.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { getEffectiveFigure } from "../../figures-2026"
import { monthlyIncomeOf } from "../income-sum"
import { INVALID_AMOUNT, centsToDollars, dollarsToCents, formatDollars, totalCents } from "../money"
import { finding, outcome } from "../outcome"
import { determineRoutes } from "../routes"
import type { Saca2EligibilityInputs, Saca2Figures, Saca2RuleOutcome } from "../types"

const ID = "SACA2_R7_SPOUSAL_ALLOWANCE"

/**
 * Rule 7 (UNCONFIRMED): minimum monthly maintenance needs allowance for a spouse at home.
 * Shelter = housing costs + SNAP utility standard (heat, else no-heat when utilities are paid);
 * excess shelter = shelter − standard shelter expense; MMMNA = min(max, minimum + excess);
 * allowance = MMMNA − the spouse's own income. All figures read for `on` (effective-dated).
 */
export function evaluateSpousalAllowance(inputs: Saca2EligibilityInputs, figures: Saca2Figures, on: Date): Saca2RuleOutcome {
  const s = inputs.suppA
  const spouse = inputs.hasSpouse ? inputs.persons[1] : undefined
  if (
    !determineRoutes(inputs).includes("nursingFacility") ||
    !inputs.hasSpouse ||
    s === null ||
    s.spouseExpenses === null ||
    spouse?.inInstitution === "yes"
  ) {
    return outcome(ID, "notApplicable", "A spousal allowance applies when one spouse is in a nursing facility and the other lives at home.")
  }
  const e = s.spouseExpenses
  if (e.paysHeat === null || e.paysUtilities === null) {
    return outcome(ID, "review", "The heat and utility answers are needed.", [finding("SACA2_UTILITY_ANSWERS_MISSING", "warning", "Tell us whether your spouse pays for heat and for utilities.")])
  }
  const housing = [e.rent, e.mortgage, e.homeownersInsurance, e.realEstateTaxes, e.condoOrCoopFee]
  if (housing.some((value) => value === INVALID_AMOUNT)) {
    return outcome(ID, "review", "A housing-expense amount is not valid.", [finding("SACA2_SHELTER_VALUE_INVALID", "warning", "A housing-expense amount is not a valid number.")])
  }
  const utility =
    e.paysHeat === "yes"
      ? getEffectiveFigure(figures.snapUtility.heat, on)
      : e.paysUtilities === "yes"
        ? getEffectiveFigure(figures.snapUtility.noHeat, on)
        : 0
  const shelter = totalCents(housing).total + dollarsToCents(utility)
  const excessShelter = Math.max(0, shelter - dollarsToCents(getEffectiveFigure(figures.standardShelterExpense, on)))
  const mmmna = Math.min(dollarsToCents(figures.mmmnaMax), dollarsToCents(getEffectiveFigure(figures.mmmnaMin, on)) + excessShelter)
  const spouseIncome = spouse ? monthlyIncomeOf(spouse).cents : null
  if (spouseIncome === null) {
    return outcome(ID, "review", "Your spouse's income is needed.", [finding("SACA2_SPOUSE_INCOME_MISSING", "warning", "Your spouse's income is needed to estimate the spousal allowance.")])
  }
  const allowance = Math.max(0, mmmna - spouseIncome)
  const estimates = {
    spousalAllowance: { mmmna: centsToDollars(mmmna), excessShelter: centsToDollars(excessShelter), allowance: centsToDollars(allowance) },
  }
  const findings = [
    finding("SACA2_SPOUSAL_ALLOWANCE_ESTIMATE", "info", `Estimated monthly amount of your income your spouse at home may keep: ${formatDollars(allowance)}.`),
  ]
  if (s.familyAtHome === "yes") {
    findings.push(finding("SACA2_FAMILY_ALLOWANCE_NOT_ESTIMATED", "warning", "Family members live with your spouse. MassHealth may allow more income for them; this screening does not estimate that."))
    return outcome(ID, "review", "The family allowance needs review.", findings, estimates)
  }
  return outcome(ID, "pass", "Spousal allowance estimated.", findings, estimates)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/masshealth/saca2/eligibility lib/masshealth/saca2/__tests__/questions-person-income.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS (the questions test confirms the export did not change behavior).

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/questions/person-income.ts lib/masshealth/saca2/eligibility/income-sum.ts lib/masshealth/saca2/eligibility/rules/spousal-allowance.ts lib/masshealth/saca2/eligibility/__tests__/income-sum.test.ts lib/masshealth/saca2/eligibility/__tests__/spousal-allowance.test.ts
git commit -m "feat(saca2): add monthly income normalization and screening rule 7 (spousal allowance)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Rules 6 (income) and 8 (Medicare / MSP)

**Files:**
- Create: `lib/masshealth/saca2/eligibility/rules/income.ts`
- Create: `lib/masshealth/saca2/eligibility/rules/medicare.ts`
- Test: `lib/masshealth/saca2/eligibility/__tests__/income.test.ts`
- Test: `lib/masshealth/saca2/eligibility/__tests__/medicare.test.ts`

**Interfaces:**
- Consumes: `monthlyIncomeOf` (Task 9); `determineRoutes`, `hasAnyRoute`, `LONG_TERM_CARE_ROUTES` (Task 4); `getFplRow`, `SACA2_FIGURES_YEAR`; helpers.
- Produces: `evaluateIncome(inputs, figures: Saca2Figures, on: Date, spousalAllowanceCents: number | null): Saca2RuleOutcome` (id `SACA2_R6_INCOME`; estimates `householdSize`, `monthlyIncome`, `fplPercent`, `incomeLimit`, `patientPaidAmount`, `partBPremium`); `evaluateMedicare(inputs, figures: Saca2Figures): Saca2RuleOutcome` (id `SACA2_R8_MEDICARE_MSP`; estimate `partBPremium`).

- [ ] **Step 1: Write the failing tests**

`lib/masshealth/saca2/eligibility/__tests__/income.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { evaluateIncome } from "@/lib/masshealth/saca2/eligibility/rules/income"
import type { Saca2EligibilityInputs, Saca2IncomeLine } from "@/lib/masshealth/saca2/eligibility/types"
import { ON, cents, facilityCouple, incomeLine, makeInputs, makePerson } from "./helpers"

const run = (inputs: Saca2EligibilityInputs, allowance: number | null = null) => evaluateIncome(inputs, SACA2_FIGURES, ON, allowance)
const single = (...income: Saca2IncomeLine[]) => makeInputs({ persons: [makePerson({ hasIncome: "yes", income })] })
const codes = (o: { findings: Array<{ code: string }> }) => o.findings.map((f) => f.code)

describe("evaluateIncome: community (100% FPL)", () => {
  it("passes at exactly 100% FPL for one person and reviews one cent over", () => {
    expect(run(single(incomeLine("socialSecurity", 1330)))).toMatchObject({
      verdict: "pass",
      estimates: { householdSize: 1, monthlyIncome: 1330, fplPercent: 100, incomeLimit: { kind: "fpl100", monthly: 1330 } },
    })
    const over = run(single(incomeLine("socialSecurity", 1330.01)))
    expect(over.verdict).toBe("review")
    expect(codes(over)).toContain("SACA2_INCOME_OVER_FPL100")
  })

  it("normalizes frequencies before comparing", () => {
    expect(run(single(incomeLine("wages", 250, "weekly"))).estimates.monthlyIncome).toBe(1083.33)
    expect(run(single(incomeLine("pension", 3000, "quarterly"))).estimates.monthlyIncome).toBe(1000)
  })

  it("adds a spouse living with Person 1 and uses the household-of-two row", () => {
    const inputs = makeInputs({
      persons: [
        makePerson({ hasIncome: "yes", income: [incomeLine("socialSecurity", 1600)] }),
        makePerson({ index: 1, age: 58, livesWithPerson1: "yes", hasIncome: "yes", income: [incomeLine("wages", 400, "every2weeks")] }),
      ],
      hasSpouse: true,
      householdSize: 2,
    })
    expect(run(inputs).estimates).toMatchObject({ householdSize: 2, monthlyIncome: 2466.67, fplPercent: 137, incomeLimit: { monthly: 1804 } })
  })

  it("uses the extrapolated row beyond 8 and reviews a corrupt household size without throwing", () => {
    const nine = { ...single(incomeLine("socialSecurity", 1000)), householdSize: 9 }
    expect(run(nine).estimates).toMatchObject({ incomeLimit: { kind: "fpl100", monthly: 5118 }, fplPercent: 20 })
    const zero = { ...single(incomeLine("socialSecurity", 1000)), householdSize: 0 }
    expect(codes(run(zero))).toContain("SACA2_HOUSEHOLD_SIZE_UNKNOWN")
  })

  it("reviews missing income details, one-time income, and a non-spouse Person 2 who applies", () => {
    expect(codes(run(makeInputs({ persons: [makePerson({ hasIncome: null })] })))).toContain("SACA2_INCOME_DETAILS_MISSING")
    expect(codes(run(single(incomeLine("lottery", 5000, "oneTime"))))).toContain("SACA2_ONE_TIME_INCOME")
    const other = makeInputs({ persons: [makePerson(), makePerson({ index: 1, livesWithPerson1: "yes" })], hasSpouse: false })
    expect(codes(run(other))).toContain("SACA2_OTHER_PERSON_APPLYING")
  })

  it("does not apply when no one is applying", () => {
    expect(run(makeInputs({ persons: [makePerson({ applying: false })] })).verdict).toBe("notApplicable")
  })
})

describe("evaluateIncome: long-term care ($2,982 special income limit)", () => {
  it("passes at the limit, reviews over it, and estimates the patient-paid amount", () => {
    const o = run(facilityCouple(), cents(2738.5))
    expect(o).toMatchObject({
      verdict: "pass",
      estimates: { monthlyIncome: 2700, incomeLimit: { kind: "specialIncomeLimit", monthly: 2982 }, patientPaidAmount: 0 },
    })
    const over = facilityCouple()
    over.persons[0].income = [incomeLine("pension", 2982.01)]
    expect(codes(run(over))).toContain("SACA2_INCOME_OVER_SPECIAL_LIMIT")
  })

  it("subtracts the personal needs allowance and Part B when there is no spousal allowance", () => {
    const inputs = facilityCouple({ hasSpouse: false })
    inputs.health = { ...inputs.health, hasMedicare: true }
    expect(run(inputs, null).estimates).toMatchObject({ patientPaidAmount: 2424.3, partBPremium: 202.9 })
  })

  it("uses the special income limit for HCBS but gives no patient-paid amount", () => {
    const inputs = makeInputs({
      persons: [makePerson({ hasIncome: "yes", income: [incomeLine("socialSecurity", 1500)] })],
      programs: { masshealthHsn: false, longTermCare: false, hcbsWaiver: true },
    })
    const o = run(inputs)
    expect(o.verdict).toBe("pass")
    expect(o.estimates.incomeLimit?.kind).toBe("specialIncomeLimit")
    expect(o.estimates.patientPaidAmount).toBeUndefined()
  })

  it("reviews when both spouses apply with long-term care", () => {
    const inputs = facilityCouple()
    inputs.persons[1].applying = true
    expect(codes(run(inputs))).toContain("SACA2_BOTH_SPOUSES_LONG_TERM_CARE")
  })
})
```

Arithmetic check: $2,700 − $72.80 − $202.90 = $2,424.30. For size 9: 100% FPL = $4,644 + $474 = $5,118, and $1,000 / $5,118 = 19.5% → 20.

`lib/masshealth/saca2/eligibility/__tests__/medicare.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { evaluateMedicare } from "@/lib/masshealth/saca2/eligibility/rules/medicare"
import { makeInputs } from "./helpers"

const health = (hasMedicare: boolean, wantsPartBHelp: "yes" | "no" | null) =>
  makeInputs({ health: { hasMedicare, medigapOrPartD: false, wantsPartBHelp, employerCoverageSupplement: false } })

describe("evaluateMedicare", () => {
  it("does not apply without Medicare", () => {
    expect(evaluateMedicare(health(false, null), SACA2_FIGURES).verdict).toBe("notApplicable")
  })

  it("flags an MSP referral when Part B help was requested", () => {
    const o = evaluateMedicare(health(true, "yes"), SACA2_FIGURES)
    expect(o).toMatchObject({ verdict: "pass", estimates: { partBPremium: 202.9 } })
    expect(o.findings[0].code).toBe("SACA2_MSP_REFERRAL")
    expect(o.findings[0].message).toContain("$202.90")
  })

  it("mentions the MSP when Medicare is reported without a help request", () => {
    expect(evaluateMedicare(health(true, "no"), SACA2_FIGURES).findings[0].code).toBe("SACA2_MSP_AVAILABLE")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/masshealth/saca2/eligibility/__tests__/income.test.ts lib/masshealth/saca2/eligibility/__tests__/medicare.test.ts`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Implement**

`lib/masshealth/saca2/eligibility/rules/income.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding } from "@/lib/masshealth/types"
import { getFplRow } from "../../figures-2026"
import { monthlyIncomeOf, type MonthlyIncome } from "../income-sum"
import { centsToDollars, dollarsToCents, formatDollars } from "../money"
import { finding, outcome } from "../outcome"
import { LONG_TERM_CARE_ROUTES, determineRoutes, hasAnyRoute } from "../routes"
import type { Saca2EligibilityInputs, Saca2Estimates, Saca2Figures, Saca2RuleOutcome } from "../types"

const ID = "SACA2_R6_INCOME"

const missingIncome = () =>
  finding("SACA2_INCOME_DETAILS_MISSING", "warning", "Some income answers are missing (an amount, how often it is paid, or whether there is income).")
const oneTime = () =>
  finding("SACA2_ONE_TIME_INCOME", "warning", "You reported one-time income. It is not counted monthly here; MassHealth reviews how it counts.")

/**
 * Rule 6 (UNCONFIRMED). Long-term care (facility, HCBS waiver, PACE): Person 1's monthly income against the
 * special income limit; for a facility, patient-paid amount = income − personal needs allowance − spousal
 * allowance (rule 7) − Medicare Part B. Community: Person 1 plus a spouse living together against 100% FPL.
 * Over a limit is review (a deductible, an MSP, or CommonHealth may apply), never a fail.
 */
export function evaluateIncome(
  inputs: Saca2EligibilityInputs,
  figures: Saca2Figures,
  on: Date,
  spousalAllowanceCents: number | null,
): Saca2RuleOutcome {
  void on // figures used here are not effective-dated; kept for one signature across rules
  const applicants = inputs.persons.filter((p) => p.applying)
  if (applicants.length === 0) return outcome(ID, "notApplicable", "No one is applying.")
  const [p1, p2] = inputs.persons
  const findings: EligibilityFinding[] = []
  let review = false
  if (p2?.applying && !inputs.hasSpouse) {
    review = true
    findings.push(finding("SACA2_OTHER_PERSON_APPLYING", "warning", "Person 2 is applying but is not your spouse. This screening estimates income only for you and a spouse."))
  }
  const estimates: Partial<Saca2Estimates> = {}
  const routes = determineRoutes(inputs)

  if (hasAnyRoute(routes, LONG_TERM_CARE_ROUTES)) {
    if (inputs.hasSpouse && p2?.applying) {
      review = true
      findings.push(finding("SACA2_BOTH_SPOUSES_LONG_TERM_CARE", "warning", "Both spouses are applying with long-term care. MassHealth works out each spouse's income."))
    }
    const limit = dollarsToCents(figures.federalBenefitRate300Monthly)
    estimates.incomeLimit = { kind: "specialIncomeLimit", monthly: figures.federalBenefitRate300Monthly }
    const income = monthlyIncomeOf(p1)
    if (income.cents === null) return outcome(ID, "review", "Income needs review.", [...findings, missingIncome()], estimates)
    if (income.oneTimeIncome) {
      review = true
      findings.push(oneTime())
    }
    estimates.monthlyIncome = centsToDollars(income.cents)
    if (routes.includes("nursingFacility")) {
      const partB = inputs.health.hasMedicare ? dollarsToCents(figures.medicarePartBPremiumMonthly) : 0
      if (inputs.health.hasMedicare) estimates.partBPremium = figures.medicarePartBPremiumMonthly
      const ppa = Math.max(0, income.cents - dollarsToCents(figures.personalNeedsAllowance) - (spousalAllowanceCents ?? 0) - partB)
      estimates.patientPaidAmount = centsToDollars(ppa)
      findings.push(finding("SACA2_PATIENT_PAID_AMOUNT", "info", `Estimated amount you would pay each month toward nursing-facility care: ${formatDollars(ppa)}.`))
    }
    if (income.cents > limit) {
      review = true
      findings.push(finding("SACA2_INCOME_OVER_SPECIAL_LIMIT", "warning", `Your income of about ${formatDollars(income.cents)} a month is over the ${formatDollars(limit)} special income limit. You may still qualify, for example with a deductible; MassHealth decides.`))
    }
    return outcome(ID, review ? "review" : "pass", review ? "Income needs review." : "Income is within the special income limit.", findings, estimates)
  }

  const size = inputs.householdSize
  if (!Number.isInteger(size) || size < 1) {
    return outcome(ID, "review", "Household size is unknown.", [...findings, finding("SACA2_HOUSEHOLD_SIZE_UNKNOWN", "warning", "We could not work out your household size.")], estimates)
  }
  const members = size >= 2 && inputs.hasSpouse && p2 !== undefined ? [p1, p2] : [p1]
  const incomes: MonthlyIncome[] = members.map(monthlyIncomeOf)
  if (incomes.some((income) => income.cents === null)) {
    return outcome(ID, "review", "Income needs review.", [...findings, missingIncome()], { householdSize: size })
  }
  if (incomes.some((income) => income.oneTimeIncome)) {
    review = true
    findings.push(oneTime())
  }
  const total = incomes.reduce((sum, income) => sum + (income.cents ?? 0), 0)
  const row = getFplRow(size)
  const limit = dollarsToCents(row.fpl100.monthly)
  const fplPercent = Math.round((total * 100) / limit)
  estimates.householdSize = size
  estimates.monthlyIncome = centsToDollars(total)
  estimates.fplPercent = fplPercent
  estimates.incomeLimit = { kind: "fpl100", monthly: row.fpl100.monthly }
  if (total > limit) {
    review = true
    findings.push(finding("SACA2_INCOME_OVER_FPL100", "warning", `Your household income is about ${fplPercent}% of the federal poverty level, over the 100% MassHealth Standard limit for a household of ${size}. You may still qualify for a Medicare Savings Program, CommonHealth, or with a deductible.`))
  }
  return outcome(ID, review ? "review" : "pass", review ? "Income needs review." : "Income is within 100% of the federal poverty level.", findings, estimates)
}
```

`lib/masshealth/saca2/eligibility/rules/medicare.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { SACA2_FIGURES_YEAR } from "../../figures-2026"
import { dollarsToCents, formatDollars } from "../money"
import { finding, outcome } from "../outcome"
import type { Saca2EligibilityInputs, Saca2Figures, Saca2RuleOutcome } from "../types"

const ID = "SACA2_R8_MEDICARE_MSP"

/** Rule 8 (form Step 6): informational Medicare Savings Program referral; never changes the status. */
export function evaluateMedicare(inputs: Saca2EligibilityInputs, figures: Saca2Figures): Saca2RuleOutcome {
  if (!inputs.health.hasMedicare) return outcome(ID, "notApplicable", "No Medicare coverage reported.")
  const premium = figures.medicarePartBPremiumMonthly
  const findings =
    inputs.health.wantsPartBHelp === "yes"
      ? [finding("SACA2_MSP_REFERRAL", "info", `You asked for help paying Medicare Part B premiums (${formatDollars(dollarsToCents(premium))} a month in ${SACA2_FIGURES_YEAR}). MassHealth also checks the Medicare Savings Programs, which have no asset limit.`)]
      : [finding("SACA2_MSP_AVAILABLE", "info", "If Medicare premiums are hard to pay, you can ask for help through the Medicare Savings Programs, which have no asset limit.")]
  return outcome(ID, "pass", "Medicare reported.", findings, { partBPremium: premium })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/masshealth/saca2/eligibility && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/eligibility/rules/income.ts lib/masshealth/saca2/eligibility/rules/medicare.ts lib/masshealth/saca2/eligibility/__tests__/income.test.ts lib/masshealth/saca2/eligibility/__tests__/medicare.test.ts
git commit -m "feat(saca2): add screening rules 6 (income) and 8 (Medicare and MSP)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Document checklist

**Files:**
- Create: `lib/masshealth/saca2/document-checklist.ts`
- Test: `lib/masshealth/saca2/__tests__/document-checklist.test.ts`

**Interfaces:**
- Consumes: `Saca2EligibilityInputs`, `Saca2DocumentId`, `Saca2DocumentItem`, `Saca2Figures` (Task 1); `determineRoutes`; money helpers; `readSaca2EligibilityInputs` (test only); helpers.
- Produces: `buildSaca2DocumentChecklist(inputs: Saca2EligibilityInputs, figures?: Saca2Figures): Saca2DocumentItem[]`. The order is fixed and there are no duplicate ids.

- [ ] **Step 1: Write the failing test**

`lib/masshealth/saca2/__tests__/document-checklist.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { buildSaca2DocumentChecklist } from "@/lib/masshealth/saca2/document-checklist"
import { readSaca2EligibilityInputs } from "@/lib/masshealth/saca2/eligibility/inputs"
import type { Saca2DocumentId, Saca2EligibilityInputs } from "@/lib/masshealth/saca2/eligibility/types"
import { completeFacilityCouple, completeSingleSenior } from "./complete-answers"
import { ON, cents, facilityCouple, incomeLine, makeAssets, makeInputs, makePerson, makeSuppA } from "../eligibility/__tests__/helpers"

const ids = (inputs: Saca2EligibilityInputs) => buildSaca2DocumentChecklist(inputs).map((item) => item.id)

describe("buildSaca2DocumentChecklist", () => {
  it("asks for nothing when nothing triggers a document", () => {
    expect(ids(makeInputs())).toEqual([])
  })

  it.each<[string, Saca2EligibilityInputs, Saca2DocumentId]>([
    ["pay stubs", makeInputs({ persons: [makePerson({ hasIncome: "yes", income: [incomeLine("wages", 100)] })] }), "payStubs"],
    ["benefit statements", makeInputs({ persons: [makePerson({ hasIncome: "yes", income: [incomeLine("pension", 100)] })] }), "benefitStatements"],
    ["rental", makeInputs({ persons: [makePerson({ hasIncome: "yes", rental: [{ amount: cents(100), isLoss: false }] })] }), "rentalIncome"],
    ["accounts", makeInputs({ assets: makeAssets({ bankAccounts: [{ open: true, balance: 0 }] }) }), "accountStatements"],
    ["real estate", makeInputs({ assets: makeAssets({ otherRealEstate: [cents(1)] }) }), "realEstate"],
    ["life insurance", makeInputs({ assets: makeAssets({ lifeInsurance: [{ faceValue: cents(1000), cashSurrenderValue: null }] }) }), "lifeInsurance"],
    ["securities", makeInputs({ assets: makeAssets({ securities: [{ kind: "stocks", value: 0 }] }) }), "securities"],
    ["annuities", makeInputs({ assets: makeAssets({ annuities: 1 }) }), "annuities"],
    ["trusts", makeInputs({ assets: makeAssets({ trusts: [{ revocable: false, principal: 0 }] }) }), "trusts"],
    ["vehicles", makeInputs({ assets: makeAssets({ vehicles: [{ fairMarketValue: 0, amountOwed: null }] }) }), "vehicles"],
    ["burial", makeInputs({ assets: makeAssets({ burial: 1 }) }), "burial"],
    ["facility deposit", makeInputs({ assets: makeAssets({ deposits: 1 }) }), "facilityDeposit"],
    ["transfers", makeInputs({ suppA: makeSuppA({ transfers: [{ date: "2024-01-01", amount: 0 }] }) }), "transfers"],
    ["spouse expenses", facilityCouple(), "spouseExpenses"],
    ["family income", makeInputs({ suppA: makeSuppA({ familyAtHome: "yes" }) }), "familyIncome"],
    ["LTC insurance", makeInputs({ suppA: makeSuppA({ ltcPolicies: 1 }) }), "ltcInsurance"],
    ["tax returns", makeInputs({ suppA: makeSuppA({ taxReturnsFiled: "bothYears", hasCopiesOfTaxReturns: "yes" }) }), "taxReturns"],
    ["IRS 4506", makeInputs({ paperwork: { signedBy: "applicant", ardSection: null, irs4506Needed: true } }), "irs4506"],
    ["guardianship expenses", makeInputs({ suppA: makeSuppA({ paysGuardianshipExpenses: "yes" }) }), "guardianshipExpenses"],
    ["immigration", makeInputs({ persons: [makePerson({ citizen: "no", hasEligibleImmigrationStatus: "yes" })] }), "immigration"],
    ["citizenship", makeInputs({ persons: [makePerson({ hasMedicareOrSsiOrSsdi: "no" })] }), "citizenshipIdentity"],
    ["Medicare card", makeInputs({ health: { hasMedicare: true, medigapOrPartD: false, wantsPartBHelp: null, employerCoverageSupplement: false } }), "medicareCard"],
    ["premium bills", makeInputs({ health: { hasMedicare: true, medigapOrPartD: true, wantsPartBHelp: null, employerCoverageSupplement: false } }), "premiumBills"],
    ["employer coverage", makeInputs({ health: { hasMedicare: false, medigapOrPartD: false, wantsPartBHelp: null, employerCoverageSupplement: true } }), "employerCoverage"],
    ["ARD-1122", makeInputs({ paperwork: { signedBy: "authorizedRepresentative", ardSection: "appointedByLaw", irs4506Needed: false } }), "ard1122"],
    ["legal authority", makeInputs({ paperwork: { signedBy: "authorizedRepresentative", ardSection: "appointedByLaw", irs4506Needed: false } }), "legalAuthority"],
  ])("%s", (_name, inputs, id) => {
    expect(ids(inputs)).toContain(id)
  })

  it("asks for 60 months of statements from facility applicants and current ones otherwise", () => {
    const facility = facilityCouple({ assets: makeAssets({ bankAccounts: [{ open: true, balance: 0 }] }) })
    expect(buildSaca2DocumentChecklist(facility).find((i) => i.id === "accountStatements")?.label).toMatch(/past 60 months/)
    const home = makeInputs({ assets: makeAssets({ bankAccounts: [{ open: true, balance: 0 }] }) })
    expect(buildSaca2DocumentChecklist(home).find((i) => i.id === "accountStatements")?.label).toMatch(/^Current statements/)
  })

  it("asks for the cash-surrender letter only above $1,500 face value per person", () => {
    const policy = (dollars: number, hasSpouse = false) =>
      ids(makeInputs({ hasSpouse, assets: makeAssets({ lifeInsurance: [{ faceValue: cents(dollars), cashSurrenderValue: null }] }) }))
    expect(policy(1500)).not.toContain("cashSurrenderLetter")
    expect(policy(1500.01)).toContain("cashSurrenderLetter")
    expect(policy(3000, true)).not.toContain("cashSurrenderLetter")
    expect(policy(3000.01, true)).toContain("cashSurrenderLetter")
  })

  it("does not ask for citizenship proof from someone who gets Medicare, SSI, or SSDI, or from a non-applicant", () => {
    expect(ids(makeInputs())).not.toContain("citizenshipIdentity")
    expect(ids(makeInputs({ persons: [makePerson({ applying: false, hasMedicareOrSsiOrSsdi: "no" })] }))).not.toContain("citizenshipIdentity")
  })

  it("lists nothing from hidden answers (vehicle rows under a No gate)", () => {
    const a = completeSingleSenior()
    a.assets.vehicles = [{ owner: "you", vehicleType: "Car", yearMakeModel: "", fairMarketValue: 9000, amountOwed: null }]
    expect(ids(readSaca2EligibilityInputs(a, ON))).not.toContain("vehicles")
  })

  it("builds the facility couple's list in a stable order with no duplicates", () => {
    const list = ids(readSaca2EligibilityInputs(completeFacilityCouple(), ON))
    expect(new Set(list).size).toBe(list.length)
    expect(list.indexOf("accountStatements")).toBeLessThan(list.indexOf("realEstate"))
    expect(list).toEqual(expect.arrayContaining(["transfers", "spouseExpenses", "medicareCard", "premiumBills", "ard1122", "taxReturns"]))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/document-checklist.test.ts`
Expected: FAIL with "Failed to resolve import ... document-checklist".

- [ ] **Step 3: Implement**

`lib/masshealth/saca2/document-checklist.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { SACA2_FIGURES } from "./figures-2026"
import { dollarsToCents, totalCents } from "./eligibility/money"
import { determineRoutes } from "./eligibility/routes"
import type { Saca2DocumentId, Saca2DocumentItem, Saca2EligibilityInputs, Saca2Figures } from "./eligibility/types"

const WORK_KINDS: ReadonlySet<string> = new Set(["wages", "selfEmployment", "farmingFishing"])

/**
 * Documents to gather, derived only from visible answers (spec §4.5 and the form's "send a copy" instructions).
 * Fixed order, no duplicates. A screening aid: MassHealth may ask for more or fewer.
 */
export function buildSaca2DocumentChecklist(inputs: Saca2EligibilityInputs, figures: Saca2Figures = SACA2_FIGURES): Saca2DocumentItem[] {
  const items: Saca2DocumentItem[] = []
  const add = (id: Saca2DocumentId, label: string, reason: string) => {
    if (!items.some((item) => item.id === id)) items.push({ id, label, reason })
  }
  const { persons, assets: a, suppA: s, health, paperwork } = inputs
  const applicants = persons.filter((p) => p.applying)
  const kinds = persons.flatMap((p) => p.income.map((line) => line.kind)).filter((kind): kind is string => kind !== null)
  const facility = determineRoutes(inputs).includes("nursingFacility")

  if (kinds.some((kind) => WORK_KINDS.has(kind))) add("payStubs", "Recent pay stubs or business records", "You reported income from work or self-employment.")
  if (kinds.some((kind) => !WORK_KINDS.has(kind))) add("benefitStatements", "Award letters or statements for Social Security, pensions, and other income", "You reported income other than work.")
  if (persons.some((p) => p.rental.length > 0)) add("rentalIncome", "Proof of rental income and expenses (leases, tenant statements, or a tax return)", "You reported rental income.")
  if (a.bankAccounts.length > 0) {
    add(
      "accountStatements",
      facility ? "Statements for every account for the past 60 months" : "Current statements for each account",
      facility ? "Nursing-facility applicants must show 60 months of account history." : "You reported bank or retirement accounts.",
    )
  }
  if (a.primaryResidence.length + a.otherRealEstate.length > 0 || s?.ownsHome === "yes") add("realEstate", "Deeds, current property-tax bills, and proof of any amount owed", "You reported real estate.")
  if (a.lifeInsurance.length > 0) add("lifeInsurance", "The first page of each life-insurance policy", "You reported life insurance.")
  const faceTotal = totalCents(a.lifeInsurance.map((policy) => policy.faceValue)).total
  if (faceTotal > dollarsToCents(figures.lifeInsuranceFaceValuePerPerson) * (inputs.hasSpouse ? 2 : 1)) {
    add("cashSurrenderLetter", "A letter from the insurer showing the current cash-surrender value (not needed for term policies)", "Total face value is more than $1,500 per person.")
  }
  if (a.securities.some((holding) => holding.kind !== "cash")) add("securities", "Proof of the current value of stocks, bonds, funds, and other investments", "You reported investments.")
  if (a.annuities > 0) add("annuities", "Each annuity contract and proof of its full value", "You reported an annuity.")
  if (a.trusts.length > 0) add("trusts", "Trust documents, amendments, records of financial activity, and the schedule of beneficiaries", "You reported a trust.")
  if (a.vehicles.length > 0) add("vehicles", "The registration for each vehicle and proof of any loan balance", "You reported a vehicle.")
  if (a.burial > 0) add("burial", "Burial contracts, trust documents, policies, or burial-account statements", "You reported a prepaid burial arrangement.")
  if (a.deposits > 0 || s?.gaveFacilityDeposit === "yes") add("facilityDeposit", "The contract with the facility and any documents about the deposit", "You reported a deposit to a care facility.")
  if (s !== null && s.transfers.length > 0) add("transfers", "Proof of each transfer of income or assets in the past 60 months", "You reported a resource transfer.")
  if (s?.spouseExpenses) add("spouseExpenses", "Proof of your spouse's housing costs (rent or mortgage, taxes, insurance, condo or co-op fee)", "Your spouse at home may keep part of your income.")
  if (s?.familyAtHome === "yes") add("familyIncome", "Proof of monthly income for each family member living with your spouse", "Family members live with your spouse.")
  if (s !== null && s.ltcPolicies > 0) add("ltcInsurance", "Each long-term-care insurance policy", "You reported long-term-care insurance.")
  if (s !== null && (s.taxReturnsFiled === "bothYears" || s.taxReturnsFiled === "oneYear") && s.hasCopiesOfTaxReturns === "yes") {
    add("taxReturns", "Copies of your federal tax returns for the last two years", "You filed tax returns and have copies.")
  }
  if (paperwork.irs4506Needed) add("irs4506", "A signed IRS Form 4506 (included with the application)", "You filed tax returns but do not have copies.")
  if (s?.paysGuardianshipExpenses === "yes") add("guardianshipExpenses", "Proof of court-ordered guardianship expenses", "You pay guardianship expenses.")
  if (applicants.some((p) => p.citizen === "no" && p.hasEligibleImmigrationStatus === "yes")) add("immigration", "Immigration documents for each noncitizen applying", "Someone applying is not a US citizen.")
  if (applicants.some((p) => p.citizen === "yes" && p.hasMedicareOrSsiOrSsdi !== "yes")) {
    add("citizenshipIdentity", "Proof of US citizenship and identity", "People who get Medicare, SSI, or SSDI usually do not need this.")
  }
  if (health.hasMedicare) add("medicareCard", "The Medicare card for each person with Medicare", "You reported Medicare.")
  if (health.medigapOrPartD || (s?.ltcPolicies ?? 0) > 0) add("premiumBills", "Recent premium bills for Medigap, Part D, or long-term-care insurance", "Premiums can affect what you pay.")
  if (health.employerCoverageSupplement) add("employerCoverage", "Details of the health coverage offered by each job (Supplement D)", "Someone is offered or enrolled in job-based coverage.")
  if (paperwork.signedBy === "authorizedRepresentative") add("ard1122", "A signed Authorized Representative Designation form (ARD-1122)", "An authorized representative will sign.")
  if (paperwork.ardSection === "appointedByLaw") add("legalAuthority", "Proof of legal authority, such as guardianship, conservatorship, or power of attorney", "The representative is appointed by law.")
  return items
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/masshealth/saca2/__tests__/document-checklist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/document-checklist.ts lib/masshealth/saca2/__tests__/document-checklist.test.ts
git commit -m "feat(saca2): add the SACA-2 document checklist

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Engine composer (gating, status, fallback, PHI guards)

**Files:**
- Create: `lib/masshealth/saca2/eligibility-engine.ts`
- Test: `lib/masshealth/saca2/__tests__/eligibility-engine.test.ts`

**Interfaces:**
- Consumes: every rule (Tasks 4–10), `readSaca2EligibilityInputs` (Task 3), `SACA2_RULE_POLICY` / `Saca2RulePolicy` (Task 2), `buildSaca2DocumentChecklist` (Task 11), `buildRecommendedApplicationTypeHref` (**created here, see Step 3, and covered by Task 14's navigation test**).
- Produces: `SACA2_SCREENING_LABEL: string`; `Saca2EvaluateOptions = { policy?: Saca2RulePolicy }`; `evaluateSaca2Eligibility(answers: Saca2Answers, figures?: Saca2Figures, onDate?: Date, options?: Saca2EvaluateOptions): Saca2EligibilityResult` (never throws); `saca2ScreeningFallback(): Saca2EligibilityResult`; `effectiveVerdict(verdict, confirmed): Saca2RuleVerdict`.

- [ ] **Step 1: Write the failing test**

`lib/masshealth/saca2/__tests__/eligibility-engine.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  SACA2_SCREENING_LABEL,
  effectiveVerdict,
  evaluateSaca2Eligibility,
} from "@/lib/masshealth/saca2/eligibility-engine"
import { SACA2_RULE_POLICY, type Saca2RulePolicy } from "@/lib/masshealth/saca2/eligibility/policy"
import { SACA2_RULE_IDS } from "@/lib/masshealth/saca2/eligibility/types"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import type { Saca2Answers } from "@/lib/masshealth/saca2/types"
import {
  completeFacilityCouple,
  completeHomeWithAllSupplements,
  completeRichHousehold,
  completeSingleSenior,
} from "./complete-answers"

const ON = new Date("2026-10-13T12:00:00Z")
const ALL_CONFIRMED = Object.fromEntries(
  SACA2_RULE_IDS.map((id) => [id, { ...SACA2_RULE_POLICY[id], confirmed: true }]),
) as Saca2RulePolicy
const codes = (r: { findings: Array<{ code: string }> }) => r.findings.map((f) => f.code)

afterEach(() => vi.restoreAllMocks())

describe("evaluateSaca2Eligibility: gating and status", () => {
  it("as shipped, a clean single senior is NEEDS_REVIEW because rules 3-7 are unconfirmed", () => {
    const r = evaluateSaca2Eligibility(completeSingleSenior(), SACA2_FIGURES, ON)
    expect(r.status).toBe("NEEDS_REVIEW")
    expect(r.screening_label).toBe(SACA2_SCREENING_LABEL)
    expect(r.rule_results.map((x) => x.id)).toEqual([...SACA2_RULE_IDS])
    const assets = r.rules.find((x) => x.id === "SACA2_R3_ASSETS")
    expect(assets).toMatchObject({ confirmed: false, verdict: "pass", effective_verdict: "review" })
    expect(r.rule_results.find((x) => x.id === "SACA2_R3_ASSETS")).toMatchObject({ status: "warning" })
    expect(r.rule_results.find((x) => x.id === "SACA2_R3_ASSETS")?.message).toMatch(/not yet been confirmed/)
    expect(r.rules.find((x) => x.id === "SACA2_R1_RESIDENCY_ROUTE")).toMatchObject({ confirmed: true, effective_verdict: "pass" })
    expect(codes(r)).toContain("SACA2_RULES_UNCONFIRMED")
  })

  it("marks every rule with the registry's confirmed flag", () => {
    const r = evaluateSaca2Eligibility(completeSingleSenior(), SACA2_FIGURES, ON)
    for (const rule of r.rules) expect(rule.confirmed).toBe(SACA2_RULE_POLICY[rule.id].confirmed)
  })

  it("with every rule confirmed the same answers are LIKELY_ELIGIBLE", () => {
    expect(evaluateSaca2Eligibility(completeSingleSenior(), SACA2_FIGURES, ON, { policy: ALL_CONFIRMED }).status).toBe("LIKELY_ELIGIBLE")
  })

  it("never lets an unconfirmed fail become LIKELY_INELIGIBLE", () => {
    const a = completeSingleSenior()
    a.assets.gates.bankAccounts = "yes"
    a.assets.bankAccounts = [{ ownerName: "Edna Testcase", accountType: "savings", institution: "Example Bank", accountNumber: "1", currentBalance: 9000, balanceOnAdmissionDate: null, open: true, closedOn: null, balanceWhenClosed: null }]
    expect(evaluateSaca2Eligibility(a, SACA2_FIGURES, ON).status).toBe("NEEDS_REVIEW")
    expect(evaluateSaca2Eligibility(a, SACA2_FIGURES, ON, { policy: ALL_CONFIRMED }).status).toBe("LIKELY_INELIGIBLE")
  })

  it("uses the figures it is given, not the module constant", () => {
    const a = completeSingleSenior()
    a.assets.gates.bankAccounts = "yes"
    a.assets.bankAccounts = [{ ownerName: "Edna Testcase", accountType: "savings", institution: "Example Bank", accountNumber: "1", currentBalance: 1500, balanceOnAdmissionDate: null, open: true, closedOn: null, balanceWhenClosed: null }]
    const lower = { ...SACA2_FIGURES, assetLimit: { individual: 1000, marriedCoupleMember: 3000 } }
    expect(evaluateSaca2Eligibility(a, lower, ON, { policy: ALL_CONFIRMED }).status).toBe("LIKELY_INELIGIBLE")
  })

  it("redirects a child caregiver to ACA-3 with a static chooser link", () => {
    const a = completeSingleSenior()
    a.persons[0].caregiverOfChildUnder19 = "yes"
    a.persons[0].caregiverChildren = [{ name: "Test Child", dateOfBirth: "2015-01-01" }]
    const r = evaluateSaca2Eligibility(a, SACA2_FIGURES, ON)
    expect(r.status).toBe("REDIRECT_ACA3")
    expect(r.redirect_href).toBe("/application/type?recommended=aca3")
  })

  it("ignores stale hidden income end to end", () => {
    const a = completeSingleSenior()
    a.persons[0].income = [{ kind: "wages", amount: 9000, frequency: "monthly" }]
    expect(evaluateSaca2Eligibility(a, SACA2_FIGURES, ON, { policy: ALL_CONFIRMED }).status).toBe("LIKELY_ELIGIBLE")
  })

  it("maps verdicts through confirmation", () => {
    expect(effectiveVerdict("pass", false)).toBe("review")
    expect(effectiveVerdict("fail", false)).toBe("review")
    expect(effectiveVerdict("documents", false)).toBe("review")
    expect(effectiveVerdict("notApplicable", false)).toBe("notApplicable")
    expect(effectiveVerdict("fail", true)).toBe("fail")
  })
})

describe("evaluateSaca2Eligibility: never throws", () => {
  it.each([
    ["completeSingleSenior", completeSingleSenior],
    ["completeFacilityCouple", completeFacilityCouple],
    ["completeRichHousehold", completeRichHousehold],
    ["completeHomeWithAllSupplements", completeHomeWithAllSupplements],
  ])("%s evaluates without hitting the fallback", (_name, build) => {
    expect(codes(evaluateSaca2Eligibility(build(), SACA2_FIGURES, ON))).not.toContain("SACA2_SCREENING_ERROR")
  })

  it("falls back to NEEDS_REVIEW with a generic message for malformed answers, a bad date, or figures with no effective entry", () => {
    const malformed = { ...completeSingleSenior(), persons: null } as unknown as Saca2Answers
    for (const r of [
      evaluateSaca2Eligibility(malformed, SACA2_FIGURES, ON),
      evaluateSaca2Eligibility(completeSingleSenior(), SACA2_FIGURES, new Date("not a date")),
      evaluateSaca2Eligibility(completeFacilityCouple(), SACA2_FIGURES, new Date("2020-01-01T12:00:00Z")),
    ]) {
      expect(r.status).toBe("NEEDS_REVIEW")
      expect(codes(r)).toEqual(["SACA2_SCREENING_ERROR"])
      expect(r.screening_label).toBe(SACA2_SCREENING_LABEL)
    }
  })
})

describe("evaluateSaca2Eligibility: PHI", () => {
  it("never writes to the console", () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    evaluateSaca2Eligibility(completeFacilityCouple(), SACA2_FIGURES, ON)
    evaluateSaca2Eligibility({ persons: null } as unknown as Saca2Answers, SACA2_FIGURES, ON)
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })

  it("puts no names, claim numbers, or account numbers in the result", () => {
    const json = JSON.stringify(evaluateSaca2Eligibility(completeFacilityCouple(), SACA2_FIGURES, ON))
    for (const secret of ["Walter", "Dorothy", "Testcase", "1EG4-TE5-MK72", "Example Bank", "Quinn"]) expect(json).not.toContain(secret)
  })

  it("never says APPROVED", () => {
    expect(JSON.stringify(evaluateSaca2Eligibility(completeSingleSenior(), SACA2_FIGURES, ON, { policy: ALL_CONFIRMED }))).not.toMatch(/APPROVED/)
  })
})

describe("client-bundle safety", () => {
  const FILES = [
    "lib/masshealth/saca2/eligibility-engine.ts",
    "lib/masshealth/saca2/document-checklist.ts",
    "lib/masshealth/saca2/eligibility/inputs.ts",
    "lib/masshealth/saca2/eligibility/money.ts",
    "lib/masshealth/saca2/eligibility/dates.ts",
    "lib/masshealth/saca2/eligibility/routes.ts",
    "lib/masshealth/saca2/eligibility/income-sum.ts",
    "lib/masshealth/saca2/eligibility/policy.ts",
    "lib/masshealth/saca2/eligibility/rules/assets.ts",
    "lib/masshealth/saca2/eligibility/rules/citizenship.ts",
    "lib/masshealth/saca2/eligibility/rules/home-equity.ts",
    "lib/masshealth/saca2/eligibility/rules/income.ts",
    "lib/masshealth/saca2/eligibility/rules/medicare.ts",
    "lib/masshealth/saca2/eligibility/rules/residency-route.ts",
    "lib/masshealth/saca2/eligibility/rules/spousal-allowance.ts",
    "lib/masshealth/saca2/eligibility/rules/transfers.ts",
    "lib/masshealth/saca2/pdf/derived-assets.ts",
    "lib/masshealth/saca2/pdf/visible-reader.ts",
  ]
  const FORBIDDEN = /^(pdf-lib|server-only|node:.*|.*\/pdf-fill|.*\/template)$/

  it.each(FILES)("%s has no runtime import of server-only modules", (file) => {
    const source = readFileSync(path.join(process.cwd(), file), "utf8")
    const runtimeImports = [...source.matchAll(/import\s+(?!type\b)[^"]*?from\s+"([^"]+)"/g)].map((m) => m[1])
    expect(runtimeImports.filter((specifier) => FORBIDDEN.test(specifier))).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/eligibility-engine.test.ts`
Expected: FAIL with "Failed to resolve import ... eligibility-engine".

- [ ] **Step 3: Implement**

First add the navigation helper (Task 14 adds its test and its other callers). In `lib/applications/navigation.ts`, add the import under the existing one and the function at the end:

```ts
import type { MassHealthApplicationType } from "@/lib/masshealth/types"
```

```ts
/** The application chooser with one type highlighted. Static: never carries applicant data. */
export function buildRecommendedApplicationTypeHref(type: MassHealthApplicationType): string {
  return `/application/type?${new URLSearchParams({ recommended: type }).toString()}`
}
```

`lib/masshealth/saca2/eligibility-engine.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { buildRecommendedApplicationTypeHref } from "@/lib/applications/navigation"
import type { EligibilityRuleResult, EligibilityRuleStatus } from "@/lib/masshealth/types"
import { buildSaca2DocumentChecklist } from "./document-checklist"
import { readSaca2EligibilityInputs } from "./eligibility/inputs"
import { dollarsToCents } from "./eligibility/money"
import { finding, worstVerdict } from "./eligibility/outcome"
import { SACA2_RULE_POLICY, type Saca2RulePolicy } from "./eligibility/policy"
import { evaluateAssets } from "./eligibility/rules/assets"
import { evaluateCitizenship } from "./eligibility/rules/citizenship"
import { evaluateHomeEquity } from "./eligibility/rules/home-equity"
import { evaluateIncome } from "./eligibility/rules/income"
import { evaluateMedicare } from "./eligibility/rules/medicare"
import { evaluateResidencyRoute } from "./eligibility/rules/residency-route"
import { evaluateSpousalAllowance } from "./eligibility/rules/spousal-allowance"
import { evaluateTransfers } from "./eligibility/rules/transfers"
import {
  emptyEstimates,
  type Saca2EligibilityResult,
  type Saca2Estimates,
  type Saca2Figures,
  type Saca2RuleOutcome,
  type Saca2RuleReport,
  type Saca2RuleVerdict,
  type Saca2ScreeningStatus,
} from "./eligibility/types"
import { SACA2_FIGURES } from "./figures-2026"
import type { Saca2Answers } from "./types"

export const SACA2_SCREENING_LABEL =
  "Screening estimate only. This is not a MassHealth decision: MassHealth decides eligibility after you apply."

const UNCONFIRMED_NOTE =
  " Screening estimate: this rule has not yet been confirmed against MassHealth regulations, so the result needs review."

const STATUS_BY_VERDICT: Record<Saca2RuleVerdict, Saca2ScreeningStatus> = {
  redirect: "REDIRECT_ACA3",
  fail: "LIKELY_INELIGIBLE",
  review: "NEEDS_REVIEW",
  documents: "PENDING_DOCUMENTS",
  pass: "LIKELY_ELIGIBLE",
  notApplicable: "LIKELY_ELIGIBLE",
}

/** `EligibilityRuleStatus` has no review value; review and documents render as warnings. */
const RULE_STATUS: Record<Saca2RuleVerdict, EligibilityRuleStatus> = {
  pass: "pass",
  notApplicable: "pass",
  fail: "fail",
  redirect: "fail",
  review: "warning",
  documents: "warning",
}

export interface Saca2EvaluateOptions {
  /** Defaults to SACA2_RULE_POLICY. Tests pass an all-confirmed copy to exercise each rule's own logic. */
  policy?: Saca2RulePolicy
}

/** An unconfirmed rule can only say "review" (or "does not apply"): never a guess, never an approval. */
export function effectiveVerdict(verdict: Saca2RuleVerdict, confirmed: boolean): Saca2RuleVerdict {
  if (confirmed || verdict === "notApplicable" || verdict === "review") return verdict
  return "review"
}

export function saca2ScreeningFallback(): Saca2EligibilityResult {
  return {
    status: "NEEDS_REVIEW",
    screening_label: SACA2_SCREENING_LABEL,
    findings: [
      finding("SACA2_SCREENING_ERROR", "warning", "We couldn't estimate a result from these answers. You can still apply; MassHealth will review your application."),
    ],
    rule_results: [],
    rules: [],
    estimates: emptyEstimates(),
    required_documents: [],
    document_checklist: [],
  }
}

function evaluate(answers: Saca2Answers, figures: Saca2Figures, on: Date, policy: Saca2RulePolicy): Saca2EligibilityResult {
  if (Number.isNaN(on.getTime())) throw new Error("Invalid screening date")
  const inputs = readSaca2EligibilityInputs(answers, on)
  const spousal = evaluateSpousalAllowance(inputs, figures, on)
  const allowance = spousal.estimates.spousalAllowance
  const outcomes: Saca2RuleOutcome[] = [
    evaluateResidencyRoute(inputs),
    evaluateCitizenship(inputs),
    evaluateAssets(inputs, figures),
    evaluateHomeEquity(inputs, figures),
    evaluateTransfers(inputs, figures, on),
    evaluateIncome(inputs, figures, on, allowance ? dollarsToCents(allowance.allowance) : null),
    spousal,
    evaluateMedicare(inputs, figures),
  ]

  const rules: Saca2RuleReport[] = outcomes.map((o) => {
    const { label, confirmed } = policy[o.id]
    return { id: o.id, label, confirmed, verdict: o.verdict, effective_verdict: effectiveVerdict(o.verdict, confirmed) }
  })
  const findings = outcomes.flatMap((o) => o.findings)
  if (rules.some((rule) => rule.effective_verdict !== rule.verdict)) {
    findings.push(finding("SACA2_RULES_UNCONFIRMED", "info", "Some screening rules have not yet been checked against MassHealth regulations, so MassHealth needs to review this estimate."))
  }
  const ruleResults: EligibilityRuleResult[] = outcomes.map((o, index) => {
    const rule = rules[index]
    return {
      id: o.id,
      label: rule.label,
      status: RULE_STATUS[rule.effective_verdict],
      message: rule.effective_verdict !== rule.verdict ? `${o.message}${UNCONFIRMED_NOTE}` : o.message,
    }
  })
  const status = STATUS_BY_VERDICT[worstVerdict(rules.map((rule) => rule.effective_verdict))]
  const estimates: Saca2Estimates = Object.assign(emptyEstimates(), ...outcomes.map((o) => o.estimates))
  const checklist = buildSaca2DocumentChecklist(inputs, figures)

  return {
    status,
    screening_label: SACA2_SCREENING_LABEL,
    findings,
    rule_results: ruleResults,
    rules,
    estimates,
    required_documents: checklist.map((item) => item.label),
    document_checklist: checklist,
    ...(status === "REDIRECT_ACA3" ? { redirect_href: buildRecommendedApplicationTypeHref("aca3") } : {}),
  }
}

/**
 * SACA-2 screening estimate (spec §4.4). Runs on in-memory answers only, logs nothing, stores nothing, and
 * never throws: any failure becomes NEEDS_REVIEW with a generic message (no answer content).
 */
export function evaluateSaca2Eligibility(
  answers: Saca2Answers,
  figures: Saca2Figures = SACA2_FIGURES,
  onDate: Date = new Date(),
  options: Saca2EvaluateOptions = {},
): Saca2EligibilityResult {
  try {
    return evaluate(answers, figures, onDate, options.policy ?? SACA2_RULE_POLICY)
  } catch {
    return saca2ScreeningFallback()
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/masshealth/saca2 lib/applications && npx tsc --noEmit -p tsconfig.json`
Expected: PASS. If a complete fixture hits `SACA2_SCREENING_ERROR`, temporarily call `evaluate` directly in a scratch test to see the thrown path error (it names a path, never an answer) and fix the path in `inputs.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/eligibility-engine.ts lib/masshealth/saca2/__tests__/eligibility-engine.test.ts lib/applications/navigation.ts
git commit -m "feat(saca2): add the SACA-2 screening engine with confirmation gating

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Synthetic cases with expected screening outcomes (spec §5.3)

**Files:**
- Modify: `lib/masshealth/saca2/synthetic-cases.ts`
- Test: `lib/masshealth/saca2/__tests__/synthetic-screening.test.ts`
- Test (unchanged, must still pass): `lib/masshealth/saca2/__tests__/synthetic-cases.test.ts`, `components/application/saca2/__tests__/saca2-wizard.test.tsx`

**Interfaces:**
- Consumes: `evaluateSaca2Eligibility`, `SACA2_RULE_POLICY`, `SACA2_RULE_IDS`, `Saca2ScreeningStatus`, `Saca2RuleId`, `Saca2RuleVerdict`.
- Produces: `Saca2ExpectedScreening = { asShipped: Saca2ScreeningStatus; ifAllConfirmed: Saca2ScreeningStatus; verdicts: Record<Saca2RuleId, Saca2RuleVerdict> }` and a new required field `expectedScreening` on `Saca2SyntheticCase`. Case ids and visible steps are unchanged.

- [ ] **Step 1: Write the failing test**

`lib/masshealth/saca2/__tests__/synthetic-screening.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { evaluateSaca2Eligibility } from "@/lib/masshealth/saca2/eligibility-engine"
import { SACA2_RULE_POLICY, type Saca2RulePolicy } from "@/lib/masshealth/saca2/eligibility/policy"
import { SACA2_RULE_IDS } from "@/lib/masshealth/saca2/eligibility/types"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { SACA2_SYNTHETIC_CASES, getSyntheticCase } from "@/lib/masshealth/saca2/synthetic-cases"

const ALL_CONFIRMED = Object.fromEntries(
  SACA2_RULE_IDS.map((id) => [id, { ...SACA2_RULE_POLICY[id], confirmed: true }]),
) as Saca2RulePolicy
const onOf = (c: { referenceDate: string }) => new Date(`${c.referenceDate}T12:00:00Z`)
const cases = SACA2_SYNTHETIC_CASES.map((c) => [c.id, c] as const)

describe("synthetic cases: screening outcomes", () => {
  it.each(cases)("%s: status as shipped", (_id, c) => {
    expect(evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c)).status).toBe(c.expectedScreening.asShipped)
  })

  it.each(cases)("%s: status if every rule were confirmed", (_id, c) => {
    expect(evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c), { policy: ALL_CONFIRMED }).status).toBe(c.expectedScreening.ifAllConfirmed)
  })

  it.each(cases)("%s: each rule's own verdict", (_id, c) => {
    const rules = evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c)).rules
    expect(Object.fromEntries(rules.map((r) => [r.id, r.verdict]))).toEqual(c.expectedScreening.verdicts)
  })

  it("couple in a nursing facility: transfers, allowance, patient-paid amount, community-spouse band", () => {
    const c = getSyntheticCase("couple-spouse-in-nursing-facility")
    const e = evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c)).estimates
    expect(e.transfersInWindow).toEqual({ count: 1, total: 30000, penaltyDays: 66, lookBackStart: "2021-10-13" })
    expect(e.spousalAllowance).toEqual({ mmmna: 4066.5, excessShelter: 2153.5, allowance: 2766.5 })
    expect(e.patientPaidAmount).toBe(0)
    expect(e.countableAssets).toBe(72000)
    expect(e.communitySpouseResource).toEqual({ min: 32532, max: 162660 })
  })

  it("mixed-age couple: two-person household with biweekly wages", () => {
    const c = getSyntheticCase("mixed-age-couple")
    expect(evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c)).estimates).toMatchObject({ householdSize: 2, monthlyIncome: 2466.67, fplPercent: 137 })
  })

  it("overflow accounts: $3,200 against the $2,000 limit", () => {
    const c = getSyntheticCase("overflow-accounts")
    expect(evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c)).estimates).toMatchObject({ countableAssets: 3200, assetLimit: 2000 })
  })

  it("senior parent of a child under 19: links to the ACA-3 chooser", () => {
    const c = getSyntheticCase("senior-parent-of-child-under-19")
    expect(evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c)).redirect_href).toBe("/application/type?recommended=aca3")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/masshealth/saca2/__tests__/synthetic-screening.test.ts`
Expected: FAIL (`expectedScreening` is undefined; TypeScript errors on the property).

- [ ] **Step 3: Implement the fixture changes**

In `lib/masshealth/saca2/synthetic-cases.ts`:

(a) Imports and types. Replace the import block and the interface with:

```ts
import type { Saca2RuleId, Saca2RuleVerdict, Saca2ScreeningStatus } from "./eligibility/types"
import type { Saca2StepId } from "./schema"
import {
  emptySaca2Answers,
  emptySaca2Person,
  type AssetCategory,
  type BankAccountRow,
  type Saca2Answers,
  type Saca2Person,
} from "./types"

export interface Saca2ExpectedScreening {
  /** Status with the rule policy as shipped (rules 3-7 unconfirmed). */
  asShipped: Saca2ScreeningStatus
  /** Status if every rule were confirmed: pins each rule's own logic end to end. */
  ifAllConfirmed: Saca2ScreeningStatus
  /** Each rule's own verdict, before confirmation gating. */
  verdicts: Record<Saca2RuleId, Saca2RuleVerdict>
}

/** All data below is fabricated. Never copy real applicant data here. */
export interface Saca2SyntheticCase {
  id: string
  description: string
  /** ISO date used as "today" so age-gated rules are deterministic. */
  referenceDate: string
  answers: Saca2Answers
  expectedVisibleSteps: Saca2StepId[]
  expectedScreening: Saca2ExpectedScreening
}
```

(b) Add this helper after `account(...)`:

```ts
const ASSET_GATES: AssetCategory[] = [
  "bankAccounts",
  "retirementAccounts",
  "closedAccounts",
  "primaryResidence",
  "otherRealEstate",
  "lifeInsurance",
  "securities",
  "annuities",
  "assistedLivingDeposit",
  "vehicles",
  "burial",
  "trusts",
]

/** Answer every asset gate the way the wizard requires: Yes for the listed categories, No for the rest. */
function answerGates(a: Saca2Answers, yes: AssetCategory[]) {
  for (const gate of ASSET_GATES) a.assets.gates[gate] = yes.includes(gate) ? "yes" : "no"
}

const NOT_APPLICABLE_LTC = {
  SACA2_R4_HOME_EQUITY: "notApplicable",
  SACA2_R5_TRANSFERS: "notApplicable",
  SACA2_R7_SPOUSAL_ALLOWANCE: "notApplicable",
} as const
```

(c) Make the builders answer the gates the wizard would show. Edit each builder as follows and leave every other line as it is:
- `singleSenior()`: add `a.intake.programs.masshealthHsn = true`. In the `person({...})` call add `hasIncome: "yes"` and `hasMedicareOrSsiOrSsdi: "yes"`, and change the Social Security amount from `1400` to `1250`. After `a.assets.bankAccounts = …` add `answerGates(a, ["bankAccounts"])`.
- `spouseInNursingFacility()`: in Walter's `person({...})` add `hasIncome: "yes"` and `hasMedicareOrSsiOrSsdi: "yes"`. In Dorothy's add `hasIncome: "yes"` and `inInstitution: "no"` (the non-applying spouse must answer it, or the spouse-institution check reads it as unknown). Before `return a` add:

```ts
  a.supplements.a.applyingHcbsWaiver = "no"
  a.supplements.a.applyingPace = "no"
  a.supplements.a.familyAtHome.hasFamily = "no"
  a.supplements.a.transferAnswers = {
    trust: "no",
    income: "no",
    assets: "yes",
    deed: "no",
    lifeEstateLivedOneYear: null,
    addedToDeed: "no",
    loanOrNote: "no",
    annuity: "no",
  }
  a.supplements.a.facilityDeposit.gaveDeposit = "no"
  a.supplements.a.home.ownsHome = "yes"
  a.supplements.a.home.properties = [
    { ownerNames: "Walter Testcase", propertyAddress: "1 Example St, Testville MA", ownershipType: "individual", fairMarketValue: 450000 },
  ]
  a.supplements.a.home.spouse = { has: "yes", name: "Dorothy Testcase", livesInHome: "yes" }
  a.supplements.a.home.disabledChild.has = "no"
  a.supplements.a.home.childUnder21.has = "no"
  a.supplements.a.home.sibling.has = "no"
  a.supplements.a.home.caregiverChild.has = "no"
  a.supplements.a.home.dependentRelative.has = "no"
  a.supplements.a.home.ownsOtherRealEstate = "no"
  a.supplements.a.longTermCareInsurance.hasPolicy = "no"
  answerGates(a, ["bankAccounts", "primaryResidence"])
```

- `hcbsWaiver()`: in the `person({...})` call add `hasIncome: "yes"` (leave `hasMedicareOrSsiOrSsdi` unanswered on purpose, so this case needs citizenship proof). Before `return a` add:

```ts
  a.supplements.a.needsNursingFacility = "no"
  a.supplements.a.applyingPace = "no"
  a.supplements.a.transferAnswers = {
    trust: "no",
    income: "no",
    assets: "no",
    deed: "no",
    lifeEstateLivedOneYear: null,
    addedToDeed: "no",
    loanOrNote: "no",
    annuity: "no",
  }
  a.supplements.a.facilityDeposit.gaveDeposit = "no"
  a.supplements.a.home.ownsHome = "no"
  a.supplements.a.home.ownsOtherRealEstate = "no"
  a.supplements.a.longTermCareInsurance.hasPolicy = "no"
  answerGates(a, [])
```

- `seniorParentOfChild()`: after setting `caregiverOfChildUnder19` add `a.persons[0].caregiverChildren = [{ name: "Test Child", dateOfBirth: "2012-05-01" }]`.
- `mixedAgeCouple()`: add `a.intake.programs.masshealthHsn = true`. In Harold's `person({...})` add `hasIncome: "yes"`, `hasMedicareOrSsiOrSsdi: "yes"` and `income: [{ kind: "socialSecurity", amount: 1600, frequency: "monthly" }]`. In June's add `hasIncome: "yes"`, `hasMedicareOrSsiOrSsdi: "no"` and `income: [{ kind: "wages", amount: 400, frequency: "every2weeks", seasonal: "no" }]`. Before `return a` add `answerGates(a, [])`.
- `trustAndAnnuity()`: before `return a` add `a.supplements.a.transferAnswers.annuity = "yes"` and `answerGates(a, ["bankAccounts", "primaryResidence", "annuities", "trusts"])`.
- `overflowAccounts()`: no change (it builds on `singleSenior()`).

(d) Add `expectedScreening` to each entry of `SACA2_SYNTHETIC_CASES` (and update the single-senior description to "Social Security only ($1,250/month)"):

```ts
  // single-senior-home
    expectedScreening: {
      asShipped: "NEEDS_REVIEW",
      ifAllConfirmed: "LIKELY_ELIGIBLE",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "pass",
        SACA2_R2_CITIZENSHIP: "pass",
        SACA2_R3_ASSETS: "pass",
        SACA2_R6_INCOME: "pass",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
        ...NOT_APPLICABLE_LTC,
      },
    },
  // couple-spouse-in-nursing-facility
    expectedScreening: {
      asShipped: "NEEDS_REVIEW",
      ifAllConfirmed: "NEEDS_REVIEW",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "pass",
        SACA2_R2_CITIZENSHIP: "pass",
        SACA2_R3_ASSETS: "review",
        SACA2_R4_HOME_EQUITY: "pass",
        SACA2_R5_TRANSFERS: "review",
        SACA2_R6_INCOME: "pass",
        SACA2_R7_SPOUSAL_ALLOWANCE: "pass",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
      },
    },
  // hcbs-waiver-applicant
    expectedScreening: {
      asShipped: "NEEDS_REVIEW",
      ifAllConfirmed: "PENDING_DOCUMENTS",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "pass",
        SACA2_R2_CITIZENSHIP: "documents",
        SACA2_R3_ASSETS: "pass",
        SACA2_R4_HOME_EQUITY: "notApplicable",
        SACA2_R5_TRANSFERS: "pass",
        SACA2_R6_INCOME: "pass",
        SACA2_R7_SPOUSAL_ALLOWANCE: "notApplicable",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
      },
    },
  // senior-parent-of-child-under-19
    expectedScreening: {
      asShipped: "REDIRECT_ACA3",
      ifAllConfirmed: "REDIRECT_ACA3",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "redirect",
        SACA2_R2_CITIZENSHIP: "pass",
        SACA2_R3_ASSETS: "pass",
        SACA2_R6_INCOME: "pass",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
        ...NOT_APPLICABLE_LTC,
      },
    },
  // mixed-age-couple
    expectedScreening: {
      asShipped: "NEEDS_REVIEW",
      ifAllConfirmed: "NEEDS_REVIEW",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "pass",
        SACA2_R2_CITIZENSHIP: "documents",
        SACA2_R3_ASSETS: "pass",
        SACA2_R6_INCOME: "review",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
        ...NOT_APPLICABLE_LTC,
      },
    },
  // trust-and-annuity-applicant
    expectedScreening: {
      asShipped: "NEEDS_REVIEW",
      ifAllConfirmed: "NEEDS_REVIEW",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "pass",
        SACA2_R2_CITIZENSHIP: "pass",
        SACA2_R3_ASSETS: "review",
        SACA2_R4_HOME_EQUITY: "pass",
        SACA2_R5_TRANSFERS: "review",
        SACA2_R6_INCOME: "pass",
        SACA2_R7_SPOUSAL_ALLOWANCE: "pass",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
      },
    },
  // overflow-accounts
    expectedScreening: {
      asShipped: "NEEDS_REVIEW",
      ifAllConfirmed: "LIKELY_INELIGIBLE",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "pass",
        SACA2_R2_CITIZENSHIP: "pass",
        SACA2_R3_ASSETS: "fail",
        SACA2_R6_INCOME: "pass",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
        ...NOT_APPLICABLE_LTC,
      },
    },
```

Expected values, worked out by hand. Use them to check a failing assertion before changing anything:
- Single senior: $1,250 / $1,330 = 94% FPL, $1,200 of assets is at most $2,000, and a citizen with Medicare passes.
- Facility couple: income $2,100 + $600 = $2,700, at most $2,982. Shelter $1,500 + $120 + $400 + $945 = $2,965, so excess is $2,965 − $811.50 = $2,153.50 and MMMNA is min($4,066.50, $2,705 + $2,153.50) = $4,066.50. The allowance is $4,066.50 − $1,300 = $2,766.50, and the patient-paid amount is max(0, $2,700 − $72.80 − $2,766.50) = 0. Assets are $54,000 + $18,000 = $72,000, with the home excluded because the spouse lives there; that falls in the band → review. The $30,000 transfer on 2024-03-15 gives 66 days.
- HCBS: assets 0, transfers all No, $1,500 is at most $2,982, and a citizen with an unanswered Medicare/SSI/SSDI question needs documents.
- Mixed-age: $1,600 + $400 × 26 / 12 = $2,466.67. Against $1,804 that is 137% → review. June needs documents.
- Trust and annuity: the annuity and the non-revocable trust → rule 3 review. The annuity answer "yes" → rule 5 review.
- Overflow: $500 + $700 + $900 + $1,100 = $3,200 > $2,000 → fail.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/masshealth/saca2/__tests__/synthetic-screening.test.ts lib/masshealth/saca2/__tests__/synthetic-cases.test.ts components/application/saca2/__tests__/saca2-wizard.test.tsx && npx tsc --noEmit -p tsconfig.json`
Expected: PASS. In particular, `synthetic-cases.test.ts` still matches every case's `expectedVisibleSteps` (none of the edits change a step gate), and the fabricated-identifier check still passes.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/saca2/synthetic-cases.ts lib/masshealth/saca2/__tests__/synthetic-screening.test.ts
git commit -m "test(saca2): give the synthetic cases expected screening outcomes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 14: ACA-3 and ACA-3-AP links to the real SACA-2 flow

**Files:**
- Modify: `lib/masshealth/types.ts` (`Aca3ApEligibilityResult`: add optional `redirect_href`)
- Modify: `lib/masshealth/aca3ap-eligibility-engine.ts` (set it on `REDIRECT_SACA2`)
- Modify: `lib/masshealth/application-checks.ts` (`ApplicationCheckResult`: optional `actionHref`, `actionLabel`; set them on `age.{i}.senior`)
- Modify: `components/application/ApplicationChecksPanel.tsx` (render the link)
- Modify: `lib/applications/__tests__/navigation.test.ts`
- Test: `lib/masshealth/__tests__/aca3ap-redirect.test.ts`
- Test: `lib/masshealth/__tests__/application-checks-saca2-link.test.ts`
- Test: `components/application/__tests__/application-checks-panel.test.tsx`

**Interfaces:**
- Consumes: `buildRecommendedApplicationTypeHref` (added in Task 12).
- Produces: `Aca3ApEligibilityResult.redirect_href?: string` (present only when the status is `REDIRECT_SACA2`); `ApplicationCheckResult.actionHref?: string`, `actionLabel?: string`. All other ACA-3 / ACA-3-AP fields and statuses stay as they are.

- [ ] **Step 1: Write the failing tests**

Append to `lib/applications/__tests__/navigation.test.ts` (and add `buildRecommendedApplicationTypeHref` to its import):

```ts
  it("builds static chooser links with one type highlighted", () => {
    expect(buildRecommendedApplicationTypeHref("saca2")).toBe("/application/type?recommended=saca2")
    expect(buildRecommendedApplicationTypeHref("aca3")).toBe("/application/type?recommended=aca3")
  })
```

`lib/masshealth/__tests__/aca3ap-redirect.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { evaluateAca3ApEligibility } from "@/lib/masshealth/aca3ap-eligibility-engine"
import type { Aca3ApEligibilityApplicantInput } from "@/lib/masshealth/types"

function input(overrides: Partial<Aca3ApEligibilityApplicantInput> = {}): Aca3ApEligibilityApplicantInput {
  return {
    applicantId: "test-1",
    age: 40,
    maResident: true,
    citizenshipStatus: "US_CITIZEN",
    addingToExistingCase: true,
    existingHouseholdSize: 2,
    pregnant: false,
    unbornChildren: 0,
    disabled: false,
    medicalVerification: false,
    hasOtherInsurance: false,
    income: {},
    identityVerified: true,
    verification: { ssnVerified: true, incomeVerified: true, immigrationVerified: true },
    ...overrides,
  }
}

describe("ACA-3-AP REDIRECT_SACA2 link", () => {
  it("links a 65+ person to the SACA-2 chooser", () => {
    const r = evaluateAca3ApEligibility(input({ age: 70 }))
    expect(r.status).toBe("REDIRECT_SACA2")
    expect(r.redirect_href).toBe("/application/type?recommended=saca2")
  })

  it("adds no link otherwise and keeps the existing behavior", () => {
    const young = evaluateAca3ApEligibility(input())
    expect(young.status).toBe("APPROVED")
    expect("redirect_href" in young).toBe(false)
    const denied = evaluateAca3ApEligibility(input({ age: 70, maResident: false }))
    expect(denied.status).toBe("DENIED")
    expect("redirect_href" in denied).toBe(false)
  })
})
```

`lib/masshealth/__tests__/application-checks-saca2-link.test.ts`:

```ts
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { runApplicationChecks } from "@/lib/masshealth/application-checks"

const data = (dob: string) => ({
  contact: { p1_name: "", p1_dob: dob },
  persons: [{ identity: {}, ssn: {}, coverage: { applying_for_coverage: "yes" }, income: {} }],
})

describe("application checks: SACA-2 link on the senior warning", () => {
  it("links 65+ applicants to the SACA-2 chooser", () => {
    const senior = runApplicationChecks(data("01/15/1940")).find((r) => r.id === "age.0.senior")
    expect(senior).toMatchObject({ actionHref: "/application/type?recommended=saca2", actionLabel: "Start a SACA-2 application" })
  })

  it("adds no link to other age checks", () => {
    const minor = runApplicationChecks(data("01/15/2015")).find((r) => r.id === "age.0.minor")
    expect(minor).toBeDefined()
    expect(minor?.actionHref).toBeUndefined()
  })
})
```

`components/application/__tests__/application-checks-panel.test.tsx`:

```tsx
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ApplicationChecksPanel } from "@/components/application/ApplicationChecksPanel"

describe("ApplicationChecksPanel", () => {
  it("renders a result's action as a link and omits it when absent", () => {
    render(
      <ApplicationChecksPanel
        results={[
          { id: "age.0.senior", severity: "warning", category: "age_thresholds", title: "Senior applicant", message: "m", actionHref: "/application/type?recommended=saca2", actionLabel: "Start a SACA-2 application" },
          { id: "age.1.minor", severity: "info", category: "age_thresholds", title: "Minor applicant", message: "n" },
        ]}
      />,
    )
    expect(screen.getByRole("link", { name: "Start a SACA-2 application" })).toHaveAttribute("href", "/application/type?recommended=saca2")
    expect(screen.getAllByRole("link")).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/applications lib/masshealth/__tests__/aca3ap-redirect.test.ts lib/masshealth/__tests__/application-checks-saca2-link.test.ts components/application/__tests__/application-checks-panel.test.tsx`
Expected: FAIL. `redirect_href` and `actionHref` are undefined and the panel has no link. The navigation test passes already, because Task 12 added the helper.

- [ ] **Step 3: Implement**

`lib/masshealth/types.ts`, in `Aca3ApEligibilityResult` after `rule_results: EligibilityRuleResult[]`:

```ts
  /** Present only when `status` is "REDIRECT_SACA2": the application chooser with SACA-2 highlighted. */
  redirect_href?: string
```

`lib/masshealth/aca3ap-eligibility-engine.ts`: add `import { buildRecommendedApplicationTypeHref } from "@/lib/applications/navigation"` after the existing imports, and change the final `return { … rule_results: ruleResults, }` to:

```ts
  return {
    applicant_id: input.applicantId,
    new_household_size: newHouseholdSize,
    income: totalIncome,
    fpl_percent: fplPercent,
    eligible_program: eligibleProgram,
    status,
    required_documents: requiredDocuments,
    findings,
    rule_results: ruleResults,
    ...(status === "REDIRECT_SACA2" ? { redirect_href: buildRecommendedApplicationTypeHref("saca2") } : {}),
  }
```

`lib/masshealth/application-checks.ts`: add `import { buildRecommendedApplicationTypeHref } from "@/lib/applications/navigation"` after the existing imports. Extend the interface:

```ts
export interface ApplicationCheckResult {
  id: string
  severity: CheckSeverity
  category: CheckCategory
  personLabel?: string
  title: string
  message: string
  /** Optional next step shown as a link. A static route only; never applicant data. */
  actionHref?: string
  actionLabel?: string
}
```

In `checkAgeThresholds`, add two properties to the `age.${i}.senior` push (after `message: …`):

```ts
        actionHref: buildRecommendedApplicationTypeHref("saca2"),
        actionLabel: "Start a SACA-2 application",
```

`components/application/ApplicationChecksPanel.tsx`: add `import Link from "next/link"` with the other imports, and after `<p className="mt-0.5 text-muted-foreground">{result.message}</p>` add:

```tsx
                      {result.actionHref ? (
                        <Link
                          href={result.actionHref}
                          className="mt-1 inline-block font-medium text-primary underline underline-offset-2"
                        >
                          {result.actionLabel ?? "Learn more"}
                        </Link>
                      ) : null}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/applications lib/masshealth/__tests__ components/application/__tests__ && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, including the existing `aca3-eligibility-engine.test.ts`, which is untouched.

- [ ] **Step 5: Commit**

```bash
git add lib/masshealth/types.ts lib/masshealth/aca3ap-eligibility-engine.ts lib/masshealth/application-checks.ts components/application/ApplicationChecksPanel.tsx lib/applications/__tests__/navigation.test.ts lib/masshealth/__tests__/aca3ap-redirect.test.ts lib/masshealth/__tests__/application-checks-saca2-link.test.ts components/application/__tests__/application-checks-panel.test.tsx
git commit -m "feat(saca2): link the ACA-3 and ACA-3-AP SACA-2 signals to the application chooser

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Results panel in the wizard's completion panel

**Files:**
- Create: `components/application/saca2/saca2-screening-result.tsx`
- Modify: `components/application/saca2/saca2-wizard.tsx` (import plus one element in the `saca2-complete` section)
- Test: `components/application/saca2/__tests__/saca2-screening-result.test.tsx`
- Modify: `components/application/saca2/__tests__/saca2-wizard.test.tsx` (one new test in "completion panel")

**Interfaces:**
- Consumes: `evaluateSaca2Eligibility`, `saca2ScreeningFallback` (Task 12); `SACA2_FIGURES`; `formatDollars`, `dollarsToCents`; `Saca2EligibilityResult`, `Saca2Estimates`, `Saca2ScreeningStatus`.
- Produces: `Saca2ScreeningResult({ answers: Saca2Answers; on?: Date })`. It renders `section[data-testid="saca2-screening"]` with `[data-testid="saca2-screening-label"]`, `[data-testid="saca2-screening-status"][data-status=<status>]` and `ul[data-testid="saca2-document-checklist"]`, and **no** `role="note"`.

- [ ] **Step 1: Write the failing tests**

`components/application/saca2/__tests__/saca2-screening-result.test.tsx`:

```tsx
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const engine = vi.hoisted(() => ({ fail: false }))
vi.mock("@/lib/masshealth/saca2/eligibility-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/masshealth/saca2/eligibility-engine")>()
  return {
    ...actual,
    evaluateSaca2Eligibility: (...args: Parameters<typeof actual.evaluateSaca2Eligibility>) => {
      if (engine.fail) throw new Error("boom")
      return actual.evaluateSaca2Eligibility(...args)
    },
  }
})

import { Saca2ScreeningResult } from "@/components/application/saca2/saca2-screening-result"
import { SACA2_SCREENING_LABEL } from "@/lib/masshealth/saca2/eligibility-engine"
import { getSyntheticCase } from "@/lib/masshealth/saca2/synthetic-cases"

const ON = new Date("2026-10-13T12:00:00Z")

afterEach(() => {
  engine.fail = false
  vi.restoreAllMocks()
})

describe("Saca2ScreeningResult", () => {
  it("shows the screening label, the status, estimates, and the checklist", () => {
    render(<Saca2ScreeningResult answers={getSyntheticCase("couple-spouse-in-nursing-facility").answers} on={ON} />)
    const panel = screen.getByTestId("saca2-screening")
    expect(within(panel).getByRole("heading", { name: "Screening estimate" })).toBeInTheDocument()
    expect(screen.getByTestId("saca2-screening-label")).toHaveTextContent(SACA2_SCREENING_LABEL)
    expect(screen.getByTestId("saca2-screening-status")).toHaveAttribute("data-status", "NEEDS_REVIEW")
    expect(panel).toHaveTextContent("Monthly allowance for your spouse at home: $2,766.50")
    const list = screen.getByTestId("saca2-document-checklist")
    expect(within(list).getByText("Statements for every account for the past 60 months")).toBeInTheDocument()
    expect(within(list).getByText("Proof of each transfer of income or assets in the past 60 months")).toBeInTheDocument()
    expect(within(panel).queryByRole("note")).toBeNull()
    expect(panel).not.toHaveTextContent(/approved/i)
  })

  it("links to the ACA-3 chooser for a child caregiver", () => {
    render(<Saca2ScreeningResult answers={getSyntheticCase("senior-parent-of-child-under-19").answers} on={ON} />)
    expect(screen.getByTestId("saca2-screening-status")).toHaveAttribute("data-status", "REDIRECT_ACA3")
    expect(screen.getByRole("link", { name: "Go to the ACA-3 application" })).toHaveAttribute("href", "/application/type?recommended=aca3")
  })

  it("degrades to a generic NEEDS_REVIEW message when the engine throws", () => {
    engine.fail = true
    render(<Saca2ScreeningResult answers={getSyntheticCase("single-senior-home").answers} on={ON} />)
    expect(screen.getByTestId("saca2-screening-status")).toHaveAttribute("data-status", "NEEDS_REVIEW")
    expect(screen.getByText(/couldn't estimate a result/)).toBeInTheDocument()
    expect(screen.getByTestId("saca2-screening-label")).toHaveTextContent(SACA2_SCREENING_LABEL)
  })

  it("does not log, store, or send anything", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.reject(new Error("no network")))
    const logs = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    render(<Saca2ScreeningResult answers={getSyntheticCase("couple-spouse-in-nursing-facility").answers} on={ON} />)
    expect(setItem).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    for (const spy of logs) expect(spy).not.toHaveBeenCalled()
  })
})
```

In `components/application/saca2/__tests__/saca2-wizard.test.tsx`, inside `describe("Saca2Wizard: completion panel", …)`, add:

```tsx
  it("shows the screening estimate and document checklist inside the completion panel", async () => {
    await renderAtLastStep()
    await userEvent.click(screen.getByRole("button", { name: "Finish" }))
    const panel = await screen.findByTestId("saca2-complete")
    const screening = within(panel).getByTestId("saca2-screening")
    expect(within(screening).getByTestId("saca2-screening-label")).toHaveTextContent(/screening estimate only/i)
    expect(within(screening).getByTestId("saca2-screening-status")).toHaveAttribute("data-status", "NEEDS_REVIEW")
    expect(within(screening).getByText("Current statements for each account")).toBeInTheDocument()
    // The download's signature note is still the panel's only note.
    expect(within(panel).getByRole("note")).toHaveTextContent(/sign, and date the form yourself/)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/application/saca2/__tests__/saca2-screening-result.test.tsx components/application/saca2/__tests__/saca2-wizard.test.tsx`
Expected: FAIL. The component module is missing, and the wizard test cannot find `saca2-screening`.

- [ ] **Step 3: Implement**

`components/application/saca2/saca2-screening-result.tsx`:

```tsx
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import Link from "next/link"
import { useMemo } from "react"
import { evaluateSaca2Eligibility, saca2ScreeningFallback } from "@/lib/masshealth/saca2/eligibility-engine"
import { dollarsToCents, formatDollars } from "@/lib/masshealth/saca2/eligibility/money"
import type { Saca2EligibilityResult, Saca2Estimates, Saca2ScreeningStatus } from "@/lib/masshealth/saca2/eligibility/types"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import type { Saca2Answers } from "@/lib/masshealth/saca2/types"

interface Saca2ScreeningResultProps {
  /** In-memory answers. Evaluated in the browser only; never sent, stored, or logged. */
  answers: Saca2Answers
  /** Screening date; defaults to now. */
  on?: Date
}

const STATUS_COPY: Record<Saca2ScreeningStatus, { title: string; body: string }> = {
  LIKELY_ELIGIBLE: { title: "You may qualify", body: "Based on your answers, you may qualify for MassHealth." },
  NEEDS_REVIEW: {
    title: "MassHealth needs to review your answers",
    body: "Some answers need a closer look, so we can't estimate a result. You can still apply.",
  },
  LIKELY_INELIGIBLE: {
    title: "You may not qualify right now",
    body: "Based on your answers, you may not qualify yet. You can still apply; MassHealth makes the final decision.",
  },
  PENDING_DOCUMENTS: {
    title: "You may qualify once your documents are checked",
    body: "Send the documents listed below with your application.",
  },
  REDIRECT_ACA3: {
    title: "A different application may fit better",
    body: "People who live with and care for a child under 19 usually apply with the ACA-3 application.",
  },
}

const usd = (dollars: number) => formatDollars(dollarsToCents(dollars))

function describeEstimates(e: Saca2Estimates): string[] {
  const lines: string[] = []
  if (e.monthlyIncome !== null) {
    lines.push(`Monthly income counted: ${usd(e.monthlyIncome)}${e.incomeLimit ? ` (limit ${usd(e.incomeLimit.monthly)})` : ""}`)
  }
  if (e.countableAssets !== null) {
    lines.push(`Countable assets: ${usd(e.countableAssets)}${e.assetLimit !== null ? ` (limit ${usd(e.assetLimit)})` : ""}`)
  }
  if (e.transfersInWindow !== null && e.transfersInWindow.total > 0) {
    lines.push(`Transfers in the past 60 months: ${usd(e.transfersInWindow.total)} (about ${e.transfersInWindow.penaltyDays} days of delayed long-term-care payment)`)
  }
  if (e.spousalAllowance !== null) lines.push(`Monthly allowance for your spouse at home: ${usd(e.spousalAllowance.allowance)}`)
  if (e.patientPaidAmount !== null) lines.push(`Your monthly share of nursing-facility costs: ${usd(e.patientPaidAmount)}`)
  return lines
}

function safeEvaluate(answers: Saca2Answers, on: Date): Saca2EligibilityResult {
  try {
    return evaluateSaca2Eligibility(answers, SACA2_FIGURES, on)
  } catch {
    return saca2ScreeningFallback()
  }
}

export function Saca2ScreeningResult({ answers, on }: Saca2ScreeningResultProps) {
  const time = on?.getTime()
  const result = useMemo(() => safeEvaluate(answers, time === undefined ? new Date() : new Date(time)), [answers, time])
  const copy = STATUS_COPY[result.status]
  const estimates = describeEstimates(result.estimates)
  const findings = result.findings.filter((f) => f.level !== "success")

  return (
    <section data-testid="saca2-screening" aria-labelledby="saca2-screening-title" className="space-y-3 rounded-md border p-4">
      <h3 id="saca2-screening-title" className="text-base font-semibold">
        Screening estimate
      </h3>
      <p data-testid="saca2-screening-label" className="text-sm font-medium">
        {result.screening_label}
      </p>
      <p data-testid="saca2-screening-status" data-status={result.status} className="text-sm">
        <strong>{copy.title}.</strong> {copy.body}
      </p>
      {result.redirect_href ? (
        <Link href={result.redirect_href} className="inline-block text-sm font-medium text-primary underline underline-offset-2">
          Go to the ACA-3 application
        </Link>
      ) : null}
      {findings.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {findings.map((f) => (
            <li key={`${f.code}-${f.message}`}>{f.message}</li>
          ))}
        </ul>
      ) : null}
      {estimates.length > 0 ? (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">Estimated figures (not a decision)</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {estimates.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">Documents to gather</h4>
        {result.document_checklist.length > 0 ? (
          <ul data-testid="saca2-document-checklist" className="list-disc space-y-1 pl-5 text-sm">
            {result.document_checklist.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground"> — {item.reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No documents identified from your answers. MassHealth may still ask for proof.</p>
        )}
      </div>
    </section>
  )
}
```

Because the label and the reason are separate `<span>`s, `getByText(label)` matches the label span exactly.

`components/application/saca2/saca2-wizard.tsx`: add `import { Saca2ScreeningResult } from "./saca2-screening-result"` after the `Saca2SaveStatus` import. Inside the `saca2-complete` section, insert the panel between the intro `<p>` and `<Saca2Download …/>`:

```tsx
              <Saca2ScreeningResult answers={state.data} />
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/application/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint components/application/saca2 lib/masshealth/saca2`
Expected: PASS, with lint clean.

- [ ] **Step 5 (optional, manual):** With `SACA2_ENABLED=true` in `.env.local`, `npm run dev`, open a SACA-2 draft, finish it, and check the panel at phone width (375px). The label, status, estimates and checklist must not scroll horizontally. Revert `.env.local`; do not commit it.

- [ ] **Step 6: Commit**

```bash
git add components/application/saca2/saca2-screening-result.tsx components/application/saca2/saca2-wizard.tsx components/application/saca2/__tests__/saca2-screening-result.test.tsx components/application/saca2/__tests__/saca2-wizard.test.tsx
git commit -m "feat(saca2): show the screening estimate and document checklist on finish

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Documentation and full verification

**Files:**
- Modify: `docs/superpowers/specs/2026-10-13-saca2-application-design.md` (§4.4 as-built note, §6 Phase 3 row)
- Modify: `docs/superpowers/saca2-flag-on-checklist.md` (known limits and verification)
- Modify: `docs/superpowers/saca2-policy-review.md` (only if Tasks 3–13 changed any logic described there)

**Interfaces:**
- Consumes: everything above.
- Produces: docs only. The full suite is green.

- [ ] **Step 1: Update the spec.** In §4.4, after the "Integration:" paragraph, add:

```markdown
**As built (plan `docs/superpowers/plans/2026-10-19-saca2-eligibility.md`):**
- `evaluateSaca2Eligibility(answers, figures = SACA2_FIGURES, onDate = new Date(), { policy })` in
  `lib/masshealth/saca2/eligibility-engine.ts`; rules in `lib/masshealth/saca2/eligibility/rules/`. Inputs come only from
  visible answers (`eligibility/inputs.ts`, built on the PDF fill's `createVisibleReader` and `householdHasSpouse`).
- Result: `{ status, screening_label, findings, rule_results, rules[{ id, label, confirmed, verdict, effective_verdict }],
  estimates, required_documents, document_checklist, redirect_href? }`. `EligibilityFinding` / `EligibilityRuleResult`
  are reused unchanged (review and documents render as `"warning"`). No dashboard or social-worker view renders
  eligibility results today; plan 5 decides any touchpoint.
- Confirmation: `eligibility/policy.ts` `confirmed` flags, kept in step with `docs/superpowers/saca2-policy-review.md` by
  a test. Rules 3–7 are unconfirmed, so every non-redirect result is `NEEDS_REVIEW` until the named reviewer signs off.
- Runs client-side in the completion panel; not persisted; no server route; never throws (falls back to `NEEDS_REVIEW`).
- Redirects: SACA-2 → `/application/type?recommended=aca3`; ACA-3-AP `REDIRECT_SACA2` carries
  `redirect_href = /application/type?recommended=saca2`; the ACA-3 checks panel links the 65+ warning there.
- Fixtures: the spec §5.3 cases live in `lib/masshealth/saca2/synthetic-cases.ts` (no JSON copy) with expected outcomes.
```

In §6, change the Phase 3 row to:

```markdown
| 3 | `eligibility-engine`, `document-checklist`, redirects, results panel (plan `2026-10-19-saca2-eligibility.md` — done once merged); 130 CMR confirmation of rules 3–7 recorded in `docs/superpowers/saca2-policy-review.md` (open until the named reviewer signs off) |
```

- [ ] **Step 2: Update the flag-on checklist.** In `docs/superpowers/saca2-flag-on-checklist.md`, replace the bullet "The PDF download ships with the wizard; the eligibility engine (plan 4) is not shipped yet." with:

```markdown
- The completion panel shows a **screening estimate** and a document checklist. Rules 3–7 are not yet confirmed against
  130 CMR 519–520 (`docs/superpowers/saca2-policy-review.md`), so every result other than the ACA-3 redirect reads
  "MassHealth needs to review your answers" until the named reviewer signs off. Decide before flag-on whether that is acceptable.
```

and add under "Verify after the flag is on":

```markdown
- [ ] Finish a SACA-2 draft: the panel shows "Screening estimate", the "Screening estimate only" label, a status, and a
      "Documents to gather" list; a 65+ applicant who cares for a child under 19 sees "Go to the ACA-3 application".
```

- [ ] **Step 3: Re-read `docs/superpowers/saca2-policy-review.md`** against the final rule code and correct any sentence that no longer matches. Keep `|` out of table cells.

- [ ] **Step 4: Full verification**

Run:

```bash
export PATH=/Users/blee/.nvm/versions/node/v22.23.0/bin:$PATH
npx vitest run
npx tsc --noEmit -p tsconfig.json
npx eslint .
grep -rn "APPROVED" lib/masshealth/saca2 components/application/saca2 || echo "no APPROVED in SACA-2 code"
grep -rn "console\." lib/masshealth/saca2/eligibility lib/masshealth/saca2/eligibility-engine.ts lib/masshealth/saca2/document-checklist.ts components/application/saca2/saca2-screening-result.tsx || echo "no console calls"
grep -rn "vitest-environment node" lib components || echo "no node-environment overrides"
```

Expected: all tests pass, with no type or lint errors and the three "no …" lines printed. If `npx vitest run` writes `test-results.json`, leave it unstaged.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-10-13-saca2-application-design.md docs/superpowers/saca2-flag-on-checklist.md docs/superpowers/saca2-policy-review.md
git commit -m "docs(saca2): record the as-built screening engine and its flag-on limits

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Owner decisions (not resolved by this plan)

| # | Decision | Default in this plan |
|---|---|---|
| O1 | Should rules 1, 2 and 8 also need the named reviewer? | No: marked confirmed as form-derived (flip their rows to `no` to change) |
| O2 | Named MassHealth-knowledgeable reviewer for rules 3–7 (spec §7.3) | Open; rules stay unconfirmed, so results are `NEEDS_REVIEW` |
| O3 | Should the flag turn on while every result reads "needs review"? | Left to the owner (flag-on checklist note) |
| O4 | Add wizard questions for the data gaps G1 (annuity value), G2 (asset owner), G4 (home mortgage balance), G5 (premium amounts and frequency), G7 (application/admission date) | Not added; each gap resolves to review |
| O5 | A long-term-care applicant who cares for a child under 19 | `NEEDS_REVIEW` (not a redirect), because the EOM's facility population has no parent exclusion |
| O6 | Married couple living together where only one spouse applies | $3,000 limit with a note |
| O7 | Persist a PHI-free status for dashboards or social workers | Not persisted; plan 5 decides, using status and rule ids only |
| O8 | The spec names `data/saca2-synthetic-patient-cases.json`; the code has the TS module | TS stays the single source; no JSON copy |

## What comes next

Plan 5 covers:
- 6-language UI strings and reference translations for the wizard and this results panel (spec §4.8), including the screening label and status copy.
- The chat intake driver over `schema.ts` (`requirements.ts`).
- Social-worker, dashboard and mobile touchpoints. This includes whether to show a PHI-free screening status (O7).
- Playwright journeys with keyboard-only and accessibility checks, including the nursing-facility couple through Finish to the screening panel and the PDF download.
- Docs updates and the `SACA2_ENABLED` rollout (O3).

Separately, once the reviewer signs off, confirming rules 3–7 is a one-line change per rule plus its table row (see `docs/superpowers/saca2-policy-review.md`).
