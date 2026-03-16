import { Page, expect } from "@playwright/test"
import type { DEMO_APPEAL } from "../fixtures/demo-data"

export class AppealPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/appeal-assistant")
  }

  async fillDenialForm(data: typeof DEMO_APPEAL) {
    // Select denial reason
    const reasonSelect = this.page.getByLabel(/denial reason|reason.*denied/i)
    if (await reasonSelect.isVisible()) {
      await reasonSelect.selectOption({ value: data.denial_reason }).catch(async () => {
        await reasonSelect.selectOption({ label: /income/i })
      })
    }

    // Member name
    const nameField = this.page.getByLabel(/member name|your name|full name/i)
    if (await nameField.isVisible()) {
      await nameField.fill(data.member_name)
    }

    // Denial date
    const dateField = this.page.getByLabel(/denial date|date.*denied/i)
    if (await dateField.isVisible()) {
      await dateField.fill(data.denial_date)
    }

    // Context / additional info
    const contextField = this.page.getByLabel(/context|additional|explain|description/i)
    if (await contextField.isVisible()) {
      await contextField.fill(data.context)
    }

    // Also try textarea
    const textarea = this.page.locator("textarea").first()
    if (await textarea.isVisible() && !(await textarea.inputValue())) {
      await textarea.fill(data.context)
    }
  }

  async submitForm() {
    const submitBtn = this.page.getByRole("button", { name: /submit|analyze|generate|get.*appeal/i })
    await submitBtn.waitFor({ state: "visible", timeout: 8_000 })
    await submitBtn.click()
  }

  async assertAppealLetterGenerated() {
    // Wait for AI to generate the letter — may take time with Ollama
    await expect(
      this.page.getByText(/appeal letter|dear|to whom|masshealth|denial/i).first(),
    ).toBeVisible({ timeout: 60_000 })
  }

  async assertEvidenceChecklist() {
    await expect(
      this.page.getByText(/evidence|checklist|documents? to gather/i).first(),
    ).toBeVisible({ timeout: 30_000 })
  }

  async runHappyPath(data: typeof DEMO_APPEAL) {
    await this.goto()
    await this.page.waitForSelector("form", { timeout: 10_000 })
    await this.fillDenialForm(data)
    await this.submitForm()
    await this.assertAppealLetterGenerated()
  }
}
