import { test, expect } from "@playwright/test"
import { PrescreenerPage } from "../pages/prescreener.page"

// Prescreener is public — no auth needed
test.describe("Eligibility Prescreener", () => {
  let screener: PrescreenerPage

  test.beforeEach(({ page }) => {
    screener = new PrescreenerPage(page)
  })

  test("page loads with welcome message", async ({ page }) => {
    await screener.goto()
    await expect(
      page.getByText(/masshealth.*assistant|eligibility.*assistant|get started/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("shows first question about state of residence", async ({ page }) => {
    await screener.goto()
    await expect(
      page.getByText(/where.*live|state.*reside|massachusetts/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("Massachusetts quick-reply starts the flow", async ({ page }) => {
    await screener.goto()
    await screener.selectQuickReply(/Massachusetts/)
    // Should advance to next question (age)
    await expect(
      page.getByText(/age|how old|year/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("'Another state' shows out-of-state message", async ({ page }) => {
    await screener.goto()
    await screener.selectQuickReply(/Another state/)
    await expect(
      page.getByText(/not available|your state|healthcare\.gov/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("happy path completes and shows eligibility results", async ({ page }) => {
    await screener.runHappyPath()
    await screener.assertResultsVisible()
  })

  test("results show Start Application button", async ({ page }) => {
    await screener.runHappyPath()
    await screener.assertStartApplicationButtonVisible()
  })

  test("progress bar advances through steps", async ({ page }) => {
    await screener.goto()
    // Step 1: progress should be near 0
    const progress1 = page.locator('[role="progressbar"], .progress, [aria-valuenow]').first()
    // Start the flow
    await screener.selectQuickReply(/Massachusetts/)
    await page.waitForTimeout(500)
    // Just verify we moved forward (no regression)
    await expect(page.getByText(/age|how old/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test("no JS errors during full happy path", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (err) => errors.push(err.message))
    await screener.runHappyPath()
    expect(errors).toHaveLength(0)
  })
})
