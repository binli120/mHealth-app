# SACA-2 PDF Fill (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a completed SACA-2 wizard state into the official, editable, correctly filled SACA-2 (2026-08) PDF, generated locally with `pdf-lib`, downloadable from the wizard, with a map that is checked for coverage so no field is silently missed.

**Architecture:** A pinned template PDF + a committed field inventory (including each checkbox widget's on-state and rectangle); a typed, hand-authored **field map** per form region; a pure `fillSaca2Pdf(answers, templateBytes, on)` that resolves each mapped value **only if it is visible at both step and question level**, encodes it, and writes it with a checkbox-group-aware writer; generated overflow sheets for rows that do not fit; page selection so untriggered supplements/attachments are dropped; a `POST /api/forms/saca2/fill` route (answers come from the client, because PHI never lives in the server draft); and a download button on the wizard's last step. A **coverage ratchet** (`unmapped-fields.json`) starts with every field listed and shrinks task by task until it contains only deliberate never-fill fields. The `SACA2_ENABLED` flag stays **off**.

**Tech Stack:** TypeScript, `pdf-lib` (+ `@pdf-lib/fontkit` already installed), Vitest, Next.js route handler, `pdftotext` (developer tool only).

**Spec:** `docs/superpowers/specs/2026-10-13-saca2-application-design.md` §3.3 (form structure), §4.6 (PDF fill), §5.2 (guards), §7. Builds on plans `2026-10-13-saca2-foundation.md` … `2026-10-17-saca2-flag-gate.md` (all merged on `dev`).

## Scope and sequence

| Plan | Content | Status |
|---|---|---|
| 1 … 2c | foundation → wizard, all question content, flag gate | merged |
| **3 (this file)** | PDF fill | ready |
| 4, 5 | eligibility engine; i18n, chat, touchpoints, e2e, rollout | after 3 |

## What the form looks like (verified by inspecting the real PDF, 2026-10-18)

- Template: the user-supplied PDF, 42 pages, **sha256 `147d89848b304189a4f55d469c3436d6754525aaa94aab21471027113804af54`**, 1,691,013 bytes. 1,149 AcroForm fields: 733 text, 414 checkbox, 2 buttons (`Clear`, `Print` — never filled).
- 0-based page index = form page + 1 (the first intake page is index 2). Fields exist on indexes 2–19 (intake through Step 9), 24–25 (signature / responsible party), 26–29 (Supplement A), 30–32 (Supplements B/C/D), 35–38 (ARD-1122 and IRS 4506). Indexes 20–23 and 33–34 hold consent text / voter registration with no (or one) field.
- Fields per page index: 2:22 · 3:36 · 4:32 · 5:38 · 6:75 · 7:73 · 8:41 · 9:38 · 10:54 · 11:76 · 12:59 · 13:15 · 14:40 · 15:63 · 16:53 · 17:34 · 18:33 · 19:5 · 24:1 · 25:25 · 26:31 · 27:31 · 28:41 · 29:16 · 30:18 · 31:41 · 32:42 · 35:33 · 36:28 · 37:26 · 38:41.
- Names are label-derived and often truncated or ambiguous (`You`, `Spouse_2`, `Date of birth_S`, `2 Date of birth mmddyy`); 328 end in `_N`; suffixes `_P2`, `_S`, `_SuppA`, `_SuppC`, `_ARD_S1` mark repeats and regions. **Names alone are not enough to map a field — use the field context tool (Task 2).**
- **SSN is ten single-character boxes** (`10. SSN1`, `10. SSN3` … with `maxLen 1`), not one field. 84 text fields have `maxLen 1`, 8 have `maxLen 2`, 2 have `maxLen 4` (year / date fragments).
- **Checkbox groups.** 414 checkbox fields; 200 have one widget with on-state `/On`; ~103 have two widgets with on-states `/1` `/2`; ~90 have two widgets `/Yes` `/No`; others have 3–4 widgets (`/1 /2 /3 /4`), a few have odd pairs (`/M /F`, `/On /2`, `/Off|/On`). In the two-widget case **one field owns both widgets and each widget has its own on-state** (the pair is mutually exclusive; widget order varies, e.g. `/2 ; /1`). `pdf-lib`'s `PDFCheckBox.check()` selects only the field's first on-value, so these need a custom writer that sets the field `/V` and every widget's `/AS` (Task 3).

## Decisions made here (easy to change)

1. **Answers travel from the client.** The server draft deliberately holds no PHI, so the fill route cannot read answers from the database. The wizard posts its in-memory answers (over TLS) with the `applicationId`; the route authorizes via `getApplicationDraft(userId, applicationId, actingFor)` (ownership / social-worker access), **re-validates the payload through `normalizeSaca2State`**, fills, streams the PDF, stores nothing, and never logs answer content.
2. **Only visible answers are written.** Stale values left behind by flipped gates must never reach the PDF. Every mapped value is read through a visibility-aware reader that checks the step (`isStepVisible`), the question (`visibleWhen`, including repeater item context), and the repeater row, using the very same question definitions the wizard uses.
3. **Never auto-filled:** signatures, signature dates, the 28 consent items, SNAP / penalty acknowledgements, voter-registration Yes/No (unless a wizard question answers it — none does today), office-use boxes, and the `Clear` / `Print` buttons. These live in `NEVER_FILL` with a reason each.
4. **Editable output.** No flattening; `form.updateFieldAppearances()` with an embedded Unicode-capable font so non-Latin names do not crash; fields keep their original names.
5. **The map is data, not code paths.** Person 1 and Person 2 share one question table with two field-name columns; every other region has its own table. A table entry is `{ fields, source, encode }` (Task 3).
6. **Coverage ratchet.** `lib/masshealth/saca2/pdf/unmapped-fields.json` lists every inventory field that is neither mapped nor in `NEVER_FILL`; a test asserts the list is exactly the set difference. It is generated and committed in Task 3 with all 1,147 fillable fields listed; each region task removes the fields it maps; Task 13 requires the list to be empty.
7. **Overflow sheets.** A table with N rows on the form gets the first N rows filled; extra rows are printed on appended pages headed with Person 1's name and SSN, as the form instructs. Overflow pages are plain generated pages (not form fields).
8. **Page selection.** Supplements A–D, ARD-1122 and IRS 4506 pages are included only when `isStepVisible` says so; consent / voter pages stay (they are part of the application the person signs); pages for steps that are hidden entirely (none today besides the above) are dropped.
9. **Dates** are written `MM/DD/YYYY` (the form's instruction); **money** as plain dollars with cents only when non-zero; **phone** as `(617) 555-0100`; **SSN** spread over its ten boxes (digits only; the form's dash boxes are static). Encoders live in one module and are unit-tested.

## Global Constraints

- Run commands from `/Users/blee/dev/masshealth-repo/mHealth-app` with Node 22: `export PATH=/Users/blee/.nvm/versions/node/v22.23.0/bin:$PATH` (the shell default, Node 18, cannot run vitest).
- **PHI is never logged** (route and library): log ids and counts only. **Nothing is stored.** The template is read server-side only.
- Form source of truth: the user-supplied `~/Downloads/ SACA-2 PDF.pdf` (copy to `resources/forms/saca2-2026-08.pdf` in Task 1); `pdftotext -layout` / `-bbox-layout` on it is the way to read labels; the hash above pins it. Wording and checkbox meaning follow the form, not field-name guesses.
- Tests that fill the PDF use the existing complete fixtures (`completeSingleSenior`, `completeFacilityCouple`, `completeHomeWithAllSupplements`, `completeRichHousehold` in `lib/masshealth/saca2/__tests__/complete-answers.ts`; `ON = new Date("2026-10-13T12:00:00Z")`) and **read the result back** with a shared helper (`readFilled(bytes)` from Task 3: text values by name, checkbox selected on-state by name). Assertions name exact field names and exact expected values.
- Region tasks must not guess: when a field's meaning is unclear after reading its context (Task 2 output) and the PDF text, put it in the task report as "unresolved" and leave it in `unmapped-fields.json`; Task 13 resolves leftovers with the owner's input or marks them `NEVER_FILL` with a reason.
- Repo style: 2-space indent, no semicolons, double quotes, `@author: Bin Lee` / `@email: blee@comura.ai` header on every new file, tests in `__tests__/` next to the module, `@/` imports. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- ACA-3 behaviour and the external Python fill route are untouched.

## Review Focus

1. **Stale answers never reach the PDF** (gate flips: applying→no, citizen↔noncitizen, married→no, hasIncome→no, kind switches in income rows, nursing→no, signer changes). → Tasks 3, 5, 6, 11.
2. **Checkbox groups select the right widget** for each option (`/Yes` vs `/No`, `/1…/4`, widget-order oddities like `/2 ; /1`) and clear the other widgets; a Yes/No answered "no" is not left unchecked-and-ambiguous. → Tasks 3–12 (read-back tests).
3. **PDF stays valid and editable** after fill (reload with pdf-lib, `pdftotext` extracts the filled text, fields still named, not flattened), including non-Latin characters and very long strings. → Tasks 3, 14.
4. **PHI**: the route never logs bodies, never writes to disk/DB, rejects oversize and malformed payloads, and enforces ownership with the acting-for header exactly like the draft route. → Task 14.
5. **Coverage ratchet is honest**: every field accounted for; the never-fill list has a reason per entry. → Tasks 3, 13.
6. **Overflow and page selection**: extra rows go to a headed sheet with Person 1's name and SSN; hidden supplements/attachments are absent from the output; page numbers/order stay valid. → Tasks 7, 12, 13.
7. **Template integrity**: a changed PDF (hash mismatch) fails loudly and the route returns a clear 500, not a wrongly filled form. → Tasks 1, 14.

---

### Task 1: Template, hash pin, and field inventory

**Files:**
- Create: `resources/forms/saca2-2026-08.pdf` (copy of `~/Downloads/ SACA-2 PDF.pdf`)
- Create: `lib/masshealth/saca2/pdf/template.ts` (`SACA2_TEMPLATE_PATH`, `SACA2_TEMPLATE_SHA256`, `loadSaca2Template(): Promise<Uint8Array>` that reads the file and **throws `Saca2TemplateIntegrityError`** on hash mismatch)
- Create: `scripts/saca2-extract-fields.ts` (regenerates the inventory; run with `npx tsx scripts/saca2-extract-fields.ts`; add a `package.json` script `saca2:inventory`)
- Create: `lib/masshealth/saca2/pdf/field-inventory.json` (committed output)
- Create: `lib/masshealth/saca2/pdf/inventory.ts` (types + loader: `Saca2FieldInfo`, `getInventory()`, `getFieldInfo(name)`)
- Modify: `next.config.mjs` (`outputFileTracingIncludes` entry for the future route `"/api/forms/saca2/fill": ["./resources/forms/**"]`)
- Test: `lib/masshealth/saca2/pdf/__tests__/template.test.ts`, `inventory.test.ts`

**Interfaces:**
- Produces: `Saca2FieldInfo = { name: string; type: "text" | "checkbox" | "button"; pages: number[]; widgets: Array<{ page: number; rect: [number, number, number, number]; onState?: string }>; maxLen?: number }`. `onState` is the widget's non-`Off` appearance-state name (checkbox widgets only). The inventory file is an array sorted by (first page, then top-to-bottom, left-to-right rect), with stable ordering for ties.

- [ ] **Step 1: Write failing tests.** `template.test.ts`: the pinned hash constant equals `sha256(resources/forms/saca2-2026-08.pdf)`; `loadSaca2Template()` returns bytes whose hash matches; with the file read mocked to return one flipped byte it rejects with `Saca2TemplateIntegrityError` (the message names expected vs actual hash prefixes only). `inventory.test.ts`: the committed inventory has exactly 1,149 entries with unique names (733 text, 414 checkbox, 2 button); every checkbox entry has ≥1 widget with an `onState`; the two buttons are `Clear` and `Print`; **inventory equals a live extraction from the template** (this is the guard that reruns after a form reissue); lookups by name work and an unknown name returns `undefined`.
- [ ] **Step 2: Run to verify failure.** `npx vitest run lib/masshealth/saca2/pdf`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement.** Copy the PDF; write `extractInventory(bytes)` (shared by the script and the test — export it from `inventory.ts` or a sibling `extract.ts` so the test and script cannot drift) using `pdf-lib`: for each field, widgets via `field.acroField.getWidgets()`, page via the widget `/P` ref mapped to the page index (fall back to scanning page `/Annots` when `/P` is absent — check that no widget ends up with page `-1`), rect from `widget.getRectangle()` rounded to 2 decimals, on-state from `/AP /N` keys minus `/Off` (use `lookupMaybe` — text widgets have no `/N` dict). Run the script and commit the JSON. Add the `next.config.mjs` tracing entry.
- [ ] **Step 4: Run tests, type check, lint** (`npx vitest run lib/masshealth/saca2/pdf && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2/pdf scripts/saca2-extract-fields.ts`). Expected: PASS.
- [ ] **Step 5: Commit** — `feat(saca2): pin the SACA-2 template and commit its field inventory`.

---

### Task 2: Field context tool (developer aid)

**Files:**
- Create: `scripts/saca2-field-context.ts`
- Test: `scripts/__tests__/saca2-field-context.test.ts` (pure parsing only)

**Interfaces:**
- Produces: `npx tsx scripts/saca2-field-context.ts [--page <index>] [--out <file>]` printing, for each inventory field on the requested page(s): `name | type | widgets (on-states) | rect | nearest label text` where the nearest label is derived from `pdftotext -bbox-layout` word boxes: the closest text to the left on the same line, or the closest above (within a small vertical window), joined into a short string, plus the 1–2 text lines above for question numbering. Output is for humans and agents; **it is never committed and never required by tests or CI** (it shells out to `pdftotext`).

- [ ] **Step 1: Write failing tests** for the pure parts: parsing the `pdftotext -bbox-layout` XHTML into word boxes (a small fixture string), and `nearestLabel(fieldRect, words)` choosing the left neighbour on the same baseline over a word above, falling back to above; PDF coordinate flip (pdftotext uses top-left origin, pdf-lib rects use bottom-left; the helper takes the page height).
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** the parser and the script (spawn `pdftotext -bbox-layout -f <page+1> -l <page+1> <pdf> -`; if `pdftotext` is missing print an install hint and exit non-zero).
- [ ] **Step 4: Run** the unit tests, then run the tool for `--page 3` and confirm that the output lists the sex-at-birth checkbox with both widgets and a recognizable label (paste the three-line excerpt into the task report).
- [ ] **Step 5: Commit** — `chore(saca2): add a developer tool that shows each PDF field with its nearby label`.

---

### Task 3: Fill engine core, encoders, checkbox writer, coverage ratchet

**Files:**
- Create: `lib/masshealth/saca2/pdf/types.ts`, `encoders.ts`, `visible-reader.ts`, `checkbox-writer.ts`, `pdf-fill.ts`, `never-fill.ts`, `unmapped-fields.json` (generated), `field-map/index.ts` (empty registry `FIELD_MAP: FieldEntry[]` plus per-region imports added by later tasks), `__tests__/helpers/read-filled.ts`
- Test: `__tests__/encoders.test.ts`, `visible-reader.test.ts`, `checkbox-writer.test.ts`, `pdf-fill.test.ts`, `coverage.test.ts`

**Interfaces (exact):**

```ts
// types.ts
export type Encoder =
  | "text" | "date" | "money" | "phone" | "number" | "upper"
  | { kind: "ssn" }                          // 10 single-char boxes, see below
  | { kind: "digits"; width: number }        // zero-padded digit boxes, e.g. year parts
  | { kind: "yesNo"; yes: string; no: string }   // on-states of ONE two-widget group
  | { kind: "pick"; states: Record<string, string> } // enum value -> on-state of ONE group
  | { kind: "check" }                        // single /On checkbox: true -> checked

export type Source =
  | { kind: "answer"; stepId: Saca2StepId; path: string; person?: 0 | 1 }
      // `path` is the question path as the step content writes it (relative to the step scope);
      // for person steps `person` selects the block; repeater rows use `row` below.
  | { kind: "row"; stepId: Saca2StepId; path: string; index: number; key: string; person?: 0 | 1 }
      // `index`-th row of the repeater at `path`, field `key`
  | { kind: "derived"; id: string }          // computed by pdf-fill (e.g. Person 1 full name for headers)

export interface FieldEntry {
  /** One or more AcroForm field names written from the same value (e.g. the SSN boxes, or a
   *  value repeated in a header on several pages). For `ssn` the array is the ten boxes in order. */
  fields: string[]
  source: Source
  encode: Encoder
}
```

`visible-reader.ts` exports `createVisibleReader(answers, on)` returning `{ get(source): unknown | undefined; rows(stepId, path, person?): number }` where `get` returns `undefined` unless the step is visible, the question (resolved from the step's content definition by `path`; repeater item questions resolved through the repeater config with `ctx.item`) is visible, and — for rows — the repeater itself is visible. `pdf-fill.ts` exports `fillSaca2Pdf(answers: Saca2Answers, templateBytes: Uint8Array, on: Date): Promise<Uint8Array>` and `collectFillValues(answers, on)` (the pure part: returns `Array<{ field: string; value: string | boolean | string /* on-state */ }>` — tests target this without touching PDFs).
`checkbox-writer.ts` exports `setCheckboxState(form, fieldName, onState | null)`: finds the checkbox, sets its `/V` to the on-state name (or `/Off`) and sets **each widget's** `/AS` to its own on-state when it matches and `/Off` otherwise; throws if `onState` is not one of the field's widget on-states.
`encoders.ts`: pure functions with unit tests; `ssn` accepts `###-##-####` or digits and returns exactly 9 digits placed in boxes 1–9 of the ten-box array by the entry's own ordering (**the ten fields are `SSN1…SSN10` in the form's own numbering, two of which are the form's dash separators — read the inventory for the real names and put the nine digit boxes in `fields`**, leaving separators out); `date` → `MM/DD/YYYY`; `money` → `1234.5` → `1234.50`, `1200` → `1200`; `phone` → `(617) 555-0100` from 10 digits; text encoder strips control characters and, for characters the embedded font cannot render, substitutes `?` (never throws).
`never-fill.ts`: `NEVER_FILL: Record<string, { reason: "button" | "signature" | "signature-date" | "consent" | "office-use" | "voter" | "other"; note?: string }>` containing at least `Clear` and `Print` now; later tasks add signature / consent fields.
`unmapped-fields.json`: array of field names = inventory − (mapped names ∪ `NEVER_FILL` keys), generated by `npx tsx scripts/saca2-update-unmapped.ts` (create this tiny script here) and committed.

- [ ] **Step 1: Write failing tests.**
  - `encoders.test.ts`: date (`"2026-10-13"` → `"10/13/2026"`, `null` → `undefined`), SSN (`"123-45-6789"` → nine single digits `["1","2","3","4","5","6","7","8","9"]`; invalid length → `undefined`, never partial), phone, money (`1200` → `"1200"`, `1234.5` → `"1234.50"`, `0` → `"0"`, `null` → `undefined`), `digits` zero padding, text sanitizer (control chars removed; an emoji replaced; length unchanged otherwise).
  - `visible-reader.test.ts` (use real fixtures): `person1` `firstName` readable for `completeSingleSenior`; a hidden answer returns `undefined` — set `persons[0].applyingForCoverage = "no"` and a stale `ssn` → `get` of the SSN returns `undefined`; step gating — `suppA` answers on a household where `isStepVisible("suppA")` is false return `undefined`; repeater rows — `rows("assets", "assets.bankAccounts")` equals the row count when the gate is yes and `0` when the gate is flipped to no; a repeater-item question hidden by `ctx.item` (e.g. `balanceWhenClosed` on an open account) returns `undefined`. **Each case asserts both the visible and the stale/hidden variant.**
  - `checkbox-writer.test.ts`: load the real template; pick three real groups from the inventory — a `/Yes ; /No` pair, a `/1 ; /2` pair whose widget order is reversed (`/2 ; /1` — find one in the inventory), and a four-state group — and for each: set each state, save, reload, assert the field `/V` and each widget `/AS` (state name on the matching widget, `/Off` on the others); setting `null` clears all; an unknown state throws with the field name and the allowed states.
  - `pdf-fill.test.ts`: with a **synthetic one-entry map injected through a parameter** (design `fillSaca2Pdf` to take an optional `map` argument defaulting to `FIELD_MAP` so the engine is testable independently of region tasks), fill a text, an SSN, a date and a Yes/No; reload the output, `readFilled` returns the exact values; the output still has 1,149 fields (not flattened) and all original field names; a name in the map that does not exist in the template throws (message has the field name only, never an answer value); non-Latin text (`"Zoë 李"`) fills without throwing and `?` replaces only the unrenderable character(s).
  - `coverage.test.ts`: `unmapped-fields.json` equals the sorted set difference of inventory names and (mapped names ∪ `NEVER_FILL` keys) **for the current `FIELD_MAP`**; every `FIELD_MAP` field exists in the inventory with a compatible type (text encoders → text fields, checkbox encoders → checkbox fields, and `yesNo`/`pick` on-states exist on that field's widgets); no field appears in two entries; every `NEVER_FILL` key exists in the inventory and has a reason. (With an empty map this passes trivially; later tasks keep it honest.)
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** the modules. `pdf-fill.ts`: load template via `loadSaca2Template()` unless bytes are passed; `PDFDocument.load`; `fontkit` registered and an embedded font for appearances (ship one Unicode-capable open font in `resources/fonts/` only if needed for non-Latin — if the repo already embeds one for other PDFs reuse it; otherwise use Helvetica with the `?` substitution and note the limitation in the report); for each map entry resolve the value through the visible reader, encode, and write (text → `field.setText`, checkbox → `setCheckboxState`); `form.updateFieldAppearances()`; `doc.save({ updateFieldAppearances: true })`. Never log values. Generate and commit `unmapped-fields.json` (all 1,147 non-never-fill fields listed).
- [ ] **Step 4: Run tests, type check, lint.** Expected: PASS.
- [ ] **Step 5: Commit** — `feat(saca2): add the PDF fill engine core, encoders, group-aware checkbox writer, and coverage ratchet`.

---

### Task 4: Intake and Person 1, form pages 1–3 (page indexes 2–4)

**Files:**
- Create: `lib/masshealth/saca2/pdf/field-map/intake.ts`, `person-table.ts` (the shared Person 1 / Person 2 question table, started here), `field-map/person1-a.ts`
- Modify: `field-map/index.ts`, `unmapped-fields.json`, `never-fill.ts`
- Test: `lib/masshealth/saca2/pdf/__tests__/map-intake-person1a.test.ts`

**Interfaces:**
- Consumes: Task 3 types/engine; `FieldEntry`, the question definitions under `lib/masshealth/saca2/questions/`.
- Produces: entries covering page indexes 2–4 (≈90 fields): the three program boxes and the SNAP-to-DTA opt-in box, "Person 1 names" lines (`You`, `Spouse`, `You_2`, … on the intake page — read their context: they are the per-program applicant name lines), Person 1's name / relationship / sex at birth / applying / address / mailing / phones / email / languages / SSN (nine digit boxes) / SSN-card name question / **tax (Q11a–e)** as far as these pages hold them. The Person-table format: `PERSON_TABLE: Array<{ path: string; stepId: "person1"|"person2"; p1: FieldEntryParts; p2?: FieldEntryParts }>` where `FieldEntryParts = { fields: string[]; encode: Encoder }` so Task 6 adds the `p2` columns to the same rows and the table expands to `FieldEntry[]` for each person.

- [ ] **Step 1: Run the field context tool** for `--page 2`, `--page 3`, `--page 4` and read `pdftotext -layout` for form pages 1–3. Write down, per field, the question path it belongs to. Unclear fields → "unresolved".
- [ ] **Step 2: Write failing tests** (`map-intake-person1a.test.ts`): fill `completeRichHousehold()` through `fillSaca2Pdf` with the real map and read back — exact expectations for each mapped group: program boxes match `intake.programs`; Person 1 first/middle/last name, DOB, sex-at-birth group state, relationship text, address lines, state/ZIP/county, phones, email, SSN as nine digits, the Q11 tax answers (Yes/No groups) including the dependents list as the form lays it out. Stale-answer cases: a copy of the fixture with `applyingForCoverage = "no"` and a leftover SSN → the SSN boxes are empty; `isLegallyMarried = "no"` with a stale spouse name → spouse fields empty. The coverage test (Task 3) must pass with `unmapped-fields.json` shrunk by exactly the fields mapped here.
- [ ] **Step 3: Run to verify failure.**
- [ ] **Step 4: Implement** the entries; regenerate `unmapped-fields.json` with the script; add never-fill entries (e.g. enrollment-assister / office-use fields on these pages, each with a reason).
- [ ] **Step 5: Run tests, type check, lint.** Report: fields mapped, never-fill added, unresolved list.
- [ ] **Step 6: Commit** — `feat(saca2): map the intake and Person 1 identity pages`.

---

### Task 5: Person 1, form pages 4–6 (page indexes 5–7)

Same shape as Task 4 for ≈186 fields: citizenship / immigration (13a–f), residency, caregiver children, pregnancy, foster care, rent/own, disability, accommodations (both checkbox grids, "other" text), SSI history, income (current job table, seasonal month boxes, self-employment, other-income checkboxes with amount + frequency, capital gains / farming, lottery, rental units, one-time income lines, deductions grid with "None"), yearly income.

**Files:** Create `field-map/person1-b.ts`; extend `person-table.ts`; modify `field-map/index.ts`, `unmapped-fields.json`, `never-fill.ts`; Test: `__tests__/map-person1b.test.ts`.

- [ ] **Step 1:** context tool for `--page 5/6/7` + form text pp. 4–6.
- [ ] **Step 2: Failing tests** with `completeRichHousehold()`: exact read-back for the rich values (noncitizen status + document fields, pregnancy count + due date, foster-care state, accommodation checkboxes, the wages row incl. seasonal months Jun/Jul/Aug boxes, self-employment work type + monthly net, pension "source", capital-gains profit/loss, two rental units with amount-vs-loss placement, one-time income this/next year lines, the two deductions + "None" cleared, expected income this/next year). **Gate-flip tests:** `usCitizenOrNational "yes"` with stale immigration fields → immigration fields empty; `hasIncome "no"` with leftover rows → income table empty and the "No" box checked; income row `kind` switched from `wages` to `pension` with leftover `employerNameAndAddress` → employer field empty; `seasonal "no"` with ticked months → month boxes empty; `deductions.none = true` with stale amounts → amount boxes empty. Monthly-net kinds write the amount and the profit/loss choice, never a frequency.
- [ ] **Step 3–6:** run to fail; implement; run tests/type check/lint; commit — `feat(saca2): map the Person 1 income, household, and status pages`.

---

### Task 6: Person 2, form pages 7–11 (page indexes 8–12)

Add the `p2` columns to `PERSON_TABLE` for every row that exists on Person 2's pages (≈268 fields) and map the Person 2–only differences (relationship to Person 1, "lives with Person 1", numbering 1–44). Person 2 pages repeat the Person 1 questions with `_P2`-style names; rows whose wording differs (e.g. "Person 2's tax Q21") use the same question path with a different `fields` list.

**Files:** Modify `person-table.ts`, `field-map/index.ts`, `unmapped-fields.json`; Test: `__tests__/map-person2.test.ts`.

- [ ] **Step 1:** context tool for `--page 8…12`.
- [ ] **Step 2: Failing tests:** `completeRichHousehold()` (Person 2 citizen spouse, no income, deductions None) and `completeFacilityCouple()` (Person 2 not applying — only the questions the form asks of a non-applying person are filled: name, relationship, accommodations Q, income, next-year one-time, deductions) read back exactly; **parity test:** for every `PERSON_TABLE` row with both columns, a value written for Person 1 and the same value for Person 2 land in *different* field names, and both people filled in one fixture do not overwrite each other. Stale: Person 2 `applyingForCoverage "no"` with leftover Q5–19 answers → empty.
- [ ] **Step 3–6:** fail; implement; pass; commit — `feat(saca2): map the Person 2 pages through the shared person table`.

---

### Task 7: Overflow sheets and page selection

**Files:**
- Create: `lib/masshealth/saca2/pdf/overflow.ts`, `page-selection.ts`
- Modify: `pdf-fill.ts` (use both)
- Test: `__tests__/overflow.test.ts`, `page-selection.test.ts`

**Interfaces:**
- Produces: `overflowSheet(doc, { title: string; headerName: string; headerSsn: string; rows: string[][]; columns: string[] })` appending one or more letter-size pages with a table (wraps text, paginates, embeds the font), headed "Continuation — {title}", Person 1's name and SSN (as the form instructs: "put your name and SSN on every added page"), page footer "Attachment to SACA-2 application"; `selectPages(doc, { keepIndexes: number[] })` removing every other page while keeping the AcroForm consistent (removed pages' widgets are dropped from fields; fields with no widgets left are removed from the form so the output does not carry dangling fields). `PAGE_RANGES` constant: `{ suppA: [26..29], suppB: [30], suppC: [31], suppD: [32], ard: [...], irs4506: [...] }` — **derive the exact indexes from the inventory + `pdftotext` (ARD-1122 spans form pages 33–36 and IRS 4506 pages 37–38 per the spec; fields exist on idx 35–38, so the instruction pages before them are part of the attachment)** and record the page map in the module with a comment pointing at the form pages.

- [ ] **Step 1: Failing tests.** Overflow: 12 rows into a 2-row table → a sheet with the 10 extra rows, header has name + SSN, page count of the output grows by the expected number; 80 rows paginate; empty overflow adds no page; very long cell text wraps without throwing. Page selection (real template): keeping all pages is a no-op; dropping Supplement C removes exactly its page and its fields (field count drops by the Supp C field count from the inventory), the remaining fields keep their names; selecting through `isStepVisible` for `completeSingleSenior()` yields a PDF without Supplement A–D, ARD, IRS 4506 pages and for `completeHomeWithAllSupplements()` with all of them.
- [ ] **Step 2–5:** fail; implement; pass (+ type check/lint); commit — `feat(saca2): add overflow sheets and page selection to the PDF fill`.

---

### Task 8: Steps 3–5, form pages 12–15 (page indexes 13–16)

Map AI/AN screen, previous medical bills, and Step 5 assets (bank accounts, real estate, life insurance, securities, annuities, assisted-living deposit, vehicles, prepaid burial, trusts) — ≈170 fields. **Assets tables have fixed rows; rows beyond the available fields go through `overflowSheet`** (Task 7) with one continuation sheet per asset category. Closed accounts and balance-on-admission columns follow the form's columns.

**Files:** Create `field-map/steps-3-5.ts`, `field-map/assets.ts`; modify `pdf-fill.ts` (register the asset overflow producers), `index.ts`, `unmapped-fields.json`, `never-fill.ts`; Test: `__tests__/map-steps-3-5.test.ts`.

- [ ] **Step 1:** context tool for `--page 13…16`; for each table record the number of rows the form provides.
- [ ] **Step 2: Failing tests:** `completeFacilityCouple()` and `completeRichHousehold()` read back the gate answers (Yes/No groups) and the table rows exactly; an **overflow fixture** — a copy of the fixture with 5 bank accounts when the form holds 2 — fills rows 1–2 in fields and puts rows 3–5 on a continuation sheet (read the sheet text back with `pdftotext` or by reading the page's content via pdf-lib's text extraction helper if available; if neither is available in tests, assert the generated sheet's input rows through an exported `buildOverflowSheets(answers, on)` pure function and assert the PDF page count); gate flip: bank gate "no" with stale rows → table empty; a closed account writes closed date + balance-when-closed and **not** current balance.
- [ ] **Step 3–5:** fail; implement; pass; commit — `feat(saca2): map previous bills and the Step 5 asset tables with overflow`.

---

### Task 9: Steps 6–9, form pages 16–18 (page indexes 17–19)

Map health insurance (Medicare, Part D, Medigap, MSP/Part B help, other coverage, employer-offered), HRAs, the PCA screen (3-part question per person) and Step 9 (breast/cervical cancer, HIV) — ≈72 fields.

**Files:** `field-map/steps-6-9.ts`; modify index/unmapped/never-fill; Test: `__tests__/map-steps-6-9.test.ts`.

- [ ] Context tool for `--page 17…19`; failing read-back tests with `completeSingleSenior()`, `completeHomeWithAllSupplements()` (PCA chain Yes for Person 1 only), and `completeFacilityCouple()`; stale: `pca.needsPca "no"` with leftover `byPerson` answers → empty; spouse PCA answers when Person 2 is absent → empty; `hasOtherCoverage "no"` with stale insurer rows → empty. Commit — `feat(saca2): map the health coverage, HRA, PCA, and additional-coverage pages`.

---

### Task 10: Step 10, consents, signature, responsible party, SNAP, voter (page indexes 19–25 and 33–34)

Map **only** what the wizard collects: the emancipated-minor answer, the responsible-party block (name, SSN, relationship, DOB, address, phone, phone type, email on idx 25: `*_S` names), the authorized-representative checkbox on the signature line if the form has one, and the SNAP-to-DTA opt-in already handled on the intake page. **Everything else on these pages — 28 consent items, penalties acknowledgements, signatures, signature dates, voter-registration Yes/No — goes into `NEVER_FILL` with its reason.** Pages 20–23 and 33–34 carry no (or one) field; list the single stray field.

**Files:** `field-map/step-10.ts`; modify `never-fill.ts`, `unmapped-fields.json`, index; Test: `__tests__/map-step-10.test.ts`.

- [ ] Failing tests: a minor-applicant fixture (copy of `completeSingleSenior()` with a DOB making the applicant 17, `signing.emancipatedMinor = "no"`, `signature.signedBy = "responsibleParty"`, responsible-party fields set) reads back the responsible-party block exactly; an adult with stale responsible-party data → block empty; **no signature, signature date, consent, or voter field is ever written** (iterate all `NEVER_FILL` entries with reasons `signature`/`signature-date`/`consent`/`voter` and assert each is empty after filling the richest fixture). Commit — `feat(saca2): map the responsible party and mark signatures and consents as never-fill`.

---

### Task 11: Supplement A, form pages 25–28 (page indexes 26–29, header fields on 25)

≈119 fields: facility, spouse expenses, family at home, the eight transfer Yes/No questions, transfers table, facility deposit, home/relatives (six relative blocks), other real estate, LTC insurance, tax returns. Header fields on each supplement page (`Date of birth_S`, `Phone_S`, `Zip code_S` and similar) are **derived** from Person 1 (name, SSN, DOB, address) — implement `derived` ids `p1.fullName`, `p1.ssnDigits`, `p1.dob`, etc. in `pdf-fill.ts` once and reuse them in Tasks 11–13.

**Files:** `field-map/supp-a.ts`; extend `pdf-fill.ts` derived values; modify index/unmapped/never-fill; Test: `__tests__/map-supp-a.test.ts`.

- [ ] Failing tests with `completeFacilityCouple()` (nursing facility, transfer row, home, relatives) and `completeHomeWithAllSupplements()` (HCBS: facility and spouse-expense blocks must be **empty**, intends-to-return empty): exact read-back; transfers beyond the form's rows → continuation sheet; stale: `needsNursingFacility "no"` with leftover facility fields → empty; `transferAnswers` all no with leftover rows → table empty; `ownsHome "no"` with stale relatives → empty; Supplement A pages absent from the output when `isStepVisible("suppA")` is false (re-check through Task 7 selection). Commit — `feat(saca2): map Supplement A`.

---

### Task 12: Supplements B, C, D and the attachments ARD-1122 and IRS 4506 (page indexes 30–32 and 35–38)

≈229 fields. B: AI/AN members table (overflow for >form rows); C: per person (Person 1 and the spouse's separate Supplement C copy if the form provides two — if the form has one Supplement C page, a second qualifying person gets a **second copy of the page**: implement `duplicatePage(doc, index)` with renamed fields (`_P2` suffix) or, if that proves unsound, an overflow-style continuation and report the decision); D: employer jobs (overflow). ARD: section 1/2/3 choices, representative contact, org staff / officer fields; IRS 4506: taxpayer lines (name, SSN **as the form's single-line fields `1b`/`2b`**, address, previous address, form number `1040`, years requested, joint-return handling), never the signature / date / phone-of-signer fields beyond what the wizard collects.

**Files:** `field-map/supp-bcd.ts`, `field-map/attachments.ts`; modify `page-selection.ts` (final ARD / IRS page ranges), `pdf-fill.ts`, index/unmapped/never-fill; Test: `__tests__/map-supp-bcd.test.ts`, `map-attachments.test.ts`.

- [ ] Failing tests: `completeHomeWithAllSupplements()` read-back of B, C (activities grid with the bathing row 1×/day 7 days), D (job with premiums), ARD (section 1, person representative), IRS 4506 (year 2025-12-31, joint "no", ITIN absent because SSN present); a two-job / seven-member overflow case; a couple where both qualify for Supplement C (build from `completeFacilityCouple()` with the PCA chain Yes for both, nursing facility off) gets two Supplement C copies with Person 2's data on the second; stale: `taxReturnsFiled "bothYears"` + copies `"yes"` → no IRS 4506 pages; `signature.signedBy` changed from `authorizedRepresentative` to `applicant` with leftover ARD data → no ARD pages and no ARD fields in the output. Commit — `feat(saca2): map Supplements B–D, the ARD-1122, and the IRS 4506`.

---

### Task 13: Coverage closure and end-to-end fill tests

**Files:**
- Modify: `unmapped-fields.json`, `never-fill.ts`, `field-map/*` as needed
- Create: `__tests__/pdf-fill-e2e.test.ts`

- [ ] **Step 1: Resolve leftovers.** Run the coverage script; for each remaining field decide with the reports' "unresolved" lists: map it, or add it to `NEVER_FILL` with a specific reason (office use, signature, consent, voter, no wizard question). Fields that look like they should be filled but have no wizard question are listed in the report under "form questions without a wizard question" for the owner (do not invent answers).
- [ ] **Step 2: Make the ratchet strict.** `coverage.test.ts` gains: `unmapped-fields.json` must be `[]`; every `NEVER_FILL` entry has a non-empty `note` for reason `other` and a reason from the allowed list otherwise.
- [ ] **Step 3: End-to-end tests.** For each of the four complete fixtures, `fillSaca2Pdf` completes in under 5 s; reload succeeds; field count is `1149` minus the dropped pages' fields; **no value appears in any NEVER_FILL field**; running `pdftotext` on the output (skip the test with a clear message when the binary is missing — CI has it; check `.github/workflows/ci.yml`) contains Person 1's name and does **not** contain a sentinel string planted in a stale hidden answer (set e.g. `persons[0].noSsnReason`-style stale text "STALE-SENTINEL" in each gate-flip scenario used across Tasks 4–12 and assert absence in every output); the output is deterministic for fixed input apart from the PDF `/ModDate` (compare field values, not bytes).
- [ ] **Step 4: Full verification** — `npx vitest run lib/masshealth/saca2 && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2 scripts`.
- [ ] **Step 5: Commit** — `test(saca2): require full PDF field coverage and add end-to-end fill checks`.

---

### Task 14: Fill route

**Files:**
- Create: `app/api/forms/saca2/fill/route.ts`, `app/api/forms/saca2/fill/__tests__/route.test.ts`
- Modify: `lib/server/rate-limit.ts` (add `saca2FillLimiter = new DbRateLimiter({ limit: 10, windowMs: 10 * 60_000 })`, same pattern as `documentUploadLimiter`)

**Interfaces:**
- `POST /api/forms/saca2/fill` body `{ applicationId: uuid; wizardState: { schemaVersion; data: object } }` (Zod: `applicationId` via `uuidSchema`; `wizardState` as `z.record(z.unknown())`; **reject bodies larger than 200 KB before parsing**, 413). Flow: `requireAuthenticatedUser` → flag check (`isSaca2Enabled()` from `lib/masshealth/saca2/flag.ts`, 404 when off) → rate limit (`checkRateLimitAsync(saca2FillLimiter, "saca2-fill:"+userId)`, 429) → `getApplicationDraft(userId, applicationId, X-Acting-For-Patient)` must return a record with `applicationType` `saca2` (null → 404 so existence is not leaked; wrong type → 409) → `normalizeSaca2State(wizardState)` (null → 422) → `fillSaca2Pdf(state.data, templateBytes, new Date())` → `new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="SACA-2-application.pdf"', "Cache-Control": "no-store" } })`. Template integrity error → 500 `{ ok: false, error: "The application template could not be verified." }`. All other errors → generic 500; `logServerError` receives the error and `{ module, userId, applicationId }` only — never the body or answers.

- [ ] **Step 1: Failing tests** (mock `requireAuthenticatedUser`, `getApplicationDraft`, the limiter, `loadSaca2Template`; real `fillSaca2Pdf` against the real template with `completeSingleSenior()` for one happy path): 401 when unauthenticated; 404 when the flag is off; 429 when limited; 404 when the draft lookup returns null (no row / not owned) and 409 for a non-SACA-2 row; acting-for header is forwarded to `getApplicationDraft`; 413 for a 250 KB body; 422 for malformed `wizardState` (string, array, wrong schemaVersion); 200 returns `application/pdf`, `no-store`, a body starting with `%PDF`; template mismatch → 500 with the exact message and **no** answer content in the response or in the `logServerError` call (assert on the mock's arguments for a planted sentinel name); the route never writes (no fs write / db write mocks called).
- [ ] **Step 2–5:** fail; implement; pass (+ `npx tsc --noEmit -p tsconfig.json && npx eslint app/api/forms lib/server`); commit — `feat(saca2): add the SACA-2 PDF fill route`.

---

### Task 15: Wizard download, docs, and final verification

**Files:**
- Create: `components/application/saca2/saca2-download.tsx` (+ test)
- Modify: `components/application/saca2/saca2-wizard.tsx` (last step shows a completion panel with the download button and the existing Save & Exit), `docs/superpowers/specs/2026-10-13-saca2-application-design.md` (§4.6 as built; §6 Phase 2 row names this plan, "done once merged"), `docs/superpowers/saca2-flag-on-checklist.md` (add: smoke-test the download — open in a PDF reader, verify names/SSN/dates, signatures blank; note PDF fill requires `resources/forms/saca2-2026-08.pdf` in the deployed image)

**Interfaces:**
- `Saca2Download` props `{ applicationId: string; wizardState: object; actingForPatientId?: string }`: a button "Download your filled SACA-2 (PDF)" that POSTs to the route with `authenticatedFetch` (+ `X-Acting-For-Patient` when set), shows "Preparing your PDF…" while pending, then triggers a browser download of the returned blob (`URL.createObjectURL`, revoked afterwards) and shows a persistent note "Print, sign, and date the form yourself — signatures and consents are never filled in for you."; on 429 "Too many downloads, try again in a few minutes."; on any other failure a retryable alert. It sends `buildSaca2Snapshot(state)`'s `{ schemaVersion, data }` (full data, in memory only).
- In the wizard, `Finish` on the last step (currently opens Save & Exit) now reveals the completion panel (`data-testid="saca2-complete"`) with `Saca2Download`, a "Back to editing" button, and "Save & Exit"; the panel replaces nothing else.

- [ ] **Step 1: Failing tests:** download success (mock `authenticatedFetch` returning a PDF blob; assert the request body contains the answers and the acting-for header when provided; the note about signatures is shown; the object URL is revoked); 429 and 500 copies; the button is disabled while pending; wizard test: finishing the last step shows the completion panel, "Back to editing" returns to the last step with state intact, and Save & Exit still opens the dialog.
- [ ] **Step 2–4:** fail; implement; pass.
- [ ] **Step 5: Docs** as listed. **Step 6: Full verification:** `npx vitest run && npx tsc --noEmit -p tsconfig.json && npx eslint lib/masshealth/saca2 lib/server components/application app/api/forms scripts` (re-run load-sensitive unrelated files alone if they time out). **Step 7: Commit** — `feat(saca2): add the PDF download to the wizard and document the fill`.

---

## What comes next (not part of this plan)

- **Plan 4:** the eligibility engine (income/asset tests, spousal impoverishment, transfer penalty) and the document checklist.
- **Plan 5:** i18n, chat intake, touchpoints, Playwright journeys, rollout.
- **Open items:** MassHealth confirmation that `2026-08` is the current form (spec §7.4); how the SW "acting for" flow should deliver the PDF; whether the ARD / IRS 4506 instruction pages should be included when only the form pages are triggered.
