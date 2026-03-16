import { test, expect } from "@playwright/test"
import { AuthPage } from "../pages/auth.page"
import { DEMO_USER } from "../fixtures/demo-data"

test.describe("Authentication", () => {
  let auth: AuthPage

  test.beforeEach(({ page }) => {
    auth = new AuthPage(page)
  })

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/auth/login")
    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#password")).toBeVisible()
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
  })

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/auth/register")
    await expect(page.locator("#firstName")).toBeVisible()
    await expect(page.locator("#lastName")).toBeVisible()
    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#phone")).toBeVisible()
    await expect(page.locator("#password")).toBeVisible()
  })

  test("login with demo user reaches dashboard", async ({ page }) => {
    await auth.login(DEMO_USER.email, DEMO_USER.password)
    await auth.assertOnDashboard()
  })

  test("invalid credentials shows error", async ({ page }) => {
    await page.goto("/auth/login")
    await page.fill("#email", "wrong@email.com")
    await page.fill("#password", "wrongpassword")
    await page.click('button[type="submit"]')
    // Error message should appear
    await expect(
      page.getByText(/invalid|incorrect|not found|error/i).first(),
    ).toBeVisible({ timeout: 10_000 })
    // Should NOT navigate away
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test("register form validates password length", async ({ page }) => {
    await page.goto("/auth/register")
    await page.fill("#firstName", "Test")
    await page.fill("#lastName", "User")
    await page.fill("#email", "test@example.com")
    await page.fill("#phone", "(617)555-0100")
    await page.fill("#password", "short")
    await page.click('button[type="submit"]')
    await expect(
      page.getByText(/at least 8|too short|password.*character/i).first(),
    ).toBeVisible({ timeout: 8_000 })
  })

  test("register→login link works", async ({ page }) => {
    await page.goto("/auth/register")
    await page.getByRole("link", { name: /sign in|already have/i }).click()
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test("login→register link works", async ({ page }) => {
    await page.goto("/auth/login")
    await page.getByRole("link", { name: /create|register|don't have/i }).click()
    await expect(page).toHaveURL(/\/auth\/register/)
  })

  test("unauthenticated user redirected from dashboard", async ({ page }) => {
    // Fresh page with no auth
    await page.goto("/customer/dashboard")
    // Should redirect to login (may carry ?next= param)
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 })
  })
})
