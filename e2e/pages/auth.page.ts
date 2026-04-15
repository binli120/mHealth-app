/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { Page, expect } from "@playwright/test"

export class AuthPage {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.goto("/auth/login")
    await this.page.fill("#email", email)
    await this.page.fill("#password", password)
    await this.page.click('button[type="submit"]')
    await this.page.waitForURL("**/customer/dashboard", { timeout: 15_000 })
  }

  async register(opts: {
    firstName: string
    lastName: string
    email: string
    phone: string
    password: string
  }) {
    await this.page.goto("/auth/register")
    // Register page opens on a role-select step — click "Applying for Benefits"
    // to advance to the form step where the input fields appear.
    await this.page.getByRole("button", { name: /applying for benefits/i }).click()
    await this.page.waitForSelector("#firstName", { timeout: 5_000 })
    await this.page.fill("#firstName", opts.firstName)
    await this.page.fill("#lastName", opts.lastName)
    await this.page.fill("#email", opts.email)
    await this.page.fill("#phone", opts.phone)
    await this.page.fill("#password", opts.password)
    await this.page.click('button[type="submit"]')
  }

  async assertOnDashboard() {
    await expect(this.page).toHaveURL(/\/customer\/dashboard/)
  }

  async logout() {
    // Click logout button in the header
    await this.page.getByRole("button", { name: /log.?out|sign.?out/i }).click()
  }
}
