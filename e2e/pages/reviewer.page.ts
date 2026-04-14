/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { Page, expect } from "@playwright/test"

export class ReviewerPage {
  constructor(private page: Page) {}

  async gotoDashboard() {
    await this.page.goto("/reviewer/dashboard")
  }

  async gotoCases() {
    await this.page.goto("/reviewer/cases")
  }

  async gotoAudit() {
    await this.page.goto("/reviewer/audit")
  }

  async assertDashboardLoaded() {
    await expect(this.page).toHaveURL(/\/reviewer\/dashboard/)
    await expect(
      this.page.getByText(/pending|case|review|approved|flagged/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  async assertCasesLoaded() {
    await expect(this.page).toHaveURL(/\/reviewer\/cases/)
    // Expect some kind of list or table
    await expect(
      this.page.getByText(/case|application|status/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  async clickFirstCase() {
    const caseLink = this.page.getByRole("link", { name: /case|view|review/i }).first()
    await caseLink.waitFor({ state: "visible", timeout: 10_000 })
    await caseLink.click()
  }

  async assertCaseDetailLoaded() {
    await expect(this.page).toHaveURL(/\/reviewer\/case\//)
    await expect(
      this.page.getByText(/approve|deny|request|application/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  }
}
