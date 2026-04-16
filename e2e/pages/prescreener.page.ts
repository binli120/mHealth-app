/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { Page, expect } from "@playwright/test"

export class PrescreenerPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/prescreener")
  }

  /** Click a quick-reply button by its visible label */
  async selectQuickReply(label: string | RegExp) {
    const btn = this.page.getByRole("button", { name: label })
    await btn.waitFor({ state: "visible", timeout: 10_000 })
    await btn.click()
    // Wait for typing indicator to finish before next step
    await this.page.waitForTimeout(900)
  }

  /** Fill a number/currency input (role=spinbutton) and press Enter to submit */
  async submitNumber(value: string) {
    // Number inputs render as type="number" → role="spinbutton"
    const input = this.page.getByRole("spinbutton").last()
    await input.waitFor({ state: "visible", timeout: 8_000 })
    await input.fill(value)
    await this.page.keyboard.press("Enter")
    await this.page.waitForTimeout(900)
  }

  async assertResultsVisible() {
    await expect(
      this.page.getByText(/eligible|coverage|qualify|pre-screening complete/i).first(),
    ).toBeVisible({ timeout: 20_000 })
  }

  async assertStartApplicationButtonVisible() {
    await expect(
      this.page.getByRole("link", { name: /start.*application|apply now/i }),
    ).toBeVisible({ timeout: 10_000 })
  }

  async clickStartApplication() {
    await this.page.getByRole("link", { name: /start.*application|apply now/i }).click()
  }

  /**
   * Full happy-path run through the prescreener:
   * MA resident, 27-64, not pregnant, household=3, income=$36k/yr,
   * US citizen, no disability, no employer insurance → eligible results
   */
  async runHappyPath() {
    await this.goto()

    // Step 1: State of residence
    await this.selectQuickReply("Massachusetts")

    // Step 2: Age group (quickreply, not text input)
    await this.selectQuickReply("27–64 years")

    // Step 3: Pregnancy check (appears for ages 19-64)
    await this.selectQuickReply("No")

    // Step 4: Household size (number input → role=spinbutton)
    await this.submitNumber("3")

    // Step 5: Annual income (currency input → role=spinbutton)
    await this.submitNumber("36000")

    // Step 6: Citizenship
    await this.selectQuickReply("U.S. Citizen")

    // Step 7: Disability
    await this.selectQuickReply("No")

    // Step 8: Employer insurance (disability=false + age<65 skips Medicare step)
    await this.selectQuickReply(/No \/ Not applicable/)

    await this.assertResultsVisible()
  }
}
