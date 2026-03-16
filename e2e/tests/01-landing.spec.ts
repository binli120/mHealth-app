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
    await expect(page.getByRole("link", { name: /sign in|login/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /get started|create account|register/i })).toBeVisible()
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
    if (await appealLink.isVisible()) {
      await appealLink.click()
      await expect(page).toHaveURL(/\/appeal-assistant/)
    } else {
      test.skip()
    }
  })

  test("no console errors on load", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text())
    })
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    expect(errors.filter((e) => !e.includes("Warning:"))).toHaveLength(0)
  })
})
