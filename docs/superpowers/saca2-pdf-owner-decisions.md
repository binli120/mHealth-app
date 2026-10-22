# SACA-2 PDF fill: owner decisions and wizard gaps

Written at the close of the PDF-fill plan (Task 13). Every item below is something the PDF generator
cannot settle by itself: either the wizard does not ask the question the form asks, or the form asks it
in a different shape than the wizard, or a product call is needed. The generator never invents an
answer; in each case the form field is left blank (never-fill, with a note in `pdf/never-fill.ts`) or the
information goes on a continuation sheet. Form locations use the printed form page ("form p.N", the
`SACA-2_2026-08` footer) and the 0-based PDF page index ("idx N", cover page = idx 0 and 1, so idx = form page + 1).

Each item gives: where it is on the form, what the wizard lacks, and the recommended option.

## A. Questions the wizard does not ask, or asks in a different shape

### A1. Q13f / Q23f: four category boxes versus one Yes/No
- Form: Person 1 Q13f (form p.4, idx 5), Person 2 Q23f (form p.9, idx 10). "Optional: Are you a victim of severe
  trafficking; spouse, child, sibling, or parent of a trafficking victim; battered spouse; or child or parent of a
  battered spouse?" The form has four check boxes, one per category.
- Wizard: one Yes/No (`isTraffickingOrBatteredVictim`). A Yes cannot say which category.
- Today: the four boxes are never-fill; a Yes is recorded as a line on the continuation sheet ("category not specified").
- Recommended: replace the Yes/No with a four-option multi-select (shown when the person wants to answer), then map
  each option to its box. The question is optional, so the alternative is to keep the sheet note and accept that the
  caseworker asks the category.

### A2. Income frequencies the form has no box for
- Wages `oneTime` (Person 1 Q23-26 current job, form p.5, idx 6; Person 2 Q32-36): the wage frequency boxes stop at Yearly.
- Lottery `quarterly` (Q28 other income, idx 7; Person 2 Q38): the lottery line has no Quarterly box.
- Wizard offers both frequencies. Today a continuation-sheet line records the amount and frequency.
- Recommended: remove `oneTime` from the wages options (one-time money is Q30-31 on the form already) and remove
  `quarterly` from the lottery options, or convert the amount to the nearest supported frequency in the wizard
  with the person's confirmation. Keeping the sheet line is the fallback.

### A3. Alien number on the immigration document (13b / 23b)
- Form: Person 1 13b (idx 5, field `Alien number_2`), Person 2 23b (`Alien number_P2`): a noncitizen gives the A-number
  printed on the immigration document.
- Wizard: asks the alien number only for naturalized citizens (Q12). The A-number of a noncitizen is never asked.
- Recommended: add an `immigrationAlienNumber` question under the immigration-document question (hidden for
  citizens), then map both fields. Both fields are never-fill until then.

### A4. Q33 / Q34 (and Q43 / Q44) blank when "has income" is No
- Form: total expected income this year / next year (Person 1 form p.6, idx 7; Person 2 idx 13).
- Wizard: the two totals are asked only when the person has income. With income No both stay blank on the form.
- Recommended: when "has income" is No, write `0` for this year's total (it is a true statement of the answer the
  person gave). Left blank today because the generator does not turn a No into a number without an owner decision.

### A5. Mailing address county
- Form: `15 County` (Person 1, form p.2, idx 3) and `12 County_P2` (Person 2). The wizard has no county question.
- Recommended: add an optional county question, or leave the box blank (the county is derived from the ZIP by MassHealth).

### A6. Q21 prison or jail
- Form: Q21 "Is anyone on this application in prison or jail?" plus its two follow-ups (name; awaiting trial), form p.2 (idx 3).
- Wizard: no such question. Three fields are never-fill.
- Recommended: add a per-person Yes/No and the two follow-ups; the answer affects eligibility, so it should be asked.

### A7. Q19 / Q29 "Name:" line
- Form: a `Name:` line after the disability Yes/No (Person 1 `19. Name`, Person 2 `29. Name_P2`, idx 6 and idx 10).
  The form does not say whose name or why.
- Recommended: confirm the intent with MassHealth. Never-fill until then.

### A8. Real-estate and trust owner questions for couples
- Form: real estate Q2 and Q3 (primary residence, other real estate) and trusts Q10 and Q11 each have a "You" box and
  a "Your spouse" box (Step 5, form pp.12-15, idx 14-16).
