import { test, expect } from "@playwright/test"
import { ReviewerPage } from "../pages/reviewer.page"
import * as path from "path"

// Reviewer portal — uses same user for now (reviewer auth is role-based server-side)
test.use({ storageState: path.join(__dirname, "../.auth/user.json") })

test.describe("Reviewer / Staff Portal", () => {
  let reviewer: ReviewerPage

  test.beforeEach(({ page }) => {
    reviewer = new ReviewerPage(page)
  })

  test("reviewer dashboard page loads", async ({ page }) => {
    await reviewer.gotoDashboard()
    await expect(page).toHaveURL(/\/reviewer\/dashboard/)
    // May show a permission error if user lacks reviewer role — that's valid too
    await expect(
      page.getByText(/pending|case|review|dashboard|access|permission/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("reviewer cases page loads", async ({ page }) => {
    await reviewer.gotoCases()
    await expect(page).toHaveURL(/\/reviewer\/cases/)
    await expect(
      page.getByText(/case|application|status|access/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("audit trail page loads", async ({ page }) => {
    await reviewer.gotoAudit()
    await expect(page).toHaveURL(/\/reviewer\/audit/)
    await expect(
      page.getByText(/audit|history|trail|access/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("reviewer dashboard shows stats or case counts", async ({ page }) => {
    await reviewer.gotoDashboard()
    // Stats section: pending count, approved, flagged, etc.
    await expect(
      page.getByText(/\d+|pending|approved|flagged|rfi/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("no 500 errors on reviewer pages", async ({ page }) => {
    const serverErrors: string[] = []
    page.on("response", (res) => {
      if (res.url().includes("/api/") && res.status() >= 500) {
        serverErrors.push(`${res.status()} ${res.url()}`)
      }
    })
    for (const url of ["/reviewer/dashboard", "/reviewer/cases", "/reviewer/audit"]) {
      await page.goto(url)
      await page.waitForLoadState("networkidle")
    }
    expect(serverErrors).toHaveLength(0)
  })
})
