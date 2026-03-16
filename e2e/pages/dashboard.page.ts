import { Page, expect } from "@playwright/test"

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/customer/dashboard")
  }

  async assertLoaded() {
    await expect(this.page).toHaveURL(/\/customer\/dashboard/)
    // Dashboard should show at least one card or section
    await expect(
      this.page.getByText(/application|benefit|dashboard|welcome/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  async clickNewApplication() {
    await this.page.getByRole("link", { name: /new application|apply|start application/i }).first().click()
  }

  async clickBenefitStack() {
    await this.page.getByRole("link", { name: /benefit stack|check benefits/i }).first().click()
  }

  async clickAppealAssistant() {
    await this.page.getByRole("link", { name: /appeal/i }).first().click()
  }

  async clickProfile() {
    await this.page.getByRole("link", { name: /profile|my profile/i }).first().click()
  }

  async assertNotificationsVisible() {
    // Notification bell or section
    await expect(
      this.page.locator('[aria-label*="notification"], [data-testid*="notification"], button svg').first(),
    ).toBeVisible({ timeout: 8_000 })
  }
}
