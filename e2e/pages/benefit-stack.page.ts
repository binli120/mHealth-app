import { Page, expect } from "@playwright/test"

export class BenefitStackPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/benefit-stack")
  }

  /** Fill a labeled text/number input */
  async fillField(label: string | RegExp, value: string) {
    const field = this.page.getByLabel(label)
    await field.waitFor({ state: "visible", timeout: 8_000 })
    await field.fill(value)
  }

  /** Select an option from a labeled select */
  async selectOption(label: string | RegExp, value: string) {
    const select = this.page.getByLabel(label)
    await select.waitFor({ state: "visible", timeout: 8_000 })
    await select.selectOption({ label: value })
  }

  async clickButton(label: string | RegExp) {
    await this.page.getByRole("button", { name: label }).click()
  }

  async assertResultsVisible() {
    // BenefitStackView shows program cards after evaluation
    await expect(
      this.page.getByText(/masshealth|snap|eitc|benefit/i).first(),
    ).toBeVisible({ timeout: 30_000 })
  }

  async assertProgramEligible(programName: string | RegExp) {
    const card = this.page.getByText(programName).first()
    await expect(card).toBeVisible({ timeout: 15_000 })
  }

  async runHappyPath() {
    await this.goto()

    // Wait for wizard to load
    await this.page.waitForSelector("form, [data-testid='benefit-wizard']", { timeout: 10_000 })

    // Step through the FamilyProfileWizard
    // The wizard varies per implementation — we target common labels

    // Household size
    const householdInput = this.page.getByLabel(/household size|number of people/i)
    if (await householdInput.isVisible()) {
      await householdInput.fill("3")
    }

    // Annual income
    const incomeInput = this.page.getByLabel(/annual income|yearly income/i)
    if (await incomeInput.isVisible()) {
      await incomeInput.fill("42000")
    }

    // Monthly income (some wizards use monthly)
    const monthlyInput = this.page.getByLabel(/monthly income/i)
    if (await monthlyInput.isVisible()) {
      await monthlyInput.fill("3500")
    }

    // Citizenship
    const citizenOption = this.page.getByLabel(/citizen|citizenship/i)
    if (await citizenOption.isVisible()) {
      await citizenOption.check().catch(() => {})
    }

    // Click Next/Continue through wizard steps — exclude Next.js dev tools button
    for (let i = 0; i < 5; i++) {
      const nextBtn = this.page.locator('button[data-slot="button"]').filter({ hasText: /^next$|^continue$/i }).first()
      if (await nextBtn.isVisible()) {
        await nextBtn.click()
        await this.page.waitForTimeout(500)
      } else {
        break
      }
    }

    // Submit / Evaluate
    const submitBtn = this.page.getByRole("button", { name: /submit|check|evaluate|see.*benefit/i })
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
    }

    await this.assertResultsVisible()
  }
}
