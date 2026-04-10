/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { test, expect } from "@playwright/test"
import { BenefitStackPage } from "../pages/benefit-stack.page"
import * as path from "path"
import * as fs from "fs"

test.use({ storageState: path.join(__dirname, "../.auth/user.json") })

const _hasAuth = (() => {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/user.json"), "utf8"))
    // Supabase uses localStorage (not cookies) for JWT storage
    return s.origins?.some((o: { localStorage?: { name: string }[] }) =>
      o.localStorage?.some((item: { name: string }) =>
        item.name.startsWith("sb-") && item.name.endsWith("-auth-token")
      )
    ) ?? false
  } catch { return false }
})()
test.skip(!_hasAuth, "No auth session — create a test user in the Supabase dashboard to run these tests")

test.describe("Benefit Stack (Cross-Program Orchestration)", () => {
  let benefitStack: BenefitStackPage

  test.beforeEach(({ page }) => {
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
