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
