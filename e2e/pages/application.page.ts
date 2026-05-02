import { expect, Page } from "@playwright/test"
import * as path from "path"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WIZARD_CACHE_KEY_PREFIX = "mhealth:aca-03-0325:wizard:v1"
const EVIDENCE_UPLOAD_FILE = path.join(__dirname, "../../public/forms/ACA-3-0325.pdf")

export class ApplicationPage {
  constructor(private page: Page) {}

  private async authenticatedJsonFetch<TBody extends Record<string, unknown>>(
    method: "POST" | "PUT",
    url: string,
    body: TBody,
  ) {
    return this.page.evaluate(
      async ({ requestMethod, targetUrl, requestBody }) => {
        const authTokenValue = (() => {
          for (let index = 0; index < window.localStorage.length; index += 1) {
            const key = window.localStorage.key(index)
            if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
              return window.localStorage.getItem(key)
            }
          }
          return null
        })()

        const session = authTokenValue ? JSON.parse(authTokenValue) as { access_token?: string } : null
        const accessToken = session?.access_token
        if (!accessToken) {
          return {
            ok: false,
            status: 401,
            body: { ok: false, error: "Authentication required." },
          }
        }

        const response = await fetch(targetUrl, {
          method: requestMethod,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })

        const responseBody = await response.json().catch(() => ({}))
        return {
          ok: response.ok,
          status: response.status,
          body: responseBody,
        }
      },
      { requestMethod: method, targetUrl: url, requestBody: body },
    )
  }

  // Shared helpers to reduce seed data duplication

  private baseContact(name: string, numPeople = "1"): Record<string, string> {
    return {
      application_type: "aca3",
      p1_name: name,
      p1_dob: "03/15/1991",
      p1_email: "demo.e2e@masshealth-test.local",
      p1_phone: "(617)555-0199",
      p1_num_people: numPeople,
      p1_in_prison: "No",
      p1_home_street: "123 Main St",
      p1_home_city: "Boston",
      p1_home_state: "MA",
      p1_home_zip: "02101",
    }
  }

  private basePerson(overrides: {
    coverage?: Record<string, string>
    income?: Record<string, unknown>
  } = {}): Record<string, unknown> {
    return {
      ssn: { has_ssn: "Yes", ssn: "123-45-6789", ssn_name_matches: "Yes" },
      tax: {
        aptc_agree: "Yes",
        legally_married: "No",
        claim_dependents: "No",
        claimed_as_dependent: "No",
      },
      coverage: {
        applying_for_coverage: "Yes",
        ma_resident: "Yes",
        has_disability: "No",
        needs_accommodation: "No",
        is_pregnant: "No",
        foster_care: "No",
        us_citizen: "Yes",
        naturalized_citizen: "No",
        ...overrides.coverage,
      },
      income: {
        has_income: "No",
        total_income_current_year: "0",
        ...overrides.income,
      },
      skippedOptional: { ss_demographics: true },
    }
  }

  private async putDraft(
    applicationId: string,
    payload: {
      currentStep: number
      completedSteps: number[]
      data: Record<string, unknown>
    },
  ) {
    const result = await this.authenticatedJsonFetch("PUT", `/api/applications/${applicationId}/draft`, {
      applicationType: "aca3",
      wizardState: {
        currentStep: payload.currentStep,
        completedSteps: payload.completedSteps,
        tabByStep: { 4: 0, 5: 0, 6: 0, 7: 0 },
        errors: {},
        dirty: false,
        submitted: false,
        persistedAt: new Date().toISOString(),
        data: payload.data,
      },
    })
    expect(result.ok, JSON.stringify(result.body)).toBeTruthy()
  }

  // Navigation

  async gotoTypeSelector() {
    await this.page.goto("/application/type")
    await expect(
      this.page.getByText(/choose your masshealth application|select the exact form/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  async selectAca3Draft(): Promise<string> {
    const aca3Button = this.page
      .getByRole("button")
      .filter({ hasText: /\bACA-3\b/ })
      .first()

    await aca3Button.click()
    await expect(this.page).toHaveURL(/\/application\/new\?applicationId=/, { timeout: 15_000 })

    const applicationId = this.currentApplicationId()
    expect(applicationId).toMatch(UUID_PATTERN)
    return applicationId
  }

  currentApplicationId(): string {
    const url = new URL(this.page.url())
    return url.searchParams.get("applicationId") ?? ""
  }

  async gotoWizardDraft(applicationId: string) {
    await this.page.goto(`/application/new?applicationId=${applicationId}&mode=wizard`)
  }

  // Assertions

  async assertChatModeVisible() {
    await expect(this.page.getByRole("tab", { name: /ai assistant/i })).toBeVisible()
    await expect(this.page.getByText(/application assistant/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(this.page.locator("textarea").first()).toBeVisible()
  }

  async startFreshInChat() {
    const prefillPrompt = this.page.getByText(/pre-fill|saved info|start fresh/i).first()
    if (!(await prefillPrompt.isVisible({ timeout: 2_000 }).catch(() => false))) {
      await expect(this.page.locator("textarea").first()).toBeEnabled()
      return
    }

    const chatInput = this.page.locator("textarea").first()
    await chatInput.fill("No")
    await chatInput.press("Enter")
    // Textarea clears once the message is accepted
    await expect(chatInput).toHaveValue("", { timeout: 10_000 })
  }

  async switchChatToWizard() {
    const reviewButton = this.page.getByRole("button", { name: /review in form wizard/i })
    await expect(reviewButton).toBeVisible({ timeout: 10_000 })
    await reviewButton.click()
    await this.assertWizardModeVisible()
  }

  async assertWizardModeVisible() {
    await expect(this.page.getByRole("tab", { name: /form wizard/i })).toBeVisible()
    await expect(
      this.page.getByText(/program selection|primary applicant & household setup/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  async advanceWizardToStep2() {
    const step2Heading = this.page.getByText(/primary applicant & household setup/i).first()
    if (await step2Heading.isVisible({ timeout: 1_500 }).catch(() => false)) {
      return
    }

    const nextButton = this.page.getByRole("button", { name: /^next$/i })
    await expect(nextButton).toBeVisible({ timeout: 10_000 })
    await nextButton.click()
    await expect(step2Heading).toBeVisible({ timeout: 10_000 })
  }

  async fillPrimaryApplicantName(name: string) {
    const nameInput = this.page
      .getByLabel(/name/i)
      .filter({ hasNot: this.page.locator('[type="hidden"]') })
      .first()

    await expect(nameInput).toBeVisible({ timeout: 10_000 })
    await nameInput.fill(name)
  }

  async assertPrimaryApplicantNameValue(name: string) {
    const nameInput = this.page
      .getByLabel(/name/i)
      .filter({ hasNot: this.page.locator('[type="hidden"]') })
      .first()

    await expect(nameInput).toHaveValue(name, { timeout: 10_000 })
  }

  async assertWizardRequiredFieldError() {
    const nameInput = this.page
      .getByLabel(/name/i)
      .filter({ hasNot: this.page.locator('[type="hidden"]') })
      .first()

    await expect(nameInput).toBeVisible({ timeout: 10_000 })
    // Clear the required name field — wizard must block advance
    await nameInput.fill("")
    await expect(
      this.page.getByRole("button", { name: /^next$/i }),
    ).toBeDisabled({ timeout: 8_000 })
  }

  async assertWizardAtCoverageStep() {
    await expect(this.page.getByRole("tab", { name: /form wizard/i })).toBeVisible()
    // "Coverage & Eligibility" is the visible section heading; the step-indicator
    // label "COVERAGE" is hidden by overflow so we target the content heading instead.
    await expect(
      this.page.getByText("Coverage & Eligibility").first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  async assertDraftVisibleOnStatusPage(applicationId: string) {
    await this.page.goto("/customer/status")
    await expect(this.page.getByText(applicationId).first()).toBeVisible({ timeout: 15_000 })
    await expect(this.page.getByText(/continue/i).first()).toBeVisible({ timeout: 15_000 })
  }

  async assertPdfPreviewReady() {
    await expect(this.page.getByText(/review pdf/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(this.page.getByRole("link", { name: /download pdf/i })).toBeVisible({ timeout: 20_000 })
    await expect(this.page.locator('iframe[title="ACA-03 PDF preview"]')).toBeVisible({ timeout: 20_000 })
  }

  async downloadPdfFromReviewStep() {
    const downloadPromise = this.page.waitForEvent("download")
    await this.page.getByRole("link", { name: /download pdf/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe("aca-3-0325-filled.pdf")
    // Wait for the full download to complete so Playwright doesn't abort the
    // HTTP connection early, which would cause ECONNRESET on the server.
    await download.path()
  }

  async assertIncomeChecklistReady() {
    await expect(this.page.getByText(/income proof documents/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(this.page.getByText(/employment income/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(this.page.getByText(/recent pay stub/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(
      this.page.getByText(/unable to load the income document checklist/i),
    ).not.toBeVisible()
  }

  async assertMultiPersonIncomeChecklist() {
    await expect(this.page.getByText(/income proof documents/i).first()).toBeVisible({ timeout: 15_000 })
    // Two people with income → two employment income sections in the checklist
    await expect(this.page.getByText(/employment income/i)).toHaveCount(2, { timeout: 15_000 })
    await expect(
      this.page.getByText(/unable to load the income document checklist/i),
    ).not.toBeVisible()
  }

  async assertNonCitizenFieldsVisible() {
    // Coverage step always shows citizenship question; "naturalized, derived, or acquired"
    // is the follow-up that confirms the citizenship sub-section rendered correctly.
    await expect(
      this.page.getByText(/naturalized.*derived.*acquired|us citizen.*national|citizen.*national/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  async assertAccommodationSectionVisible() {
    // Scroll to bring disability / accommodation fields into view (they appear below
    // the citizenship questions on the Coverage & Eligibility step).
    await this.page.evaluate(() => {
      const el = document.querySelector("main") ?? document.body
      el.scrollTo(0, el.scrollHeight)
    })
    await expect(
      this.page.getByText(/disability|accommodation|special.*need|need.*help.*apply/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  // Seed methods

  async seedPdfReadyDraft(applicationId: string, applicantName: string) {
    await this.putDraft(applicationId, {
      currentStep: 8,
      completedSteps: [1, 2, 3, 4, 5, 6, 7],
      data: {
        contact: this.baseContact(applicantName),
        persons: [this.basePerson({ income: { has_income: "No", total_income_current_year: "0" } })],
        attestation: false,
      },
    })
  }

  async seedIncomeEvidenceDraft(applicationId: string, applicantName: string) {
    await this.putDraft(applicationId, {
      currentStep: 9,
      completedSteps: [1, 2, 3, 4, 5, 6, 7, 8],
      data: {
        contact: this.baseContact(applicantName),
        persons: [
          this.basePerson({
            income: {
              has_income: "Yes",
              employment_jobs: [
                { employer_name: "Demo Market", wages_amount: "3200", wages_frequency: "monthly" },
              ],
              total_income_current_year: "38400",
            },
          }),
        ],
        attestation: false,
      },
    })
  }

  // Two-person household — both members have employment income, producing a two-section checklist
  async seedMultiPersonDraft(applicationId: string, applicantName: string) {
    await this.putDraft(applicationId, {
      currentStep: 9,
      completedSteps: [1, 2, 3, 4, 5, 6, 7, 8],
      data: {
        contact: this.baseContact(applicantName, "2"),
        persons: [
          this.basePerson({
            income: {
              has_income: "Yes",
              employment_jobs: [
                { employer_name: "Demo Market", wages_amount: "3200", wages_frequency: "monthly" },
              ],
              total_income_current_year: "38400",
            },
          }),
          {
            ...this.basePerson({
              income: {
                has_income: "Yes",
                employment_jobs: [
                  { employer_name: "City Hall", wages_amount: "2500", wages_frequency: "monthly" },
                ],
                total_income_current_year: "30000",
              },
            }),
            ssn: { has_ssn: "Yes", ssn: "987-65-4321", ssn_name_matches: "Yes" },
          },
        ],
        attestation: false,
      },
    })
  }

  // Non-citizen applicant — wizard lands on step 6 (COVERAGE) with us_citizen: "No"
  async seedNonCitizenDraft(applicationId: string, applicantName: string) {
    await this.putDraft(applicationId, {
      currentStep: 6,
      completedSteps: [1, 2, 3, 4, 5],
      data: {
        contact: this.baseContact(applicantName),
        persons: [
          this.basePerson({
            coverage: {
              applying_for_coverage: "Yes",
              ma_resident: "Yes",
              has_disability: "No",
              needs_accommodation: "No",
              is_pregnant: "No",
              foster_care: "No",
              us_citizen: "No",
              naturalized_citizen: "No",
            },
          }),
        ],
        attestation: false,
      },
    })
  }

  // Applicant needing accommodation — wizard lands on step 6 (COVERAGE) with disability + accommodation flags
  async seedDisabilityDraft(applicationId: string, applicantName: string) {
    await this.putDraft(applicationId, {
      currentStep: 6,
      completedSteps: [1, 2, 3, 4, 5],
      data: {
        contact: this.baseContact(applicantName),
        persons: [
          this.basePerson({
            coverage: {
              applying_for_coverage: "Yes",
              ma_resident: "Yes",
              has_disability: "Yes",
              needs_accommodation: "Yes",
              is_pregnant: "No",
              foster_care: "No",
              us_citizen: "Yes",
              naturalized_citizen: "No",
            },
          }),
        ],
        attestation: false,
      },
    })
  }

  // Draft management

  async waitForWizardDraftNamePersisted(applicationId: string, expectedName: string) {
    await expect
      .poll(
        async () =>
          this.page.evaluate(
            ({ key }) => {
              const raw = window.localStorage.getItem(key)
              if (!raw) return null
              try {
                const parsed = JSON.parse(raw) as {
                  data?: { contact?: { p1_name?: string } }
                }
                return parsed.data?.contact?.p1_name ?? null
              } catch {
                return null
              }
            },
            { key: `${WIZARD_CACHE_KEY_PREFIX}:${applicationId}` },
          ),
        { timeout: 15_000 },
      )
      .toBe(expectedName)
  }

  // Full submission flow (used by tests that exercise validation + submit UI)

  async runValidationAndSubmit() {
    const runValidationButton = this.page.getByRole("button", { name: /run validation/i })
    await expect(runValidationButton).toBeVisible({ timeout: 10_000 })
    await runValidationButton.click()

    const submitButton = this.page.getByRole("button", { name: /^submit application$/i })
    await expect(submitButton).toBeEnabled({ timeout: 15_000 })
    await submitButton.click()

    await expect(
      this.page.getByRole("heading", { name: /submission disclaimer/i }),
    ).toBeVisible({ timeout: 10_000 })

    await this.page
      .getByText(/i acknowledge this disclaimer and authorize submission of this application/i)
      .click()

    const confirmButton = this.page.getByRole("button", { name: /confirm & submit/i })
    await expect(confirmButton).toBeEnabled({ timeout: 10_000 })
    await confirmButton.click()

    await expect(
      this.page.getByText(/application submitted after validation/i),
    ).toBeVisible({ timeout: 15_000 })
  }

  async assertSubmittedStatusDetail(applicationId: string, applicantName: string) {
    await this.page.goto(`/customer/status/${applicationId}`)
    await expect(this.page.getByText(/submitted/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(this.page.getByText(applicantName).first()).toBeVisible({ timeout: 15_000 })
    await expect(
      this.page.getByText(/application submitted for review/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  // Evidence upload

  async uploadIncomeEvidenceDocument() {
    const uploadResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/masshealth/income-verification/documents") &&
        response.request().method() === "POST",
    )
    const verificationCaseResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/masshealth/income-verification/") &&
        !response.url().includes("/documents") &&
        response.request().method() === "GET",
    )

    await this.page.locator('main input[type="file"]').first().setInputFiles(EVIDENCE_UPLOAD_FILE)

    const uploadResponse = await uploadResponsePromise
    expect(uploadResponse.status()).toBe(201)
    const verificationCaseResponse = await verificationCaseResponsePromise
    expect(verificationCaseResponse.status()).toBe(200)

    await expect(this.page.getByText(/ACA-3-0325\.pdf uploaded/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(this.page.getByText(/extraction in progress/i).first()).toBeVisible({ timeout: 15_000 })
  }
}
