/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { Page, expect } from "@playwright/test"
import type { DEMO_APPEAL } from "../fixtures/demo-data"

export class AppealPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/appeal-assistant")
  }

  async fillDenialForm(data: typeof DEMO_APPEAL) {
    // The denial reason uses a Radix UI <Select> (not a native <select>).
    // selectOption() won't work — must click the trigger to open the portal,
    // then click the desired option.
    const reasonTrigger = this.page.locator('[id="denial-reason"]')
    if (await reasonTrigger.isVisible()) {
      await reasonTrigger.click()
      await this.page.waitForTimeout(400)
      // Prefer the option whose text contains the denial_reason value; fall back to first
      const preferredOption = this.page.getByRole("option", {
        name: new RegExp(data.denial_reason, "i"),
      })
      const firstOption = this.page.getByRole("option").first()
      if (await preferredOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await preferredOption.click()
      } else if (await firstOption.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await firstOption.click()
      }
      await this.page.waitForTimeout(300)
    }

    // Additional details textarea (optional field — id="denial-details")
    const textarea = this.page.locator("#denial-details")
    if (await textarea.isVisible()) {
      await textarea.fill(data.context.slice(0, 500))
    }
  }

  async submitForm() {
    const submitBtn = this.page.getByRole("button", { name: /submit|analyze|generate|get.*appeal/i })
    await submitBtn.waitFor({ state: "visible", timeout: 8_000 })
    // Only click if enabled — button requires a denial reason to be selected
    if (await submitBtn.isEnabled()) {
      await submitBtn.click()
    }
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
