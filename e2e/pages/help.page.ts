/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { Page, expect } from '@playwright/test'

export class HelpPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/help')
  }

  async gotoQuestion(id: string) {
    await this.page.goto(`/help/${id}`)
  }

  async assertPageLoaded() {
    await expect(this.page).toHaveURL(/\/help/)
    await expect(this.page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 })
  }

  async assertQuestionsVisible() {
    // QuestionCard renders as <Link href="/help/{id}"><Card>...</Card></Link>
    await expect(
      this.page.locator('a[href^="/help/"]').first()
    ).toBeVisible({ timeout: 15_000 })
  }

  async searchFor(query: string) {
    const input = this.page.getByPlaceholder(/search/i)
    await input.waitFor({ state: 'visible', timeout: 8_000 })
    await input.fill(query)
    await this.page.waitForTimeout(600)
  }

  async clickCategory(label: string | RegExp) {
    const pill = this.page.getByRole('button', { name: label })
    await pill.waitFor({ state: 'visible', timeout: 8_000 })
    await pill.click()
    await this.page.waitForTimeout(400)
  }

  async openAskDialog() {
    const btn = this.page.getByRole('button', { name: /ask|new question/i })
    await btn.waitFor({ state: 'visible', timeout: 8_000 })
    await btn.click()
    await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
  }

  async fillQuestion(title: string, body?: string) {
    await this.page.getByRole('textbox', { name: /question/i }).fill(title)
    if (body) {
      await this.page.getByRole('textbox', { name: /details/i }).fill(body)
    }
  }

  async submitQuestion() {
    const submit = this.page.getByRole('button', { name: /submit|post/i })
    await submit.click()
  }

  async clickFirstQuestion() {
    // QuestionCard renders as <a href="/help/{uuid}">
    const firstLink = this.page.locator('a[href^="/help/"]').first()
    await firstLink.waitFor({ state: 'visible', timeout: 15_000 })
    await firstLink.click()
    await expect(this.page).toHaveURL(/\/help\/.+/, { timeout: 10_000 })
  }

  async assertAnswersSection() {
    await expect(
      this.page.getByText(/answer|reply/i).first()
    ).toBeVisible({ timeout: 15_000 })
  }

  async submitAnswer(text: string) {
    const textarea = this.page.getByPlaceholder(/answer|reply/i)
    await textarea.waitFor({ state: 'visible', timeout: 8_000 })
    await textarea.fill(text)
    await this.page.getByRole('button', { name: /post answer|submit/i }).click()
  }
}
