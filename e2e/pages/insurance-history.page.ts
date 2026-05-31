/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { Page, expect } from "@playwright/test"

export class InsuranceHistoryPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/customer/insurance-history")
  }

  async assertLoaded() {
    await expect(this.page).toHaveURL(/\/customer\/insurance-history/)
    await expect(this.page.getByRole("heading", { name: /insurance history/i })).toBeVisible({
      timeout: 15_000,
    })
  }

  async clickAddPastCoverage() {
    await this.page.getByRole("button", { name: /add past coverage/i }).click()
  }

  async assertDrawerOpen() {
    await expect(this.page.getByRole("heading", { name: /add past coverage/i })).toBeVisible()
  }

  async fillCoverageForm(params: {
    year: number
    planName: string
    premium?: number
  }) {
    await this.page.getByLabel(/coverage year/i).fill(String(params.year))
    await this.page.getByLabel(/plan name/i).fill(params.planName)
    if (params.premium != null) {
      await this.page.getByLabel(/monthly premium/i).fill(String(params.premium))
    }
  }

  async submitForm() {
    await this.page.getByRole("button", { name: /add record/i }).click()
  }

  async assertEntryVisible(year: number, planName: string) {
    await expect(this.page.getByText(planName)).toBeVisible({ timeout: 10_000 })
    await expect(this.page.getByText(String(year)).first()).toBeVisible()
  }

  async assertDuplicateYearError(year: number) {
    await expect(
      this.page.getByText(new RegExp(`${year}.*already exists`, "i")),
    ).toBeVisible()
  }
}
