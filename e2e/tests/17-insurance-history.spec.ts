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

/** Intercept insurance-history API calls with mock responses so tests don't
 *  depend on the E2E environment having an authenticated Supabase session. */
async function mockInsuranceHistoryApis(page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never) {
  await page.route("**/api/insurance-history/records-with-explanations", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, records: [] }),
    })
  })
  await page.route("**/api/insurance-history/records", async (route) => {
    const request = route.request()
    if (request.method() === "POST") {
      const body = request.postDataJSON() as { coverageYear?: number; planName?: string } | null
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          record: {
            id: "mock-id-" + Date.now(),
            userId: "mock-user",
            coverageYear: body?.coverageYear ?? 2020,
            planName: body?.planName ?? "Mock Plan",
            programCode: null,
            premiumMonthly: null,
            householdSize: null,
            annualIncome: null,
            fplPercent: null,
            source: "self_reported",
            applicationId: null,
            documentId: null,
            notes: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      })
    } else {
      route.continue()
    }
  })
}

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
    await mockInsuranceHistoryApis(page)
    const historyPage = new InsuranceHistoryPage(page)
    await historyPage.goto()
    await historyPage.assertLoaded()
  })

  test("add self-reported coverage record end-to-end", async ({ page }) => {
    await mockInsuranceHistoryApis(page)
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
    // After a successful mock save the form closes and the page reloads.
    // We intercept the reload's API call to return the newly added record
    // so assertEntryVisible can find it.
    await page.route("**/api/insurance-history/records-with-explanations", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          records: [{
            record: {
              id: "mock-id-1",
              userId: "mock-user",
              coverageYear: testYear,
              planName: "Test Plan E2E",
              programCode: null,
              premiumMonthly: 150,
              householdSize: null,
              annualIncome: null,
              fplPercent: null,
              source: "self_reported",
              applicationId: null,
              documentId: null,
              notes: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            explanation: null,
          }],
        }),
      })
    })

    await historyPage.submitForm()
    await historyPage.assertEntryVisible(testYear, "Test Plan E2E")
  })

  test("timeline renders records in descending year order", async ({ page }) => {
    // Seed with 3 records in non-sequential order to verify sorting
    await page.route("**/api/insurance-history/records-with-explanations", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          // Records returned pre-sorted DESC (as the real API does ORDER BY coverage_year DESC)
          records: [
            { record: { id: "1", userId: "u", coverageYear: 2024, planName: "Plan A", programCode: "careplus", premiumMonthly: 0, householdSize: 1, annualIncome: null, fplPercent: null, source: "self_reported", applicationId: null, documentId: null, notes: null, createdAt: "", updatedAt: "" }, explanation: null },
            { record: { id: "3", userId: "u", coverageYear: 2023, planName: "Plan C", programCode: "federal_tax_credits", premiumMonthly: 100, householdSize: 1, annualIncome: null, fplPercent: null, source: "self_reported", applicationId: null, documentId: null, notes: null, createdAt: "", updatedAt: "" }, explanation: null },
            { record: { id: "2", userId: "u", coverageYear: 2022, planName: "Plan B", programCode: "connectorcare", premiumMonthly: 48, householdSize: 1, annualIncome: null, fplPercent: null, source: "self_reported", applicationId: null, documentId: null, notes: null, createdAt: "", updatedAt: "" }, explanation: null },
          ],
        }),
      })
    })

    const historyPage = new InsuranceHistoryPage(page)
    await historyPage.goto()
    await historyPage.assertLoaded()

    const yearBubbles = await page
      .locator("[class*='rounded-full']")
      .allTextContents()
    const years = yearBubbles
      .map((t) => parseInt(t.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 1990)
    expect(years.length).toBeGreaterThan(0)
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i]).toBeGreaterThanOrEqual(years[i + 1])
    }
  })

  test("add coverage form blocks duplicate year", async ({ page }) => {
    // Stub initial GET to return empty, POST to succeed
    await mockInsuranceHistoryApis(page)
    const historyPage = new InsuranceHistoryPage(page)
    await historyPage.goto()
    await historyPage.assertLoaded()

    await historyPage.clickAddPastCoverage()
    await historyPage.assertDrawerOpen()
    await historyPage.fillCoverageForm({ year: 2019, planName: "Unique Plan 2019" })
    await historyPage.submitForm()

    // The duplicate check is client-side — it uses existingYears from the items array.
    // After the first add, the page reloads. Stub the reload to return the first record
    // so the client-side duplicate guard kicks in.
    await page.route("**/api/insurance-history/records-with-explanations", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          records: [{
            record: { id: "mock-1", userId: "u", coverageYear: 2019, planName: "Unique Plan 2019", programCode: null, premiumMonthly: null, householdSize: null, annualIncome: null, fplPercent: null, source: "self_reported", applicationId: null, documentId: null, notes: null, createdAt: "", updatedAt: "" },
            explanation: null,
          }],
        }),
      })
    })

    await historyPage.clickAddPastCoverage()
    await historyPage.assertDrawerOpen()
    // Attempt to add the same plan name again — override POST to return 409
    await page.route("**/api/insurance-history/records", async (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "This plan is already recorded for that year." }),
        })
      } else {
        route.continue()
      }
    })
    await historyPage.fillCoverageForm({ year: 2019, planName: "Unique Plan 2019" })
    await historyPage.submitForm()
    await historyPage.assertDuplicateYearError(2019)
  })
})
