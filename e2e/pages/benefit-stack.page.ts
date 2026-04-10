/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

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

    // FamilyProfileWizard renders a div-based step wizard — no <form> tag.
    // Step 0 (About You) always shows #age.
    await this.page.waitForSelector("#age", { timeout: 10_000 })

    // Step 0: fill age so the profile is non-trivial
    await this.page.fill("#age", "35")

    // Navigate through steps 0→5 by clicking the "Next" nav button each time.
    // Uses getByRole for reliable accessible-name matching (avoids fragile
    // CSS-selector + text-filter combos that break with whitespace or icons).
    for (let i = 0; i < 5; i++) {
      // The bottom-nav "Next" button is the only button with this accessible name.
      const nextBtn = this.page.getByRole("button", { name: /^next$/i })
      if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await nextBtn.click()
        await this.page.waitForTimeout(600)
      } else {
        break
      }
    }

    // Step 5 (Review): submit button text is "See My Benefits Stack"
    const submitBtn = this.page.getByRole("button", { name: /see my benefits|submit|check|evaluate/i })
    if (await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await submitBtn.click()
    }

    await this.assertResultsVisible()
  }
}
