/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { test, expect } from "@playwright/test"
import * as path from "path"
import { hasSupabaseAuthState } from "../../auth-state"
import { DashboardPage } from "../../pages/dashboard.page"

test.describe("Mobile navigation — homepage", () => {
  test("hamburger menu opens, lists links, and navigates", async ({ page }) => {
    await page.goto("/")

    const menuButton = page.getByRole("button", { name: /open menu/i })
    await expect(menuButton).toBeVisible()
    await menuButton.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // href-based selector — stable across the app's 6 supported languages,
    // unlike matching on translated link text.
    const prescreenerLink = dialog.locator('a[href="/prescreener"]')
    await expect(prescreenerLink).toBeVisible()
    await prescreenerLink.click()

    await expect(page).toHaveURL(/\/prescreener/)
    await expect(dialog).toBeHidden()
  })

  test("no horizontal overflow on load", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("load")

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(hasOverflow).toBe(false)
  })
})

test.describe("Mobile navigation — dashboard", () => {
  const AUTH_FILE = path.join(__dirname, "../../.auth/user.json")
  test.use({ storageState: AUTH_FILE })

  test.beforeEach(() => {
    test.skip(!hasSupabaseAuthState(AUTH_FILE), "No auth session — create a test user in the Supabase dashboard to run these tests")
  })

  test("hamburger menu opens and navigates to Benefit Stack", async ({ page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()
    await expect(page).toHaveURL(/\/customer\/dashboard/)

    // Desktop nav links (e.g. "Dashboard") are `hidden md:flex` on mobile —
    // the hamburger button is the reliable "page is ready" signal here,
    // not DashboardPage.assertLoaded() which matches hidden desktop text.
    const menuButton = page.getByRole("button", { name: /open menu/i })
    await expect(menuButton).toBeVisible({ timeout: 15_000 })
    await menuButton.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    const benefitStackLink = dialog.locator('a[href="/benefit-stack"]')
    await expect(benefitStackLink).toBeVisible()
    await benefitStackLink.click()

    await expect(page).toHaveURL(/\/benefit-stack/)
    await expect(dialog).toBeHidden()
  })
})