- Wizard: one gate Yes/No for "you or your spouse"; no owner question, and for trusts one gate for both questions.
- Today: no spouse, gate Yes writes "You: Yes"; couple, gate Yes leaves both boxes blank (the filled property table
  carries the answer); gate No writes No in both columns.
- Recommended: add an owner multi-select (you, spouse, both) to the real-estate gates and split the trust gate into
  its two form questions.

### A9. Ten never-fill WIZARD GAP fields in Step 5
- Prepaid burial, "You" and "Your spouse" (eight fields): life-insurance company, policy number, burial-only account
  bank name, account number. The wizard's burial row holds only owner, kind and amount.
- Vehicles, "You" and "Your spouse" (two fields): `Mobile home address`, `Mobile home address_2`. The wizard has one
  "year, make, model (or mobile home address)" answer, which is written to the year/make/model line.
- Recommended: add the four burial detail questions to the burial row (shown for kinds lifeInsurance and
  burialOnlyAccount) and a separate mobile-home address field in the vehicle row.

### A10. Life insurance cash-surrender value
- Form: no field for it (the table has owner, company, policy number, face value, type). The wizard asks for it.
- Today: not written anywhere. Recommended: either drop the wizard question (it is not on the form) or write it on a
  continuation sheet line. The wizard question feeds eligibility screening, so keep it and add the sheet line.

### A11. Prepaid burial plot amount
- Form: no amount line for a burial plot. Today the plot amount is written on the notes sheet. No change needed
  unless the owner wants it dropped.

### A12. Spouse PCA column when Person 1 is not married but Person 2 is visible
- Form: Step 8 (idx 19) has a column for you and one for your spouse.
- Wizard: when Person 1 is not married and Person 2 is on the application (stale or non-spouse state) the wizard still
  asks the spouse PCA questions (`showsSuppC` counts that Person 2) but the spouse column is dropped because there is
  no spouse.
- Recommended: stop asking the spouse PCA questions unless Person 1 is married, or decide that Person 2 always
  gets the spouse column. This is a wizard-consistency fix, not a form question.
- Related stale state: Person 1 not applying plus a stale `isLegallyMarried = yes`. The intake "Spouse:" line uses the
  raw answer (this matches `visibility.ts` in the wizard), while assets, PCA, Supplement A and the IRS pages treat the
  household as single through the visible reader. The two rules differ only in this state; pick one.
- Related form-semantics question: the "You" column on the real-estate and trust gate questions when Person 1 is not
  applying but Person 2 is. Whose answers belong under "You" is a call for the owner.
- Related: Finish validates only the last step. A draft resumed with the PHI restore skipped (or never completed) can
  reach the completion panel and download a PDF with blank names and SSN. The owner may want "validate every visible
  step" before the panel opens.

### A13. Person 2 is asked for a home address, phone and email the form has no place for
- Form: Person 2's page has only "Does this person live with Person 1" and a street-address line for No. There is no
  city, state, ZIP, phone or email for Person 2.
- Wizard: requires Person 2's street, city, state, ZIP, phone and email. The address is joined into the one form line;
  the phone and email are never written.
- Recommended: show the home-address fields only when Person 2 does not live with Person 1, and hide Person 2's
  phone and email (or mark them optional and say they are not on the printed form).

### A14. Voter registration question wording
- Form: the voter-registration lines in the consent section ask "Right to Register to Vote" with Yes/No boxes for the
  person who would like to apply to register.
