/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { test, expect } from "@playwright/test"
import { BenefitStackPage } from "../pages/benefit-stack.page"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"

test.use({ storageState: path.join(__dirname, "../.auth/user.json") })
const AUTH_FILE = path.join(__dirname, "../.auth/user.json")

test.describe("Benefit Stack (Cross-Program Orchestration)", () => {
  let benefitStack: BenefitStackPage

  test.beforeEach(({ page }) => {
    test.skip(!hasSupabaseAuthState(AUTH_FILE), "No auth session — create a test user in the Supabase dashboard to run these tests")
    benefitStack = new BenefitStackPage(page)
  })

  test("benefit stack page loads", async ({ page }) => {
    await benefitStack.goto()
    await expect(page).toHaveURL(/\/benefit-stack/)
    await expect(
      page.getByText(/benefit|program|family|household/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("wizard form is visible", async ({ page }) => {
    await benefitStack.goto()
    // FamilyProfileWizard renders a div-based step wizard (no <form> tag).
    // Step 0 (About You) always renders the age input field.
    await expect(page.locator("#age")).toBeVisible({ timeout: 15_000 })
  })

  test("happy path returns benefit results", async ({ page }) => {
    await benefitStack.runHappyPath()
    await benefitStack.assertResultsVisible()
  })

  test("MassHealth program appears in results", async ({ page }) => {
    await benefitStack.runHappyPath()
    await expect(
      page.getByText(/masshealth/i).first(),
    ).toBeVisible({ timeout: 20_000 })
  })

  test("SNAP program appears in results", async ({ page }) => {
    await benefitStack.runHappyPath()
    await expect(
      page.getByText(/snap|food stamp|nutrition/i).first(),
    ).toBeVisible({ timeout: 20_000 })
  })

  test("results show estimated benefit amounts", async ({ page }) => {
    await benefitStack.runHappyPath()
    // Benefit amounts should show $ values or eligibility status
    await expect(
      page.getByText(/\$\d+|eligible|qualify|\/month/i).first(),
    ).toBeVisible({ timeout: 20_000 })
  })

  test("no API errors during evaluation", async ({ page }) => {
    const apiErrors: string[] = []
    page.on("response", (res) => {
      if (res.url().includes("/api/") && res.status() >= 500) {
        apiErrors.push(`${res.status()} ${res.url()}`)
      }
    })
    await benefitStack.runHappyPath()
    expect(apiErrors).toHaveLength(0)
  })
})
