# QA Data Pack — Full ACA‑3 Application + Document Verification

One synthetic applicant, **Maria Santos**, wired so every identity/verification check
lines up. Values match `e2e/fixtures/demo-data.ts` (`DEMO_USER` + `DEMO_APPLICATION`)
and `lib/identity/test-license-data.ts` (`TEST_LICENSE_PROFILE`), so the license
barcode scan scores **100 → verified**.

> All documents are watermarked **SAMPLE — NOT VALID**. Synthetic data, no real person.

---

## 1. Canonical identity (must be byte‑identical everywhere)

| Field | Value |
|---|---|
| First / last name | **Maria Santos** |
| Date of birth | **03/15/1991** (MM/DD/YYYY in the wizard; 1991‑03‑15 ISO) |
| SSN | **123‑45‑6789** |
| Email | demo.e2e@masshealth-test.local |
| Phone | (617) 555‑0199 |
| Home address | **123 Main St**, **Boston**, **MA**, **02101**, Suffolk County |
| Citizen | US citizen — yes |
| MA resident | Yes |

Date fields reject anything but `MM/DD/YYYY`. ZIP must be exactly 5 digits. SSN must be `###-##-####`.

---

## 2. Application wizard — field by field

Route: **/application/type → pick "ACA‑3" → /application/new?applicationId=…**
Use **Form Wizard** mode (tab), not Compass/chat — the chat intake needs a local LLM (see Caveats).

### Step 1 — Program Selection  (`pre_application`)
| Field | Value |
|---|---|
| Apply for SNAP benefits (`snap_opt_in`) | leave **unchecked** |
| Long‑Term Care / HCBS Waiver (`long_term_care`) | leave **unchecked** |
| Enrollment assister section | leave collapsed / off |

### Step 2 — Primary Applicant & Household Setup  (`step1_contact`)
| Field (id) | Value |
|---|---|
| First, middle, last name, suffix (`p1_name`) | `Maria Santos` |
| Date of birth (`p1_dob`) | `03/15/1991` |
| Email (`p1_email`) | `demo.e2e@masshealth-test.local` |
| No home address (`p1_no_home_address`) | unchecked |
| Street (`p1_home_street`) | `123 Main St` |
| Apt/unit (`p1_home_apt`) | *(blank)* |
| City (`p1_home_city`) | `Boston` |
| State (`p1_home_state`) | `MA` |
| ZIP (`p1_home_zip`) | `02101` |
| County (`p1_home_county`) | `Suffolk` |
| Mailing same as home (`p1_mailing_same`) | **checked** |
| Phone (`p1_phone`) | `(617) 555-0199` |
| Other phone (`p1_other_phone`) | *(blank)* |
| Preferred spoken / written language | *(blank — English)* |
| # of people on application (`p1_num_people`) | `1`  *(3‑person variant in §4)* |
| Anyone in prison or jail? (`p1_in_prison`) | `No` |

### Step 3 — Household Members
Household size **1** → no Person 2+ rows. Just confirm the read‑only "You (Person 1)" card shows Maria Santos.

### Step 4 — Demographics & SSN  (Person 1 tab)
| Section | Field | Value |
|---|---|---|
| Demographics (`ss_demographics`, optional) | — | click **Skip this optional section** |
| Social Security Number (`ss_ssn`) | Do you have an SSN? (`has_ssn`) | `Yes` |
| | SSN (revealed when Yes) | `123-45-6789` |
| | Name matches SSN card | `Yes` |

### Step 5 — Tax Filing  (`ss_tax`)
| Field | Value |
|---|---|
| Agree to file a federal return if you get APTC (`aptc_agree`) | `Yes` |
| Will be claimed as a dependent (`claimed_as_dependent`) | `No` |
| Filing separately due to domestic abuse/abandonment (`domestic_abuse_separate_taxes`) | `No` |
| Filed a return in the last 2 yrs with APTC/ConnectorCare (`prior_aptc_irs`) | `No` |

### Step 6 — Coverage & Eligibility  (`ss_coverage`)
| Field | Value |
|---|---|
| Applying for coverage for yourself (`applying_for_coverage`) | `Yes` |
| US citizen or US national (`us_citizen`) | `Yes` |
| Eligible immigration status (`eligible_immigration_status`) | *(skip — citizen)* |
| Main caretaker of a child < 19 (`caretaker_of_child`) | `No` |
| Living in MA / intend to reside (`ma_resident`) | `Yes` |
| Disability lasting ≥ 12 months (`has_disability`) | `No` |
| Need reasonable accommodation (`needs_accommodation`) | `No` |
| Pregnant (`is_pregnant`) | `No` |
| Breast or cervical cancer (`breast_cervical_cancer`) | `No` |
| HIV positive (`hiv_positive`) | `No` |
| Ever in foster care (`foster_care`) | `No` |

### Step 7 — Income & Deductions  (`ss_income`)
| Field | Value |
|---|---|
| Do you have any income? (`has_income`) | `Yes` |
| **Employment → Current Job 1** | |
| Employer name and address (`employer_name_address`) | `Harbor Light Home Care LLC, 15 Beacon Street, Boston, MA 02108` |
| Federal Tax ID # (`employer_tax_id`) | `04-3555123` |
| Wages/tips before taxes (`wages_amount`) | `3500` |
| How often? (`wages_frequency`) | `Monthly` |
| Income effective date (`income_effective_date`) | `01/01/2026` |
| Avg hours worked each week (`hours_per_week`) | `40` |
| Seasonally employed? (`seasonally_employed`) | `No` |
| Self‑employed? (`self_employment`) | `No` |
| OTHER INCOME checklist (`other_income`) | check **nothing** |
| One‑time payment this calendar year (`one_time_income_current_year`) | `No` |
| One‑time payment next calendar year (`one_time_income_next_year`) | `No` |
| DEDUCTIONS (`deductions`) | check **None** (`ded_none`) |
| Total expected income, current year (`total_income_current_year`) | `42000` |
| Total expected income, next year (`total_income_next_year`) | *(blank)* |

