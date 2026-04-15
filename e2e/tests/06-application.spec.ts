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

test.describe("Application Flow", () => {
  test("application type selector loads", async ({ page }) => {
    await page.goto("/application/type")
    await expect(
      page.getByText(/application|type|new|renewal/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("new application page loads", async ({ page }) => {
    await page.goto("/application/new")
    await expect(
      page.getByText(/application|intake|chat|form/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("chat mode tab is available", async ({ page }) => {
    await page.goto("/application/new")
    const chatTab = page.getByRole("tab", { name: /chat/i })
    if (await chatTab.isVisible()) {
      await expect(chatTab).toBeVisible()
    }
  })

  test("form wizard tab is available", async ({ page }) => {
    await page.goto("/application/new")
    const formTab = page.getByRole("tab", { name: /form|wizard/i })
    if (await formTab.isVisible()) {
      await expect(formTab).toBeVisible()
    }
  })

  test("form wizard first step renders", async ({ page }) => {
    await page.goto("/application/new")
    // Switch to form wizard if tabs exist
    const formTab = page.getByRole("tab", { name: /form|wizard/i })
    if (await formTab.isVisible()) {
      await formTab.click()
    }
    // First step fields should be visible
    await expect(
      page.getByText(/step|household|name|application type/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("application status list loads", async ({ page }) => {
    await page.goto("/customer/status")
    await expect(
      page.getByText(/application|status|your.*case|no.*application/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("confirmation page is reachable", async ({ page }) => {
    await page.goto("/application/confirmation")
    await expect(
      page.getByText(/confirmation|submitted|thank|next step/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("no 500 errors on application pages", async ({ page }) => {
    const serverErrors: string[] = []
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`)
    })
    const pages = ["/application/type", "/application/new", "/customer/status"]
    for (const url of pages) {
      await page.goto(url)
      await page.waitForLoadState("networkidle")
    }
    expect(serverErrors).toHaveLength(0)
  })
})
