/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { test, expect } from "@playwright/test"
import * as path from "path"
import { hasSupabaseAuthState } from "../../auth-state"

const AUTH_FILE = path.join(__dirname, "../../.auth/user.json")
test.use({ storageState: AUTH_FILE })

test.describe("FamilyProfileWizard — mobile layout", () => {
  test.beforeEach(() => {
    test.skip(!hasSupabaseAuthState(AUTH_FILE), "No auth session — create a test user in the Supabase dashboard to run these tests")
  })

  test("income fields stack to a single column on a phone viewport", async ({ page }) => {
    await page.goto("/benefit-stack")
    await page.waitForSelector("#dob-applicant", { timeout: 15_000 })

    // Step tabs use a roving tabindex but are always clickable — jump straight
    // to the Income step rather than filling out prior steps.
    await page.getByRole("tab", { name: /income/i }).click()

    const wages = page.getByText("Wages / Salary", { exact: true }).first()
    const selfEmployment = page.getByText("Self-employment", { exact: true }).first()
    await expect(wages).toBeVisible({ timeout: 10_000 })
    await expect(selfEmployment).toBeVisible()

    const wagesBox = await wages.boundingBox()
    const selfEmploymentBox = await selfEmployment.boundingBox()
    expect(wagesBox).toBeTruthy()
    expect(selfEmploymentBox).toBeTruthy()

    // Stacked (grid-cols-1): second field sits below the first, same left edge.
    // A regression back to a hard grid-cols-2 would put it beside the first
    // field instead (same y, offset x).
    expect(selfEmploymentBox!.y).toBeGreaterThan(wagesBox!.y + wagesBox!.height)
    expect(Math.abs(selfEmploymentBox!.x - wagesBox!.x)).toBeLessThan(10)
  })

  test("no horizontal overflow across wizard steps", async ({ page }) => {
    await page.goto("/benefit-stack")
    await page.waitForSelector("#dob-applicant", { timeout: 15_000 })

    const tabs = await page.getByRole("tab").all()
    for (const tab of tabs) {
      await tab.click()
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      expect(hasOverflow).toBe(false)
    }
  })
})
