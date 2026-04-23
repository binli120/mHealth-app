/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { test, expect, type Page } from "@playwright/test"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"

test.use({ storageState: path.join(__dirname, "../.auth/user.json") })
const AUTH_FILE = path.join(__dirname, "../.auth/user.json")

async function gotoProfile(page: Page) {
  await page.goto("/customer/profile")
  await expect(page).toHaveURL(/\/customer\/profile/)
  await expect(page.getByRole("navigation", { name: /profile sections/i })).toBeVisible({ timeout: 15_000 })
}

function sectionCard(page: Page, title: RegExp) {
  return page.locator('[data-slot="card"]').filter({
    has: page.locator('[data-slot="card-title"]').filter({ hasText: title }),
  }).first()
}

test.describe("User Profile", () => {
  test.beforeEach(() => {
    test.skip(!hasSupabaseAuthState(AUTH_FILE), "No auth session — create a test user in the Supabase dashboard to run these tests")
  })

  test("profile page loads", async ({ page }) => {
    await gotoProfile(page)
    await expect(
      page.getByText(/profile|personal|settings/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("personal section is visible", async ({ page }) => {
    await gotoProfile(page)
    await expect(
      page.getByText(/personal|first name|last name|email/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("sidebar tabs are present", async ({ page }) => {
    await gotoProfile(page)
    const nav = page.getByRole("navigation", { name: /profile sections/i })
    const tabs = ["personal", "family & income", "education", "bank", "settings", "notifications"]
    for (const tab of tabs) {
      const tabEl = nav.getByRole("button", { name: new RegExp(tab, "i") }).first()
      await expect(tabEl).toBeVisible({ timeout: 8_000 })
    }
  })

  test("all profile sections are reachable", async ({ page }) => {
    await gotoProfile(page)
    const nav = page.getByRole("navigation", { name: /profile sections/i })
    const sections = [
      { tab: /personal/i, title: /personal information/i },
      { tab: /family & income/i, title: /family & income/i },
      { tab: /education/i, title: /^education$/i },
      { tab: /bank/i, title: /bank account/i },
      { tab: /settings/i, title: /app settings/i },
      { tab: /notifications/i, title: /notifications/i },
    ]

    for (const section of sections) {
      await nav.getByRole("button", { name: section.tab }).click()
      await expect(sectionCard(page, section.title)).toBeVisible({ timeout: 8_000 })
    }
  })

  test("notification preferences can be edited and saved", async ({ page }) => {
    // Mock the profile PUT so the save always succeeds in all environments
    await page.route("**/api/user-profile", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) })
      } else {
        await route.continue()
      }
    })

    await gotoProfile(page)
    const nav = page.getByRole("navigation", { name: /profile sections/i })
    await nav.getByRole("button", { name: /notifications/i }).click()
    const notificationsCard = sectionCard(page, /notifications/i)
    await expect(notificationsCard).toBeVisible({ timeout: 8_000 })

    // Enter edit mode, then read the switch state (more reliable than parsing view-mode text)
    await notificationsCard.getByRole("button", { name: /^edit$/i }).click()
    const deadlineSwitch = notificationsCard.getByRole("switch", { name: /enable deadline reminders/i })
    await expect(deadlineSwitch).toBeVisible({ timeout: 5_000 })
    const wasChecked = await deadlineSwitch.isChecked()

    // Toggle it and verify the switch state flipped in edit mode
    await deadlineSwitch.click()
    await expect(deadlineSwitch).toBeChecked({ checked: !wasChecked })

    // Save (mocked to succeed) — card returns to view mode
    await notificationsCard.getByRole("button", { name: /save changes/i }).click()

    // Verify view mode now shows the toggled state for deadline reminders
    const expectedLabel = wasChecked ? "Disabled" : "Enabled"
    await expect(
      notificationsCard.getByText(new RegExp(expectedLabel, "i")).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("no 500 errors on profile page", async ({ page }) => {
    const serverErrors: string[] = []
    page.on("response", (res) => {
      if (res.url().includes("/api/") && res.status() >= 500) {
        serverErrors.push(`${res.status()} ${res.url()}`)
      }
    })
    await gotoProfile(page)
    await page.waitForLoadState("load")
    expect(serverErrors).toHaveLength(0)
  })
})

test.describe("Notifications", () => {
  // Notifications are surfaced via the profile page tab, not a standalone /customer/notifications route.
  test.beforeEach(() => {
    test.skip(!hasSupabaseAuthState(AUTH_FILE), "No auth session — create a test user in the Supabase dashboard to run these tests")
  })

  test("notifications tab on profile page is reachable and shows preference options", async ({ page }) => {
    await gotoProfile(page)
    await page.getByRole("navigation", { name: /profile sections/i }).getByRole("button", { name: /notifications/i }).click()
    await expect(
      page.getByText(/push|email|alert|notify|preference|notification channel/i).first(),
    ).toBeVisible({ timeout: 8_000 })
  })

  test("profile page notification bell or indicator is visible when authenticated", async ({ page }) => {
    await page.goto("/customer/dashboard")
    // A notification bell or badge in the nav is the primary entry point
    const bellOrBadge = page
      .getByRole("button", { name: /notification/i })
      .or(page.locator('[aria-label*="notification"], [data-testid*="notification"]'))
      .first()

    await expect(bellOrBadge).toBeVisible({ timeout: 5_000 })
    await bellOrBadge.click()
    await expect(
      page.getByText(/notification|no new|all caught up|inbox/i).first(),
    ).toBeVisible({ timeout: 8_000 })
  })
})
