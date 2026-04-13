/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { test, expect } from "@playwright/test"

test.describe("Landing Page", () => {
  test("loads and shows hero content", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/masshealth|benefitpath|health/i)
    // Hero section visible
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("navigation links are present", async ({ page }) => {
    await page.goto("/")
    // Use .first() — the landing page intentionally has two "Sign In" links
    // (one in the nav bar, one in the hero CTA area).
    await expect(page.getByRole("link", { name: /sign in|login/i }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: /get started|create account|register/i }).first()).toBeVisible()
  })

  test("'Get Started' navigates to registration", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: /get started|create account|register/i }).first().click()
    await expect(page).toHaveURL(/\/auth\/register/)
  })

  test("'Sign In' navigates to login", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: /sign in|login/i }).first().click()
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test("knowledge center link works", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: /resource|knowledge/i }).first().click()
    await expect(page).toHaveURL(/\/knowledge-center/)
  })

  test("appeal assistant link works from landing", async ({ page }) => {
    await page.goto("/")
    const appealLink = page.getByRole("link", { name: /appeal/i }).first()
    if (!(await appealLink.isVisible())) {
      test.skip()
      return
    }
    await appealLink.click()
    // The landing page may use an anchor (#appeal) or navigate to /appeal-assistant
    await expect(page).toHaveURL(/\/appeal-assistant|#appeal/, { timeout: 5_000 })
  })

  test("no console errors on load", async ({ page }) => {
    const consoleErrors: string[] = []
    const failedRequests: string[] = []

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text())
    })
    // Capture 404s with their URL so failures are actionable in CI logs
    page.on("response", (response) => {
      if (response.status() === 404) {
        failedRequests.push(`404 → ${response.url()}`)
      }
    })

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const allErrors = [
      ...consoleErrors.filter((e) => !e.includes("Warning:")),
      ...failedRequests,
    ]
    expect(allErrors).toHaveLength(0)
  })
})
