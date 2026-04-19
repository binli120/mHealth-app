/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { test, expect } from "@playwright/test"
import { DashboardPage } from "../pages/dashboard.page"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"

// Use saved auth state so we skip login
test.use({ storageState: path.join(__dirname, "../.auth/user.json") })

// Skip this entire file when there is no valid Supabase auth session.
// Supabase stores the JWT in localStorage (not cookies), so we check for the
// sb-*-auth-token key.  Create the demo user in the Supabase dashboard and
// run the suite once to populate user.json.
const AUTH_FILE = path.join(__dirname, "../.auth/user.json")

test.describe("Customer Dashboard", () => {
  let dashboard: DashboardPage

  test.beforeEach(({ page }) => {
    test.skip(!hasSupabaseAuthState(AUTH_FILE), "No auth session — create a test user in the Supabase dashboard to run these tests")
    dashboard = new DashboardPage(page)
  })

  test("dashboard loads after login", async () => {
    await dashboard.goto()
    await dashboard.assertLoaded()
  })

  test("shows applications section or card", async ({ page }) => {
    await dashboard.goto()
    await expect(
      page.getByText(/application|apply|your.*case/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("shows benefit stack or quick actions", async ({ page }) => {
    await dashboard.goto()
    await expect(
      page.getByText(/benefit|stack|program|check/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("navigation to Benefit Stack works", async ({ page }) => {
    await dashboard.goto()
    await dashboard.assertLoaded()
    const benefitLink = page.getByRole("link", { name: /benefit stack|check benefits/i }).first()
    if (await benefitLink.isVisible()) {
      await benefitLink.click()
      await expect(page).toHaveURL(/\/benefit-stack/, { timeout: 10_000 })
    } else {
      // Try the nav header
      await page.getByRole("navigation").getByRole("link", { name: /benefit/i }).click()
      await expect(page).toHaveURL(/\/benefit-stack/, { timeout: 10_000 })
    }
  })

  test("navigation to profile works", async ({ page }) => {
    await dashboard.goto()
    await dashboard.assertLoaded()
    const profileLink = page.getByRole("link", { name: /profile|my profile/i }).first()
    if (await profileLink.isVisible()) {
      await profileLink.click()
      await expect(page).toHaveURL(/\/customer\/profile/, { timeout: 10_000 })
    }
  })

  test("navigation to application status works", async ({ page }) => {
    await dashboard.goto()
    await dashboard.assertLoaded()
    const statusLink = page.getByRole("link", { name: /applications|status|my case/i }).first()
    if (await statusLink.isVisible()) {
      await statusLink.click()
      await expect(page).toHaveURL(/\/customer\/status/, { timeout: 10_000 })
    }
  })

  test("no page errors on dashboard load", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (err) => errors.push(err.message))
    await dashboard.goto()
    await dashboard.assertLoaded()
    expect(errors).toHaveLength(0)
  })
})
