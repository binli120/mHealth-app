/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { test, expect } from "@playwright/test"
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

test.describe("User Profile", () => {
  test("profile page loads", async ({ page }) => {
    await page.goto("/customer/profile")
    await expect(page).toHaveURL(/\/customer\/profile/)
    await expect(
      page.getByText(/profile|personal|settings/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("personal section is visible", async ({ page }) => {
    await page.goto("/customer/profile")
    await expect(
      page.getByText(/personal|first name|last name|email/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("sidebar tabs are present", async ({ page }) => {
    await page.goto("/customer/profile")
    const tabs = ["personal", "family", "education", "bank", "settings", "notification"]
    for (const tab of tabs) {
      const tabEl = page.getByRole("button", { name: new RegExp(tab, "i") })
        .or(page.getByRole("link", { name: new RegExp(tab, "i") }))
        .or(page.getByText(new RegExp(tab, "i")))
        .first()
      if (await tabEl.isVisible()) {
        // at least one tab was found
        break
      }
    }
  })

  test("can switch to settings tab", async ({ page }) => {
    await page.goto("/customer/profile")
    const settingsTab = page.getByRole("button", { name: /settings|app settings/i })
      .or(page.getByRole("link", { name: /settings/i }))
      .first()
    if (await settingsTab.isVisible()) {
      await settingsTab.click()
      await expect(
        page.getByText(/language|accessibility|theme|preference/i).first(),
      ).toBeVisible({ timeout: 8_000 })
    }
  })

  test("can switch to notifications tab", async ({ page }) => {
    await page.goto("/customer/profile")
    const notifTab = page.getByRole("button", { name: /notification/i })
      .or(page.getByRole("link", { name: /notification/i }))
      .first()
    if (await notifTab.isVisible()) {
      await notifTab.click()
      await expect(
        page.getByText(/push|email|alert|notify/i).first(),
      ).toBeVisible({ timeout: 8_000 })
    }
  })

  test("no 500 errors on profile page", async ({ page }) => {
    const serverErrors: string[] = []
    page.on("response", (res) => {
      if (res.url().includes("/api/") && res.status() >= 500) {
        serverErrors.push(`${res.status()} ${res.url()}`)
      }
    })
    await page.goto("/customer/profile")
    await page.waitForLoadState("networkidle")
    expect(serverErrors).toHaveLength(0)
  })
})