- Wizard (`signing.registerToVote`): "If you are not registered to vote where you live now, would you like to apply to
  register to vote today?". The wording is close but not identical to the form's. The answer is written to the form's
  Yes/No (the spec's exception for an explicitly answered voter question).
- Recommended: have the policy reviewer confirm the wizard wording is an acceptable paraphrase, or copy the form's
  wording exactly.

### A15. Single-line text can clip long values in print
- Many single-line fields are narrow. The value is intact in the field (and in the form data); only the printed
  appearance clips. Long wrapped text (Supplement A) is wrapped by measured width and spills to a sheet, but plain
  single-line fields (names, employers, addresses) are not.
- Recommended: auto font size (DA 0, shrink to fit) for fields whose widget is a single line, or character limits in
  the wizard. This is a visual-quality item, not a correctness one.

## B. IRS Form 4506 and ARD-1122

### B1. IRS line 2b (Person 2's SSN or ITIN)
- Form: line 2b on a joint return. The wizard asks Person 1's ITIN when Person 1 has no SSN but never asks for
  Person 2's ITIN.
- Today: line 2b is written only from a complete nine-digit SSN of Person 2. (A partial SSN is never written.)
- Recommended: add the same ITIN question for Person 2 (shown when joint return is Yes and Person 2 has no SSN).

### B2. IRS signer, signer phone, and signature-block fields
- The signature, the date, the signer's printed name, the attestation check box and the spouse's signature
  space are never filled (the form has no widget for a signature line itself).
- The signer's phone ("Phone number of taxpayer on line 1a or 2a") is an owner decision: copy the applicant's phone,
  or leave it for the signer to write. The generator leaves it blank (never-fill reason `other`).
- Note: the template widget named `PrintType name` is the spouse's signature space, not a printed name. The form has
  no widget for the spouse's printed name.
- Recommended: leave the signer phone blank unless the owner wants the applicant's phone copied when the applicant signs.

### B3. ARD-1122 values that go on an extra continuation sheet
- The organization name, the legal-document description (Section III) and the representative's email, when the representative is an organization, have no field on the
  printed ARD-1122 section pages that fits the wizard's answers, so they are written on an additional continuation
  sheet. The owner should confirm that MassHealth accepts such a sheet attached to the ARD-1122, or require the
  information to be handwritten on the form.
- The MassHealth ID boxes on all three ARD sections (36 fields) are never-fill: the wizard never asks for a MassHealth
  ID (the last four SSN digits, the form's alternative, are filled).

## C. Behavior to decide in other tasks

### C1. A bad state code throws instead of being skipped
- A state field has a maximum length of 2. A value longer than that (a draft that skipped validation) makes the whole
  fill throw `Value for field ... exceeds its maximum length`.
- Task 14 (the route) decides: map the throw to a 422 that names the field, or skip the over-long value and add a
  continuation-sheet line. Recommended: 422 naming the field (a bad state code is a data error the person should fix).

### C2. Deductions of $0 (decided in Task 13)
- A deduction with an amount of 0 now ticks no box and writes no amount. Before this change it ticked the box and
  printed "0". If a person enters 0 for every deduction without checking "None", the deduction area is left blank
  (the form's "None" box is not ticked for them). Recommended follow-up: have the wizard require "None" when no
  deduction is above zero.

### C3. Intake "Spouse:" line (decided in Task 13)
- The name lines under each program now use the wizard's own spouse rule: Person 1 is legally married and Person 2 is
  on the application. The relationship text is never parsed. A non-spouse Person 2 who is applying (a child, a parent)
  has no line on the intake page at all; the form has only "You" and "Spouse" lines. The "# of people listed" box now
  counts only people with something entered.

### C4. IRS line 6 "1040" prints in a small font
- The form number box is 9.5 points tall and uses automatic font size (about 8 points), so "1040" is small but legible.
  Making it larger would overflow the box. Left as is; this is template geometry.

### C5. Characters the form font cannot print show as "?"
- The generator uses the standard Helvetica (WinAnsi) font. Any character outside it, for example Vietnamese
  diacritics ("Hương Nguyễn") or Chinese ("王 李"), is replaced with "?" in form fields and continuation sheets. The app
  serves Vietnamese and Chinese speakers, so this will happen.
- Current mitigation: the route counts the replaced characters (a number only, never the text) and sends it in the
  `X-Saca2-Substituted-Chars` response header; the download panel then shows a persistent warning to check the printed
  form and hand-write the affected entries.
- Proper fix: embed Unicode fonts (Noto Sans plus a CJK face) through `@pdf-lib/fontkit` (already a dependency).
  Owner choices: which font files, their licensing (Noto is OFL), the bundle and image size (CJK fonts are large;
  subsetting helps), and how field appearances are regenerated so the text stays editable.

## D. Open items from the spec (section 7), still open

1. Form version. Confirm with MassHealth that `SACA-2_2026-08` (the pinned template) supersedes the March 2026 revision
   described in EOM 26-03, and store the PDF footer value. The generator is pinned by sha256 to the 2026-08 file.
2. Social worker delivery. The route reuses `getApplicationDraft(userId, applicationId, actingFor)`; how a social worker
   delivers the generated PDF to the patient or to MassHealth (download only, email, upload) is not decided. Nothing
   is stored by the route.
3. ARD-1122 and IRS 4506 instruction pages. The instruction pages (idx 34 and idx 39, no fields) are kept with their
   section. Confirm whether MassHealth wants the instruction pages sent with the application or removed.
4. Policy review of eligibility rules 3-7 (130 CMR 519-520), and translation review of machine-translated question
   text, are unchanged from the spec.
