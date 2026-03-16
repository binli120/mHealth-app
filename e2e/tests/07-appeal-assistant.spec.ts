import { test, expect } from "@playwright/test"
import { AppealPage } from "../pages/appeal.page"
import { DEMO_APPEAL } from "../fixtures/demo-data"
import * as path from "path"

test.use({ storageState: path.join(__dirname, "../.auth/user.json") })

// Ollama generates appeal letters locally — allow up to 90s for AI response
test.describe("Appeal Assistant", () => {
  test.setTimeout(90_000)
  let appealPage: AppealPage

  test.beforeEach(({ page }) => {
    appealPage = new AppealPage(page)
  })

  test("appeal assistant page loads", async ({ page }) => {
    await appealPage.goto()
    await expect(page).toHaveURL(/\/appeal-assistant/)
    await expect(
      page.getByText(/appeal|denial|masshealth|help/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("denial input form is visible", async ({ page }) => {
    await appealPage.goto()
    await expect(page.locator("form").first()).toBeVisible({ timeout: 10_000 })
  })

  test("denial reason selector is present", async ({ page }) => {
    await appealPage.goto()
    const select = page.getByLabel(/denial reason|reason/i)
    const textarea = page.locator("textarea, select, [role='combobox']").first()
    const isVisible = (await select.isVisible()) || (await textarea.isVisible())
    expect(isVisible).toBeTruthy()
  })

  test("submit button is present", async ({ page }) => {
    await appealPage.goto()
    await expect(
      page.getByRole("button", { name: /submit|analyze|generate|get.*appeal/i }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("happy path generates appeal content", async ({ page }) => {
    await appealPage.runHappyPath(DEMO_APPEAL)
    await appealPage.assertAppealLetterGenerated()
  })

  test("no API 500 errors during appeal generation", async ({ page }) => {
    const serverErrors: string[] = []
    page.on("response", (res) => {
      if (res.url().includes("/api/appeals") && res.status() >= 500) {
        serverErrors.push(`${res.status()} ${res.url()}`)
      }
    })
    await appealPage.goto()
    await appealPage.fillDenialForm(DEMO_APPEAL)
    await appealPage.submitForm()
    // Wait for response
    await page.waitForTimeout(5_000)
    expect(serverErrors).toHaveLength(0)
  })
})
