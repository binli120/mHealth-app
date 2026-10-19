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
| SACA2_R1_RESIDENCY_ROUTE | Residency and application route | Form Q14 and Q24 (residency); EOM 26-03 target populations (spec §3.1) | — (not gated, spec §4.4) | yes | n/a (form-derived) | 2026-10-19 | Never approves on its own; redirect to ACA-3 for a child-under-19 caregiver not needing long-term care (facility, HCBS waiver, PACE) |
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
- No one applying gives review. A child-under-19 caregiver with no long-term-care route gives a redirect to ACA-3. A child-under-19 caregiver who needs long-term care (facility, HCBS waiver, PACE) gives review. A caregiver whose listed children are all 19 or older gives review.
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
- Questions for the reviewer: Are IRAs, Keogh and pension funds countable as entered? Is all burial property excludable as the spec says, or only up to limits? Is $3,000 right when only one spouse applies? Is the community-spouse band right for Massachusetts (min/max standard)? Does the applicant's $2,000 come on top of the community-spouse amount? An HCBS-waiver applicant with a spouse at home uses the $3,000 couple limit, not the community-spouse band: is that right?

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
- Patient-paid amount: it is computed without the family allowance when family lives with the spouse at home (rule 7 flags review; the estimate is still shown). A missing spouse facility answer or spouse income gives review and no patient-paid amount.
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

## Owner notes

- Stale Person 2 data after "married" is changed to "no": the Person 2 step stays visible while its block holds data, so per-applicant rules (residency, citizenship, and the confirmed caregiver redirect) still read Person 2's answers. This matches the wizard and PDF visibility rules. Spouse-side values (income, household size, rule 3/6/7 spouse logic) are not read once the household has no spouse.

