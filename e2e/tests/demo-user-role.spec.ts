/**
 * Applicant role demo video.
 *
 * Run with:
 *   pnpm demo:user
 */

import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

const AUTH_FILE = path.join(__dirname, "../.auth/user.json")

function hasAuth(filePath: string) {
  try {
    const state = JSON.parse(fs.readFileSync(filePath, "utf8"))
    return state.origins?.some((origin: { localStorage?: { name: string }[] }) =>
      origin.localStorage?.some((item: { name: string }) =>
        item.name.startsWith("sb-") && item.name.endsWith("-auth-token"),
      ),
    ) ?? false
  } catch {
    return false
  }
}

test.use({ storageState: AUTH_FILE })

test.describe.serial("Demo video - applicant", () => {
  test("applicant feature introduction", async ({ page }) => {
    test.skip(!hasAuth(AUTH_FILE), "No applicant auth session. Run demo setup or provide E2E_DEMO_EMAIL/E2E_DEMO_PASSWORD.")
    test.setTimeout(120_000)

    await page.goto("/customer/dashboard")
    await expect(page.getByText(/dashboard|application|benefit/i).first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2500)
    await page.evaluate(() => window.scrollTo({ top: 420, behavior: "smooth" }))
    await page.waitForTimeout(2500)

    await page.goto("/prescreener")
    await expect(page.getByText(/prescreen|masshealth|eligib/i).first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2500)

    await page.goto("/benefit-stack")
    await expect(page.getByText(/benefit|program|family|household/i).first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2500)

    const ageInput = page.locator("#age")
    if (await ageInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await ageInput.fill("35")
      await page.waitForTimeout(800)
      for (let i = 0; i < 5; i += 1) {
        const nextButton = page.getByRole("button", { name: /^next$/i })
        if (!(await nextButton.isVisible({ timeout: 1500 }).catch(() => false))) break
        await nextButton.click()
        await page.waitForTimeout(900)
      }
    }

    await page.goto("/application/type")
    await expect(page.getByText(/application|renewal|new/i).first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2500)

    await page.goto("/customer/status")
    await expect(page.getByText(/status|application|case/i).first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2500)

    await page.goto("/appeal-assistant")
    await expect(page.getByText(/appeal|denial|masshealth/i).first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2500)

    await page.goto("/customer/profile")
    await expect(page.getByText(/profile|personal|settings/i).first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2500)
  })
})
