/**
 * Social worker role demo video.
 *
 * Run with:
 *   pnpm demo:social-worker
 */

import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

const AUTH_FILE = path.join(__dirname, "../.auth/social-worker.json")

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

test.describe.serial("Demo video - social worker", () => {
  test("social worker feature introduction", async ({ page }) => {
    test.skip(!hasAuth(AUTH_FILE), "No social worker auth session. Run demo setup or provide E2E_SOCIAL_WORKER_EMAIL/E2E_SOCIAL_WORKER_PASSWORD.")
    test.setTimeout(90_000)

    await page.goto("/social-worker/dashboard")
    await expect(page.getByText(/dashboard|assigned patients|active patients|pending approval/i).first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(3000)

    await page.goto("/social-worker/patients")
    await expect(page.getByText(/patients|search|applications|message/i).first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(3000)
    await page.evaluate(() => window.scrollTo({ top: 280, behavior: "smooth" }))
    await page.waitForTimeout(2000)

    await page.goto("/social-worker/sessions")
    await expect(page.getByText(/sessions|screen-share|chat|new session/i).first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(3000)

    const newSession = page.getByRole("button", { name: /new session/i })
    if (await newSession.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await newSession.click()
      await page.waitForTimeout(2500)
      await page.keyboard.press("Escape")
    }

    await page.goto("/social-worker/messages")
    await expect(page.getByText(/messages|requests|threads|pending/i).first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(3000)
  })
})