`$3,500 × 12 = $42,000` — matches the paystub YTD math and `DEMO_APPLICATION.annual_income`.

### Step 8 — Review PDF
Wait for **"Review PDF"** + the embedded preview, click **Download PDF** → file `aca-3-0325-filled.pdf`.

### Step 9 — Validate & Submit
**Run validation** → **Submit Application** → tick *"I acknowledge this disclaimer and authorize submission…"* → **Confirm & Submit** → expect **"Application submitted for review"**.
Check **/customer/status** — the application shows **Submitted**.

---

## 3. Documents  (`qa-application-data/documents/`)

| File | Use in UI | Carries |
|---|---|---|
| `identity-driver-license-maria-santos.html` | **Verify Identity → Scan with Camera / Scan with Phone** — point at the PDF417 barcode | AAMVA barcode for Maria Santos / 1991‑03‑15 / 123 Main St. Client‑side scan → score 100 → **verified**. Works offline. |
| `identity-driver-license-maria-santos.png` | Document uploader, identity slot (fallback if not scanning) | Same identity, as an image |
| `income-paystub-maria-santos.png` | Document uploader → **Recent pay stub / income evidence** | Employee **Maria Santos**, employer **Harbor Light Home Care LLC**, Monthly, gross **$3,500.00**, net $2,745.25, pay date 09/04/2026 |
| `residency-utility-bill-maria-santos.png` | Document uploader → proof of MA residency | Service address 123 Main St, Boston, MA 02101 |
| `*.html` sources | edit values / re‑render | — |

Re‑render a PNG after editing its HTML:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --force-device-scale-factor=2 --window-size=1200,1000 \
  --screenshot="qa-application-data/documents/income-paystub-maria-santos.png" \
  "file://$PWD/qa-application-data/documents/income-paystub-maria-santos.html"
```

**Upload rules** (`lib/uploads/validate.ts`, category `document`): JPEG / PNG / WebP / TIFF / HEIC / PDF, **≤ 10 MB**. MIME is magic‑byte checked — a renamed extension is rejected (415).

Repo also ships format‑only fixtures in `test-fixtures/` (paystubs, passports, driver‑licenses) — those use *different* names (Jamie Rivera, Alexander Weston/Smith) so they fail the identity match; use the files above instead.

---

## 4. 3‑person household variant (optional)

Step 2 `p1_num_people` = `3`. Step 3 adds Person 2 & 3 (`ss_identity`):

| | Person 2 | Person 3 |
|---|---|---|
| Name | `Diego Santos` | `Lucia Santos` |
| Relationship to Person 1 (`relationship_to_p1`) | `Child` | `Child` |
| Lives with Person 1 (`lives_with_p1`) | `Yes` | `Yes` |
| DOB (`dob`) | `06/12/2015` | `09/03/2018` |
| Sex at birth (`sex_at_birth`) | `Male` | `Female` |
| SSN (`has_ssn` = Yes) | `987-65-4321` | `987-65-1234` |
| Step 5 tax / Step 6 coverage | claimed as dependent `Yes`, applying for coverage `Yes`, citizen `Yes` | same |
| Step 7 income (`has_income`) | `No` | `No` |

`DEMO_APPLICATION` household_size is 3, annual_income 42000 — keep Maria's income as the only earner.

---

## 5. Reviewer side — verification → decision → final notice

1. Sign in as a **reviewer** role account → **/reviewer/cases**.
2. Open Maria Santos's case → **Documents** tab: each upload shows status
   (`verified` / `pending_review` / `rejected`) + extraction summary.
3. **Extracted Data** → cross‑check against §1.
4. **Decision** dialog → **Approve** → **Program Assignment** (e.g. MassHealth Standard) → confirm.
5. Approved application + notice = the "final document".

Reviewer login needs the local Supabase stack **or** a known cloud reviewer credential — the
cloud dev DB blocks the `dev-register` test helper (`lib/auth/local-auth.ts` security guard),
so `pnpm test:e2e` skips all reviewer specs against cloud.

---

## 6. Caveats that affect what actually verifies

| Thing | State | Effect |
|---|---|---|
| Image analysis service `http://localhost:8000` (`masshealth_monitor`, `~/dev/tinyfish`) | **not running** — `ModuleNotFoundError: No module named 'masshealth_monitor'` | Paystub / passport / license‑**photo** uploads → `status: error` → **pending_review** (staff queue), not auto‑verified. Set `MASSHEALTH_IMAGE_ANALYSIS_BASE_URL` + run the service to get auto‑validation + certificate. |
| License **barcode scan** (Verify Identity) | client‑side (zxing + `lib/identity/verify-license.ts`) | Unaffected — scores 100 → verified offline. Prefer this for the identity step. |
| Ollama model `llama3.2` | not pulled → `Ollama text call failed: 404` | Chat/Compass intake + income‑doc *text* extraction fail. Use **Form Wizard** mode. `ollama pull llama3.2` to enable. |
| Local Supabase | no `supabase/config.toml`; `.env.local` → cloud dev DB | Reviewer‑role login unavailable until a local stack is stood up. |
