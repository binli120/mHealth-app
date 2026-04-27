/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { test, expect, type Page } from "@playwright/test"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"

const AUTH_FILE = path.join(__dirname, "../.auth/user.json")
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const IS_REMOTE =
  !BASE_URL.startsWith("http://localhost") &&
  !BASE_URL.startsWith("http://127.0.0.1")

test.use({ storageState: AUTH_FILE })

async function configureShortIdleWindow(page: Page, idleMs: number, warningMs: number) {
  await page.addInitScript(
    ([idleTimeoutMs, idleWarningMs]) => {
      const testWindow = window as typeof window & {
        __HEALTHCOMPASS_IDLE_TIMEOUT_MS__?: number
        __HEALTHCOMPASS_IDLE_WARNING_MS__?: number
      }
      testWindow.__HEALTHCOMPASS_IDLE_TIMEOUT_MS__ = idleTimeoutMs
      testWindow.__HEALTHCOMPASS_IDLE_WARNING_MS__ = idleWarningMs
    },
    [idleMs, warningMs],
  )
}

test.describe("Session Idle Timeout", () => {
  test.skip(IS_REMOTE, "Idle timeout E2E uses development-only browser timing overrides.")

  test.beforeEach(() => {
    test.skip(!hasSupabaseAuthState(AUTH_FILE), "No auth session — create a test user in the Supabase dashboard to run these tests")
  })

  test("authenticated routes show a session-expiring warning after inactivity", async ({ page }) => {
    await configureShortIdleWindow(page, 2_500, 1_000)

    await page.goto("/customer/profile")
    await expect(page).toHaveURL(/\/customer\/profile/)

    await expect(page.getByText(/session expiring soon/i)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole("button", { name: /stay signed in/i })).toBeVisible()
  })

  test("Stay Signed In dismisses the warning and keeps the protected route open", async ({ page }) => {
    await configureShortIdleWindow(page, 3_000, 1_200)

    await page.goto("/customer/profile")
    await expect(page).toHaveURL(/\/customer\/profile/)

    await expect(page.getByText(/session expiring soon/i)).toBeVisible({ timeout: 5_000 })
    await page.getByRole("button", { name: /stay signed in/i }).click()

    await expect(page.getByText(/session expiring soon/i)).not.toBeVisible()
    await expect(page).toHaveURL(/\/customer\/profile/)
  })

  test("idle timeout signs out and protects subsequent authenticated navigation", async ({ page }) => {
    await configureShortIdleWindow(page, 2_000, 800)

    await page.goto("/customer/profile")
    await expect(page).toHaveURL(/\/customer\/profile/)

    await expect(page.getByText(/session expiring soon/i)).toBeVisible({ timeout: 5_000 })
    await expect(page).toHaveURL(/\/$/, { timeout: 6_000 })

    await page.goto("/customer/status")
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fcustomer%2Fdashboard/, {
      timeout: 10_000,
    })
  })
})
