/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { test, expect } from "@playwright/test"
import { DashboardPage } from "../pages/dashboard.page"
import { InsuranceHistoryPage } from "../pages/insurance-history.page"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"

test.use({ storageState: path.join(__dirname, "../.auth/user.json") })

const AUTH_FILE = path.join(__dirname, "../.auth/user.json")

test.describe("Insurance History", () => {
  test.beforeEach(async () => {
    test.skip(!hasSupabaseAuthState(AUTH_FILE), "No auth session — create a test user to run these tests")
  })

  test("dashboard shows insurance history card with link", async ({ page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()
    await dashboard.assertLoaded()
    await expect(page.getByText(/insurance history/i).first()).toBeVisible({ timeout: 10_000 })
    const link = page.getByRole("link", { name: /view full history/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute("href", "/customer/insurance-history")
  })

  test("insurance history page loads", async ({ page }) => {
    const historyPage = new InsuranceHistoryPage(page)
    await historyPage.goto()
    await historyPage.assertLoaded()
  })

  test("add self-reported coverage record end-to-end", async ({ page }) => {
    const historyPage = new InsuranceHistoryPage(page)
    await historyPage.goto()
    await historyPage.assertLoaded()

    await historyPage.clickAddPastCoverage()
    await historyPage.assertDrawerOpen()

    const testYear = 2020
    await historyPage.fillCoverageForm({
      year: testYear,
      planName: "Test Plan E2E",
      premium: 150,
    })
    await historyPage.submitForm()

    await historyPage.assertEntryVisible(testYear, "Test Plan E2E")
  })

  test("timeline renders records in descending year order", async ({ page }) => {
    const historyPage = new InsuranceHistoryPage(page)
    await historyPage.goto()
    await historyPage.assertLoaded()

    const yearBubbles = await page
      .locator("[class*='rounded-full']")
      .allTextContents()
    const years = yearBubbles
      .map((t) => parseInt(t.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 1990)
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i]).toBeGreaterThanOrEqual(years[i + 1])
    }
  })

  test("add coverage form blocks duplicate year", async ({ page }) => {
    const historyPage = new InsuranceHistoryPage(page)
    await historyPage.goto()
    await historyPage.assertLoaded()

    await historyPage.clickAddPastCoverage()
    await historyPage.assertDrawerOpen()
    await historyPage.fillCoverageForm({ year: 2019, planName: "Unique Plan 2019" })
    await historyPage.submitForm()

    await historyPage.clickAddPastCoverage()
    await historyPage.assertDrawerOpen()
    await historyPage.fillCoverageForm({ year: 2019, planName: "Another Plan 2019" })
    await historyPage.submitForm()
    await historyPage.assertDuplicateYearError(2019)
  })
})
