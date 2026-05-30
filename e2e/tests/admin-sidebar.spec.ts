/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { expect, test } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

const AUTH_FILE = path.join(__dirname, "../.auth/admin.json")

// requireAdmin bypasses MFA only when isLocalAuthHelperEnabled() is true,
// which requires a non-cloud Supabase URL.  With cloud Supabase, an E2E session
// is always aal1 (password only) and cannot complete TOTP in automation.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const IS_CLOUD_SUPABASE =
  Boolean(SUPABASE_URL) &&
  !SUPABASE_URL.includes("localhost") &&
  !SUPABASE_URL.includes("127.0.0.1")

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

async function waitForAdminShellOrAuthGate(page: import("@playwright/test").Page) {
  const sidebar = page.getByRole("complementary", { name: /admin sidebar/i })
  const notAdminHeading = page.getByRole("heading", { name: /admin role required/i })

  const outcome = await Promise.race([
    sidebar.waitFor({ state: "visible", timeout: 20_000 })
      .then(() => "ready" as const)
      .catch(() => "timeout" as const),
    notAdminHeading.waitFor({ state: "visible", timeout: 20_000 })
      .then(() => "not-admin" as const)
      .catch(() => "timeout" as const),
    page.waitForURL(
      (url) => !url.pathname.startsWith("/admin"),
      { timeout: 20_000 },
    ).then(() => "redirected" as const).catch(() => "timeout" as const),
    page.waitForTimeout(20_000).then(() => "timeout" as const),
  ])

  if (outcome === "redirected") {
    test.skip(true, `Admin requires additional auth on this instance — redirected to ${page.url()}`)
  }
  if (outcome === "not-admin") {
    test.skip(true, "Current E2E admin account is authenticated but does not have the admin role.")
  }

  return sidebar
}

test.use({ storageState: AUTH_FILE })

test.describe("Admin sidebar", () => {
  test("extends full viewport height and can be hidden and restored on desktop", async ({ page }) => {
    test.skip(
      !hasAuth(AUTH_FILE),
      "No admin auth session. Run Playwright setup or provide E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.",
    )
    test.skip(
      IS_CLOUD_SUPABASE,
      "Cloud Supabase detected: admin gate requires MFA (aal2) which cannot be completed in automation. Run against a local Supabase instance.",
    )

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto("/admin", { waitUntil: "domcontentloaded", timeout: 15_000 })

    // The admin gate resolves client-side after domcontentloaded. Wait for the
    // shell, a known auth redirect, or the not-admin fallback before asserting.
    const sidebar = await waitForAdminShellOrAuthGate(page)
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
