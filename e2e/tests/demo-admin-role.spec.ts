/**
 * Admin role demo video.
 *
 * Run with:
 *   pnpm demo:admin
 */

import { test, expect } from "@playwright/test"
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

test.describe.serial("Demo video - admin", () => {
  test("admin feature introduction", async ({ page }) => {
    test.skip(!hasAuth(AUTH_FILE), "No admin auth session. Run demo setup or provide E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.")
    test.setTimeout(90_000)

    await page.goto("/admin")
    await expect(page.getByText(/dashboard|system overview|quick actions/i).first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(3000)

    await page.goto("/admin/users")
    await expect(page.getByText(/users|roles|invite|applicant|social worker/i).first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(3000)
    const roleFilter = page.getByText(/all roles/i).first()
    if (await roleFilter.isVisible({ timeout: 1500 }).catch(() => false)) {
      await page.waitForTimeout(1000)
    }

    await page.goto("/admin/companies")
    await expect(page.getByText(/companies|nppes|approval|pending/i).first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(3000)

    const addCompany = page.getByRole("button", { name: /add|company|nppes/i }).first()
    if (await addCompany.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await addCompany.click()
      await page.waitForTimeout(2000)
    }

    await page.goto("/admin/social-workers")
    await expect(page.getByText(/social workers|approve|pending|invite/i).first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(3000)
  })
})
