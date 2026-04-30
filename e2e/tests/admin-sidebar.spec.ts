/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { expect, test } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

const AUTH_FILE = path.join(__dirname, "../.auth/admin.json")

function hasAuth(filePath: string) {
  try {
    const state = JSON.parse(fs.readFileSync(filePath, "utf8"))
    return state.origins?.some((origin: { localStorage?: { name: string }[] }) =>
      origin.localStorage?.some((item: { name: string }) =>
        item.name.startsWith("sb-") && item.name.endsWith("-auth-token"),
      ),
    ) ?? false
  } catch {
    return false
  }
}

test.use({ storageState: AUTH_FILE })

test.describe("Admin sidebar", () => {
  test("extends full viewport height and can be hidden and restored on desktop", async ({ page }) => {
    test.skip(!hasAuth(AUTH_FILE), "No admin auth session. Run Playwright setup or provide E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.")

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto("/admin", { waitUntil: "domcontentloaded", timeout: 15_000 })

    const sidebar = page.getByRole("complementary", { name: /admin sidebar/i })
    await expect(sidebar).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole("button", { name: /hide admin sidebar/i })).toBeVisible()

    const sidebarBox = await sidebar.boundingBox()
    expect(sidebarBox?.height).toBeGreaterThanOrEqual(700)

    await page.getByRole("button", { name: /hide admin sidebar/i }).click()
    await expect(sidebar).toBeHidden()

    const openButton = page.getByRole("button", { name: /open admin menu/i })
    await expect(openButton).toBeVisible()
    await openButton.click()

    await expect(sidebar).toBeVisible()
    await expect(page.getByRole("button", { name: /hide admin sidebar/i })).toBeVisible()
  })
})
